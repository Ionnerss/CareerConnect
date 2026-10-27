// Server-side service behind the recruiter "Compare top candidates" feature.
//
// SERVER ONLY: it talks to Supabase with the signed-in user's session and, through
// candidate-comparison.ts, to the Jev client that reads AI_GATEWAY_API_KEY.
//
// Everything runs as the signed-in recruiter, so row level security decides what can be
// read or written. On top of that, every function here checks that the user is a
// recruiter and owns the posting before it does anything else.
//
// PRIVACY: the applicant's name is loaded only to show it in the recruiter's own table.
// What is sent to Jev is built by buildCandidateState and never contains a name or email.

import { z } from "zod";
import { JevError } from "@/lib/ai/jev";
import { createClient } from "@/lib/supabase/server";
import { requirementsInputSchema } from "@/lib/validations/job-requirements";
import {
  compareCandidates,
  hashRequirements,
  rankComparison,
  type AskJev,
  type CandidateInput,
  type ComparedCandidate,
} from "./candidate-comparison";
import type { Requirement, RequirementResult } from "./candidate-scoring";
import {
  buildCandidateState,
  type EducationRow,
  type ExperienceRow,
  type SkillRow,
} from "./candidate-state";

export const DEFAULT_COMPARE_LIMIT = 10;
export const MAX_COMPARE_LIMIT = 25;

export type ComparisonErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "JOB_NOT_FOUND"
  | "NO_REQUIREMENTS"
  | "AI_NOT_CONFIGURED"
  | "BACKEND_ERROR";

export const COMPARISON_ERROR_STATUS: Record<ComparisonErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  JOB_NOT_FOUND: 404,
  NO_REQUIREMENTS: 409,
  AI_NOT_CONFIGURED: 503,
  BACKEND_ERROR: 500,
};

export type ComparisonFailure = { success: false; code: ComparisonErrorCode; error: string };

export const AUTH_ERROR = "Unable to authenticate. Please sign in again.";
export const NOT_RECRUITER_ERROR = "Only recruiters can compare candidates.";
export const JOB_NOT_FOUND_ERROR = "Job posting not found.";
export const NO_REQUIREMENTS_ERROR = "Add at least one requirement before comparing candidates.";
export const AI_NOT_CONFIGURED_ERROR =
  "AI comparison is not set up on the server yet. Ask your team to add the API key.";

export type SavedRequirement = {
  id: string;
  text: string;
  kind: "core" | "nice";
  weight: number;
};

export type RequirementsResponse =
  | { success: true; requirements: SavedRequirement[] }
  | ComparisonFailure;

export type ComparisonCandidate = {
  application_id: string;
  full_name: string | null;
  /** 0 to 100 */
  score: number;
  /** Lowest confidence across the requirements, 0 to 1. */
  min_confidence: number;
  needs_human_review: boolean;
  results: { requirement_id: string; score: number; confidence: number }[];
  /** True when the stored result was reused instead of asking the model again. */
  cached: boolean;
};

export type ComparisonFailedCandidate = {
  application_id: string;
  full_name: string | null;
  code: string;
  message: string;
};

export type CompareResponse =
  | {
      success: true;
      job_id: string;
      requirements: SavedRequirement[];
      /** Best score first. */
      ranked: ComparisonCandidate[];
      failed: ComparisonFailedCandidate[];
      total_applicants: number;
      /** How many applicants were looked at (oldest applications first, up to the limit). */
      compared_count: number;
      /** False when the results could not be saved; they are still returned. */
      saved: boolean;
    }
  | ComparisonFailure;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function failure(code: ComparisonErrorCode, error: string): ComparisonFailure {
  return { success: false, code, error };
}

const jobIdSchema = z.uuid();

