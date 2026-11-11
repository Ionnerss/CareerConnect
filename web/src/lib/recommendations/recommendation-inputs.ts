// Loads everything the job-recommendation feature needs for the signed-in job seeker:
// who they are (profile data, as safe-to-send AI state) and which open postings are
// worth looking at (the shortlist). Used by the recommendations endpoint/page.
//
// It checks sign-in, two-factor authentication and the job_seeker role first, and it only
// ever reads the signed-in user's own profile rows.

import { createClient } from "@/lib/supabase/server";
import { checkMfaForClient } from "@/lib/auth/require-mfa";
import { shortlistJobs, type JobForMatching, type ShortlistedJob } from "./job-shortlist";
import {
  buildSeekerState,
  isProfileEmpty,
  type SeekerPreferences,
  type SeekerSnapshot,
  type SeekerState,
} from "./seeker-state";

export type RecommendationInputsErrorCode =
  | "UNAUTHENTICATED"
  | "MFA_REQUIRED"
  | "AUTH_UNAVAILABLE"
  | "NOT_JOB_SEEKER"
  | "LOAD_FAILED";

export type RecommendationInputsResponse =
  | {
      success: true;
      /** True when the profile has nothing to match on yet. The shortlist is empty and no AI call is needed. */
      empty_profile: boolean;
      seeker_state: SeekerState;
      shortlist: ShortlistedJob[];
      /** How many open postings were looked at before shortlisting. */
      considered_jobs: number;
    }
  | { success: false; code: RecommendationInputsErrorCode; error: string };

export const AUTH_ERROR = "Unable to authenticate. Please sign in again.";
export const MFA_REQUIRED_ERROR = "Complete two-factor authentication to continue.";
export const AUTH_UNAVAILABLE_ERROR = "Unable to verify authentication security.";
export const NOT_JOB_SEEKER_ERROR = "Only job seekers can get job recommendations.";
export const LOAD_FAILED_ERROR = "Unable to load your recommendations. Please try again.";

/** Newest open postings looked at per request. Keeps the work bounded as the job list grows. */
export const MAX_JOBS_CONSIDERED = 200;

const JOB_COLUMNS =
  "id, title, firm_name, location, work_mode, employment_type, required_skills, salary, experience, description, status, created_at";

function failure(code: RecommendationInputsErrorCode, error: string): RecommendationInputsResponse {
  return { success: false, code, error };
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type RecommendationInputsOptions = {
  /** How many postings to shortlist. Defaults to 10. */
  limit?: number;
  now?: Date;
};

export async function getRecommendationInputs(
  options: RecommendationInputsOptions = {},
): Promise<RecommendationInputsResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return failure("UNAUTHENTICATED", AUTH_ERROR);

  const mfaError = await checkMfaForClient(supabase);
  if (mfaError === "MFA_REQUIRED") return failure("MFA_REQUIRED", MFA_REQUIRED_ERROR);
  if (mfaError) return failure("AUTH_UNAVAILABLE", AUTH_UNAVAILABLE_ERROR);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, location")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return failure("LOAD_FAILED", LOAD_FAILED_ERROR);
  if (!profile || profile.role !== "job_seeker") {
    return failure("NOT_JOB_SEEKER", NOT_JOB_SEEKER_ERROR);
  }

  const [skills, education, experience, preferences] = await Promise.all([
    supabase.from("profile_skills").select("name, proficiency").eq("profile_id", user.id),
    supabase
      .from("profile_education")
      .select("school, degree, field_of_study, start_date, end_date, description")
      .eq("profile_id", user.id),
    supabase
      .from("profile_experience")
      .select("company_name, job_role, start_date, end_date, description")
      .eq("profile_id", user.id),
    supabase
      .from("profile_preferences")
      .select("desired_role, desired_position, desired_salary, work_mode")
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  if (skills.error || education.error || experience.error || preferences.error) {
    return failure("LOAD_FAILED", LOAD_FAILED_ERROR);
  }

  const preferenceRow = preferences.data
    ? ({
        desired_role: preferences.data.desired_role ?? null,
        desired_position: preferences.data.desired_position ?? null,
        desired_salary: toNumber(preferences.data.desired_salary),
        work_mode: preferences.data.work_mode ?? null,
      } as SeekerPreferences)
    : null;

  const snapshot: SeekerSnapshot = {
    skills: skills.data ?? [],
    education: education.data ?? [],
    experience: experience.data ?? [],
    preferences: preferenceRow,
    location: profile.location ?? null,
  };

  const seekerState = buildSeekerState(snapshot, { now: options.now });

  // Nothing to match on: skip the job queries entirely.
  if (isProfileEmpty(snapshot)) {
    return {
      success: true,
      empty_profile: true,
      seeker_state: seekerState,
      shortlist: [],
      considered_jobs: 0,
    };
  }

  const [jobs, applications] = await Promise.all([
    supabase
      .from("job")
      .select(JOB_COLUMNS)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(MAX_JOBS_CONSIDERED),
    supabase.from("applications").select("job_id").eq("applicant_id", user.id),
  ]);

  if (jobs.error || applications.error) return failure("LOAD_FAILED", LOAD_FAILED_ERROR);

  const openJobs = (jobs.data ?? []).map((row) => ({
    ...row,
    salary: toNumber(row.salary),
  })) as JobForMatching[];

  const shortlist = shortlistJobs(snapshot, openJobs, {
    limit: options.limit,
    appliedJobIds: (applications.data ?? []).map((row) => row.job_id as string),
    now: options.now,
  });

  return {
    success: true,
    empty_profile: false,
    seeker_state: seekerState,
    shortlist,
    considered_jobs: openJobs.length,
  };
}
