
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkMfaForClient } from "@/lib/auth/require-mfa";
import { jobPostingSchema } from "@/lib/validations/job-posting";

export type UpdateJobResponse =
  | { success: true; jobId: string }
  | { success: false; error: string };

export async function updateJobPosting(
  jobId: unknown,
  input: unknown
): Promise<UpdateJobResponse> {
  const parsedId = z.uuid().safeParse(jobId);
  const parsedInput = jobPostingSchema.safeParse(input);

  if (!parsedId.success) {
    return { success: false, error: "Invalid job posting." };
  }

  if (!parsedInput.success) {
    return { success: false, error: "Please check the job details." };
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

  const { data: updatedJob, error: updateError } = await supabase
    .from("job")
    .update({
      title: parsedInput.data.title,
      firm_name: parsedInput.data.firm_name,
      location: parsedInput.data.location,
      work_mode: parsedInput.data.work_mode,
      employment_type: parsedInput.data.employment_type,
      required_skills: parsedInput.data.required_skills,
      salary: parsedInput.data.salary,
      experience: parsedInput.data.experience,
      description: parsedInput.data.description,
      status: parsedInput.data.status,
    })
    .eq("id", parsedId.data)
    .eq("recruiter_id", user.id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      success: false,
      error: "Unable to update this job posting. Please try again.",
    };
  }

  if (!updatedJob) {
    return {
      success: false,
      error: "Job posting not found or you do not have permission to edit it.",
    };
  }

  return {
    success: true,
    jobId: updatedJob.id,
  };
}
