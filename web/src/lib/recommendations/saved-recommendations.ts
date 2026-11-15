import { checkMfaForClient } from "@/lib/auth/require-mfa";
import { createClient } from "@/lib/supabase/server";
import type { Recommendation } from "./recommend";
import {
  AUTH_ERROR,
  AUTH_UNAVAILABLE_ERROR,
  LOAD_FAILED_ERROR,
  MFA_REQUIRED_ERROR,
  NOT_JOB_SEEKER_ERROR,
  type RecommendationInputsErrorCode,
} from "./recommendation-inputs";
import type { JobForMatching } from "./job-shortlist";

export type SavedRecommendationRun = {
  id: string;
  created_at: string;
  completed_at: string;
  /** Number published originally; may differ from currently visible rows. */
  result_count: number;
  summary_count: number;
  ranking_mode: "ai" | "mixed" | "code_only" | null;
};

export type SavedRecommendationsResponse =
  | {
      success: true;
      /** Null means this seeker has never had a successful run. */
      run: SavedRecommendationRun | null;
      recommendations: Recommendation[];
    }
  | {
      success: false;
      code: RecommendationInputsErrorCode;
      error: string;
    };

const JOB_COLUMNS =
  "id, title, firm_name, location, work_mode, employment_type, required_skills, salary, experience, description, status, created_at";

function failure(
  code: RecommendationInputsErrorCode,
  error: string,
): SavedRecommendationsResponse {
  return { success: false, code, error };
}

function jobWithNumericSalary(
  row: Record<string, unknown>,
): JobForMatching {
  const rawSalary = row.salary;
  const salary =
    rawSalary === null || rawSalary === undefined
      ? null
      : Number(rawSalary);

  return {
    ...(row as Omit<JobForMatching, "salary">),
    salary: salary !== null && Number.isFinite(salary) ? salary : null,
  };
}

export async function getSavedRecommendations(): Promise<SavedRecommendationsResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return failure("UNAUTHENTICATED", AUTH_ERROR);
  }

  const mfaError = await checkMfaForClient(supabase);
  if (mfaError === "MFA_REQUIRED") {
    return failure("MFA_REQUIRED", MFA_REQUIRED_ERROR);
  }
  if (mfaError) {
    return failure("AUTH_UNAVAILABLE", AUTH_UNAVAILABLE_ERROR);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return failure("LOAD_FAILED", LOAD_FAILED_ERROR);
  }
  if (!profile || profile.role !== "job_seeker") {
    return failure("NOT_JOB_SEEKER", NOT_JOB_SEEKER_ERROR);
  }

  // RLS independently restricts this query to the signed-in owner.
  const { data: run, error: runError } = await supabase
    .from("recommendation_runs")
    .select(
      "id, created_at, completed_at, result_count, summary_count, ranking_mode",
    )
    .eq("user_id", user.id)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError) {
    return failure("LOAD_FAILED", LOAD_FAILED_ERROR);
  }

  if (!run) {
    return { success: true, run: null, recommendations: [] };
  }

  const savedRun = run as SavedRecommendationRun;

  const { data: rows, error: resultsError } = await supabase
    .from("recommendation_results")
    .select(
      "job_id, rank, score, match_score, fit, fit_error, fit_generated_at, skill_match, reasons, summary",
    )
    .eq("run_id", savedRun.id)
    .order("rank", { ascending: true });

  if (resultsError) {
    return failure("LOAD_FAILED", LOAD_FAILED_ERROR);
  }

  const results = rows ?? [];
  if (results.length === 0) {
    // This covers a true empty success and a run whose jobs were deleted.
    // In either case, an older run must not replace this one.
    return {
      success: true,
      run: savedRun,
      recommendations: [],
    };
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("job")
    .select(JOB_COLUMNS)
    .in(
      "id",
      results.map((row) => row.job_id),
    )
    .eq("status", "open");

  if (jobsError) {
    return failure("LOAD_FAILED", LOAD_FAILED_ERROR);
  }

  const jobsById = new Map(
    (jobs ?? []).map((row) => [
      row.id,
      jobWithNumericSalary(row as Record<string, unknown>),
    ]),
  );

  const recommendations: Recommendation[] = results.flatMap((row) => {
    const job = jobsById.get(row.job_id);
    if (!job) return [];

    return [{
      job,
      score: row.score,
      match_score: row.match_score,
      fit: row.fit as Recommendation["fit"],
      fit_error: row.fit_error as Recommendation["fit_error"],
      fit_generated_at: row.fit_generated_at,
      skill_match: row.skill_match as Recommendation["skill_match"],
      reasons: row.reasons as string[],
      summary: row.summary,
    }];
  });

  return {
    success: true,
    run: savedRun,
    recommendations,
  };
}