/** Signs the user in, confirms the recruiter role and that they own the posting. */
async function requireOwnedJob(
  jobId: unknown,
): Promise<{ success: true; supabase: SupabaseClient; jobId: string } | ComparisonFailure> {
  const parsedJobId = jobIdSchema.safeParse(jobId);
  if (!parsedJobId.success) {
    return failure("JOB_NOT_FOUND", JOB_NOT_FOUND_ERROR);
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return failure("UNAUTHENTICATED", AUTH_ERROR);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return failure("BACKEND_ERROR", "Unable to load your profile. Please try again.");
  }
  if (!profile || profile.role !== "recruiter") {
    return failure("FORBIDDEN", NOT_RECRUITER_ERROR);
  }

  const { data: job, error: jobError } = await supabase
    .from("job")
    .select("id")
    .eq("id", parsedJobId.data)
    .eq("recruiter_id", user.id)
    .maybeSingle();
  if (jobError) {
    return failure("BACKEND_ERROR", "Unable to load this job posting. Please try again.");
  }
  if (!job) {
    return failure("JOB_NOT_FOUND", JOB_NOT_FOUND_ERROR);
  }

  return { success: true, supabase, jobId: parsedJobId.data };
}

type RequirementRow = { id: string; text: string; kind: string; weight: number };

function toSavedRequirement(row: RequirementRow): SavedRequirement {
  return {
    id: row.id,
    text: row.text,
    kind: row.kind === "nice" ? "nice" : "core",
    weight: Number(row.weight),
  };
}

async function loadRequirements(
  supabase: SupabaseClient,
  jobId: string,
): Promise<{ success: true; requirements: SavedRequirement[] } | ComparisonFailure> {
  const { data, error } = await supabase
    .from("job_requirements")
    .select("id, text, kind, weight")
    .eq("posting_id", jobId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return failure("BACKEND_ERROR", "Unable to load the requirements. Please try again.");
  }
  return { success: true, requirements: (data ?? []).map(toSavedRequirement) };
}

/** The requirements a recruiter has set on one of their postings. */
export async function getJobRequirements(jobId: unknown): Promise<RequirementsResponse> {
  const owned = await requireOwnedJob(jobId);
  if (!owned.success) return owned;
  return loadRequirements(owned.supabase, owned.jobId);
}

/**
 * Replace the requirements of a posting with a new list. The new rows are added first and
 * the old ones removed afterwards, so a failure never leaves the posting with none.
 */
export async function saveJobRequirements(
  jobId: unknown,
  input: unknown,
): Promise<RequirementsResponse> {
  const parsed = requirementsInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid requirements.");
  }

  const owned = await requireOwnedJob(jobId);
  if (!owned.success) return owned;
  const { supabase } = owned;

  const existing = await supabase
    .from("job_requirements")
    .select("id")
    .eq("posting_id", owned.jobId);
  if (existing.error) {
    return failure("BACKEND_ERROR", "Unable to save the requirements. Please try again.");
  }
  const oldIds = (existing.data ?? []).map((row: { id: string }) => row.id);

  const inserted = await supabase
    .from("job_requirements")
    .insert(
      parsed.data.map((requirement) => ({
        posting_id: owned.jobId,
        text: requirement.text,
        kind: requirement.kind,
        weight: requirement.weight,
      })),
    )
    .select("id, text, kind, weight");
  if (inserted.error || !inserted.data) {
    return failure("BACKEND_ERROR", "Unable to save the requirements. Please try again.");
  }

  if (oldIds.length > 0) {
    const removed = await supabase.from("job_requirements").delete().in("id", oldIds);
    if (removed.error) {
      return failure(
        "BACKEND_ERROR",
        "The new requirements were added but the old ones could not be removed. Please try again.",
      );
    }
  }

  return { success: true, requirements: inserted.data.map(toSavedRequirement) };
}

const compareOptionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_COMPARE_LIMIT).default(DEFAULT_COMPARE_LIMIT),
  includeOrganizations: z.boolean().default(true),
  /** Ignore stored results and ask the model again. */
  refresh: z.boolean().default(false),
});

export type CompareOptions = z.input<typeof compareOptionsSchema>;

