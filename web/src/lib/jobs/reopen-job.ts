import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ReopenJobResult =
  | { success: true; jobId: string }
  | { success: false; error: string };

export const REOPEN_JOB_ERRORS = {
  invalidId: "Invalid job posting.",
  signedOut: "Please sign in again.",
  notRecruiter: "Only recruiters can reopen job postings.",
  profile: "Unable to verify your recruiter profile.",
  unavailable:
    "This job is already open or does not belong to you.",
  database: "Unable to reopen the job. Please try again.",
} as const;

const jobIdSchema = z.uuid();

export async function reopenJobPosting(
  input: unknown
): Promise<ReopenJobResult> {
  // Validate before accessing the database.
  const parsed = jobIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: REOPEN_JOB_ERRORS.invalidId,
    };
  }

  const supabase = await createClient();

  // Authenticate the current user.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: REOPEN_JOB_ERRORS.signedOut,
    };
  }

  // Confirm the current user is a recruiter.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      success: false,
      error: REOPEN_JOB_ERRORS.profile,
    };
  }

  if (!profile || profile.role !== "recruiter") {
    return {
      success: false,
      error: REOPEN_JOB_ERRORS.notRecruiter,
    };
  }

  // Only reopen a CLOSED posting owned by this recruiter.
  // The database RLS policy independently checks ownership.
  const { data: job, error: updateError } = await supabase
    .from("job")
    .update({ status: "open" })
    .eq("id", parsed.data)
    .eq("recruiter_id", user.id)
    .eq("status", "closed")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      success: false,
      error: REOPEN_JOB_ERRORS.database,
    };
  }

  if (!job) {
    return {
      success: false,
      error: REOPEN_JOB_ERRORS.unavailable,
    };
  }

  return {
    success: true,
    jobId: job.id,
  };
}
