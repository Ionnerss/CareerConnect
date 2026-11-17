
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkMfaForClient } from "@/lib/auth/require-mfa";

export type EditableJob = {
  id: string;
  title: string | null;
  firm_name: string | null;
  location: string | null;
  work_mode: string;
  employment_type: string | null;
  required_skills: string | null;
  salary: number | null;
  experience: number | null;
  description: string | null;
  status: string | null;
};

export type GetJobResponse =
  | { success: true; job: EditableJob }
  | { success: false; error: string };

export async function getJobForEditing(
  jobId: unknown
): Promise<GetJobResponse> {
  const parsedId = z.uuid().safeParse(jobId);

  if (!parsedId.success) {
    return {
      success: false,
      error: "Job posting not found.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: "Unable to authenticate. Please sign in again.",
    };
  }

  const mfaError = await checkMfaForClient(supabase);

  if (mfaError) {
    return {
      success: false,
      error:
        mfaError === "MFA_REQUIRED"
          ? "Complete two-factor authentication to continue."
          : "Unable to verify authentication security.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      success: false,
      error: "Unable to load your profile. Please try again.",
    };
  }

  if (!profile || profile.role !== "recruiter") {
    return {
      success: false,
      error: "Only recruiters can edit job postings.",
    };
  }

  const { data: job, error: jobError } = await supabase
    .from("job")
    .select(
      "id, title, firm_name, location, work_mode, employment_type, required_skills, salary, experience, description, status"
    )
    .eq("id", parsedId.data)
    .eq("recruiter_id", user.id)
    .maybeSingle();

  if (jobError) {
    return {
      success: false,
      error: "Unable to load this job posting. Please try again.",
    };
  }

  if (!job) {
    return {
      success: false,
      error: "Job posting not found.",
    };
  }

  return {
    success: true,
    job,
  };
}
