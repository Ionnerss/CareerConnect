
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type CloseJobResult =
  | { success: true; jobId: string }
  | { success: false; error: string };

export const CLOSE_JOB_ERRORS = {
  invalidId: "Invalid job posting.",
  signedOut: "Please sign in again.",
  notRecruiter: "Only recruiters can close job postings.",
  profile: "Unable to verify your recruiter profile.",
  unavailable: "This job is already closed or does not belong to you.",
  database: "Unable to close the job. Please try again.",
} as const;

const jobIdSchema = z.uuid();

export async function closeJobPosting(
  input: unknown
): Promise<CloseJobResult> {
  // Reject malformed inputs before accessing Supabase.
  const parsed = jobIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: CLOSE_JOB_ERRORS.invalidId,
    };
  }

  const supabase = await createClient();

  // Authenticate the user on the server.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: CLOSE_JOB_ERRORS.signedOut,
    };
  }

  // Verify the user is a recruiter.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      success: false,
      error: CLOSE_JOB_ERRORS.profile,
    };
  }

  if (!profile || profile.role !== "recruiter") {
    return {
      success: false,
      error: CLOSE_JOB_ERRORS.notRecruiter,
    };
  }

  // Only close an OPEN posting owned by this recruiter.
  // Supabase RLS independently enforces ownership.
  const { data: job, error: updateError } = await supabase
    .from("job")
    .update({ status: "closed" })
    .eq("id", parsed.data)
    .eq("recruiter_id", user.id)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      success: false,
      error: CLOSE_JOB_ERRORS.database,
    };
  }

  // Handles already-closed, nonexistent, and unowned jobs.
  if (!job) {
    return {
      success: false,
      error: CLOSE_JOB_ERRORS.unavailable,
    };
  }

  return {
    success: true,
    jobId: job.id,
  };
}