const storedResultsSchema = z.array(
  z.object({
    requirementId: z.string(),
    score: z.number(),
    confidence: z.number(),
  }),
);

type ApplicationRow = {
  id: string;
  applicant_id: string;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

type StoredEvaluationRow = {
  application_id: string;
  answers: unknown;
  score: number;
  confidence: number | string;
  needs_review: boolean;
  requirements_hash: string;
};

function groupByProfile<T extends { profile_id: string }>(rows: T[] | null): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows ?? []) {
    const list = grouped.get(row.profile_id) ?? [];
    list.push(row);
    grouped.set(row.profile_id, list);
  }
  return grouped;
}

/**
 * Compare the applicants of one of the recruiter's postings against its requirements.
 *
 * Looks at the oldest applications first, up to `limit`. A stored result is reused when
 * the requirements have not changed since it was saved (unless `refresh` is set), so a
 * page reload does not call the model again. Candidates that fail are returned in
 * `failed` and do not stop the others. The recruiter decides what to do with the result:
 * nothing here accepts or rejects anyone.
 */
export async function compareJobCandidates(
  jobId: unknown,
  rawOptions: unknown = {},
  deps: { ask?: AskJev; now?: Date } = {},
): Promise<CompareResponse> {
  const options = compareOptionsSchema.safeParse(rawOptions ?? {});
  if (!options.success) {
    return failure("INVALID_INPUT", options.error.issues[0]?.message ?? "Invalid options.");
  }

  const owned = await requireOwnedJob(jobId);
  if (!owned.success) return owned;
  const { supabase } = owned;

  const loadedRequirements = await loadRequirements(supabase, owned.jobId);
  if (!loadedRequirements.success) return loadedRequirements;
  const savedRequirements = loadedRequirements.requirements;
  if (savedRequirements.length === 0) {
    return failure("NO_REQUIREMENTS", NO_REQUIREMENTS_ERROR);
  }
  const requirements: Requirement[] = savedRequirements;
  const requirementsHash = hashRequirements(requirements);

  const applicationsResult = await supabase
    .from("applications")
    .select("id, applicant_id, created_at, profiles(full_name)")
    .eq("job_id", owned.jobId)
    .order("created_at", { ascending: true });
  if (applicationsResult.error) {
    return failure("BACKEND_ERROR", "Unable to load applicants. Please try again.");
  }

  const allApplications = (applicationsResult.data ?? []) as ApplicationRow[];
  const applications = allApplications.slice(0, options.data.limit);

  const base = {
    success: true as const,
    job_id: owned.jobId,
    requirements: savedRequirements,
    total_applicants: allApplications.length,
    compared_count: applications.length,
  };
  if (applications.length === 0) {
    return { ...base, ranked: [], failed: [], saved: true };
  }

  const nameByApplication = new Map<string, string | null>();
  for (const application of applications) {
    const profile = Array.isArray(application.profiles)
      ? application.profiles[0]
      : application.profiles;
    nameByApplication.set(application.id, profile?.full_name ?? null);
  }

  // Stored results that are still valid for the current requirements.
  const cached = new Map<string, ComparedCandidate>();
  if (!options.data.refresh) {
    const stored = await supabase
      .from("candidate_evaluations")
      .select("application_id, answers, score, confidence, needs_review, requirements_hash")
      .in(
        "application_id",
        applications.map((application) => application.id),
      );
    if (stored.error) {
      return failure("BACKEND_ERROR", "Unable to load saved results. Please try again.");
    }

    for (const row of (stored.data ?? []) as StoredEvaluationRow[]) {
      if (row.requirements_hash !== requirementsHash) continue;
      const results = storedResultsSchema.safeParse(row.answers);
      if (!results.success) continue;
      cached.set(row.application_id, {
        status: "ok",
        applicationId: row.application_id,
        score: Number(row.score),
        minConfidence: Number(row.confidence),
        needsHumanReview: Boolean(row.needs_review),
        results: results.data as RequirementResult[],
      });
    }
  }

  const toScore = applications.filter((application) => !cached.has(application.id));
  let fresh: ComparedCandidate[] = [];

  if (toScore.length > 0) {
    const applicantIds = [...new Set(toScore.map((application) => application.applicant_id))];

    const [skills, education, experience] = await Promise.all([
      supabase.from("profile_skills").select("profile_id, name, proficiency").in("profile_id", applicantIds),
      supabase
        .from("profile_education")
        .select("profile_id, school, degree, field_of_study, start_date, end_date, description")
        .in("profile_id", applicantIds),
      supabase
        .from("profile_experience")
        .select("profile_id, company_name, job_role, start_date, end_date, description")
        .in("profile_id", applicantIds),
    ]);
    if (skills.error || education.error || experience.error) {
      return failure("BACKEND_ERROR", "Unable to load applicant profiles. Please try again.");
    }

    const skillsByProfile = groupByProfile<SkillRow & { profile_id: string }>(skills.data);
    const educationByProfile = groupByProfile<EducationRow & { profile_id: string }>(education.data);
    const experienceByProfile = groupByProfile<ExperienceRow & { profile_id: string }>(
      experience.data,
    );

    const candidates: CandidateInput[] = toScore.map((application) => ({
      applicationId: application.id,
      state: buildCandidateState(
        {
          skills: skillsByProfile.get(application.applicant_id) ?? [],
          education: educationByProfile.get(application.applicant_id) ?? [],
          experience: experienceByProfile.get(application.applicant_id) ?? [],
        },
        { includeOrganizations: options.data.includeOrganizations, now: deps.now },
      ),
    }));

    try {
      fresh = await compareCandidates(requirements, candidates, { ask: deps.ask });
    } catch (error) {
      if (error instanceof JevError && error.code === "missing_key") {
        return failure("AI_NOT_CONFIGURED", AI_NOT_CONFIGURED_ERROR);
      }
      return failure("BACKEND_ERROR", "Unable to compare candidates. Please try again.");
    }
  }

  // Save the new results so the next page load does not ask the model again.
  let saved = true;
  const freshOk = fresh.filter(
    (candidate): candidate is Extract<ComparedCandidate, { status: "ok" }> =>
      candidate.status === "ok",
  );
  if (freshOk.length > 0) {
    const now = (deps.now ?? new Date()).toISOString();
    const upsert = await supabase.from("candidate_evaluations").upsert(
      freshOk.map((candidate) => ({
        application_id: candidate.applicationId,
        answers: candidate.results,
        score: candidate.score,
        confidence: candidate.minConfidence,
        needs_review: candidate.needsHumanReview,
        requirements_hash: requirementsHash,
        created_at: now,
      })),
      { onConflict: "application_id" },
    );
    saved = !upsert.error;
  }

  // Rank in application order (oldest first) so ties stay in a predictable order.
  const byApplication = new Map<string, ComparedCandidate>(
    [...cached.values(), ...fresh].map((candidate) => [candidate.applicationId, candidate]),
  );
  const { ranked, failed } = rankComparison(
    applications.flatMap((application) => {
      const candidate = byApplication.get(application.id);
      return candidate ? [candidate] : [];
    }),
  );

  return {
    ...base,
    ranked: ranked.map((candidate) => ({
      application_id: candidate.applicationId,
      full_name: nameByApplication.get(candidate.applicationId) ?? null,
      score: candidate.score,
      min_confidence: candidate.minConfidence,
      needs_human_review: candidate.needsHumanReview,
      results: candidate.results.map((result) => ({
        requirement_id: result.requirementId,
        score: result.score,
        confidence: result.confidence,
      })),
      cached: cached.has(candidate.applicationId),
    })),
    failed: failed.map((candidate) => ({
      application_id: candidate.applicationId,
      full_name: nameByApplication.get(candidate.applicationId) ?? null,
      code: candidate.code,
      message: candidate.message,
    })),
    saved,
  };
}
