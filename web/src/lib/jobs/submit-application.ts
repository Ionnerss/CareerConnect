import "server-only";
import { z } from "zod";
import { createClient } from "../supabase/server";// Match your existing server-client import.

const submissionSchema = z.object({
  jobId: z.string().uuid(),
  resumeId: z.string().uuid(),
}).strict();

type SubmitResult =
  | { ok: true; applicationId: string }
  | {
      ok: false;
      reason:
        | "invalid_input"
        | "signed_out"
        | "job_unavailable"
        | "resume_unavailable"
        | "already_applied"
        | "database_error";
    };

export async function submitApplication(input: unknown): Promise<SubmitResult> {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid_input" };

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, reason: "signed_out" };
  }

  const { jobId, resumeId } = parsed.data;

  const { data: job, error: jobError } = await supabase
    .from("job")
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) return { ok: false, reason: "database_error" };
  if (!job || job.status !== "open") {
    return { ok: false, reason: "job_unavailable" };
  }

  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .select("id")
    .eq("id", resumeId)
    .eq("user_id", authData.user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (resumeError) return { ok: false, reason: "database_error" };
  if (!resume) return { ok: false, reason: "resume_unavailable" };

  const { data: application, error: insertError } = await supabase
    .from("applications")
    .insert({
      job_id: jobId,
      resume_id: resumeId,
      applicant_id: authData.user.id,
    })
    .select("id")
    .single();

  if (insertError) {
    if (
      insertError.code === "23505" &&
      insertError.message.includes("applications_applicant_job_unique")
    ) {
      return { ok: false, reason: "already_applied" };
    }

    // The database is the final guard if the job closes after our read.
    if (insertError.message.includes("You can only apply to an open job.")) {
      return { ok: false, reason: "job_unavailable" };
    }

    if (insertError.message.includes("You must select your own active resume.")) {
      return { ok: false, reason: "resume_unavailable" };
    }

    return { ok: false, reason: "database_error" };
  }

  return { ok: true, applicationId: application.id };
}