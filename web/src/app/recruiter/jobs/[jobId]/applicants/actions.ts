
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  getApplicantDocumentUrl,
  type ApplicantDocumentRequest,
} from "@/lib/recruiter/applicant-documents";

export type ApplicationStatus =
  | "In Progress"
  | "Interview"
  | "Accepted"
  | "Rejected";

const VALID_STATUSES: ApplicationStatus[] = [
  "In Progress",
  "Interview",
  "Accepted",
  "Rejected",
];

export async function openApplicantDocument(
  input: ApplicantDocumentRequest
) {
  return getApplicantDocumentUrl(input);
}

export async function updateApplicantStatus(
  applicationId: string,
  jobId: string,
  status: ApplicationStatus
) {
  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: "Invalid status." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  const { data: job } = await supabase
    .from("job")
    .select("id")
    .eq("id", jobId)
    .eq("recruiter_id", user.id)
    .single();

  if (!job) {
    return { success: false, error: "Unauthorized." };
  }

  const { data: application, error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId)
    .eq("job_id", jobId)
    .select("id")
    .maybeSingle();

  if (error || !application) {
    return {
      success: false,
      error: error?.message ?? "Unable to update status.",
    };
  }

  revalidatePath(`/recruiter/jobs/${jobId}/applicants`);

  return { success: true };
}
