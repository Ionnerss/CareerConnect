import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const documentRequestSchema = z.object({
  applicationId: z.uuid(),
  kind: z.enum(["resume", "cover_letter"]),
  mode: z.enum(["view", "download"]),
}).strict();

export type ApplicantDocumentRequest = z.infer<
  typeof documentRequestSchema
>;

export type ApplicantDocumentResult =
  | { success: true; url: string }
  | {
      success: false;
      error: string;
    };

const UNAVAILABLE = "This document is not available.";
const UNAUTHORIZED = "You cannot access this document.";

export async function getApplicantDocumentUrl(
  input: unknown
): Promise<ApplicantDocumentResult> {
  const parsed = documentRequestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid document request.",
    };
  }

  const { applicationId, kind, mode } = parsed.data;

  const supabase = await createClient();

  // 1. Authenticate the current user.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: "Please sign in to access documents.",
    };
  }

  // 2. Verify the recruiter role.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      success: false,
      error: "Unable to verify your account.",
    };
  }

  if (!profile || profile.role !== "recruiter") {
    return { success: false, error: UNAUTHORIZED };
  }

  // 3. Load only the application identified by the request.
  const { data: application, error: applicationError } =
    await supabase
      .from("applications")
      .select(
        "id, job_id, applicant_id, resume_id, cover_letter_path"
      )
      .eq("id", applicationId)
      .maybeSingle();

  if (applicationError || !application) {
    return { success: false, error: UNAUTHORIZED };
  }

  // 4. Verify that the recruiter owns the posting.
  const { data: job, error: jobError } = await supabase
    .from("job")
    .select("id")
    .eq("id", application.job_id)
    .eq("recruiter_id", user.id)
    .maybeSingle();

  if (jobError || !job) {
    return { success: false, error: UNAUTHORIZED };
  }

  let bucket: "resumes" | "cover_letters";
  let filePath: string;
  let downloadName: string;

  if (kind === "resume") {
    if (!application.resume_id) {
      return { success: false, error: UNAVAILABLE };
    }

    // The resume must belong to this application's applicant.
    const { data: resume, error: resumeError } =
      await supabase
        .from("resumes")
        .select("file_path, file_name")
        .eq("id", application.resume_id)
        .eq("user_id", application.applicant_id)
        .maybeSingle();

    if (resumeError || !resume) {
      return { success: false, error: UNAVAILABLE };
    }

    // Existing resume uploads use <user-id>/<file-id>.pdf.
    if (
      !resume.file_path.startsWith(
        `${application.applicant_id}/`
      )
    ) {
      return { success: false, error: UNAVAILABLE };
    }

    bucket = "resumes";
    filePath = resume.file_path;
    downloadName = resume.file_name;
  } else {
    const path = application.cover_letter_path;

    if (!path) {
      return { success: false, error: UNAVAILABLE };
    }

    // Expected cover letter path:
    // <applicant-id>/<application-id>/<filename>
    const prefix =
      `${application.applicant_id}/${application.id}/`;

    if (!path.startsWith(prefix) || path === prefix) {
      return { success: false, error: UNAVAILABLE };
    }

    bucket = "cover_letters";
    filePath = path;
    downloadName = "cover-letter.pdf";
  }

  // 5. Create a short-lived URL using the user's RLS session.
  const { data, error: storageError } =
    await supabase.storage
      .from(bucket)
      .createSignedUrl(
        filePath,
        60,
        mode === "download"
          ? { download: downloadName }
          : undefined
      );

  if (storageError || !data?.signedUrl) {
    return {
      success: false,
      error: "Unable to open this document. Please try again.",
    };
  }

  return {
    success: true,
    url: data.signedUrl,
  };
}
