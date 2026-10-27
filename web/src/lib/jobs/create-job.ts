import { createClient } from "@/lib/supabase/server";
import { jobPostingSchema } from "@/lib/validations/job-posting";

export type CreatedJob = {
  id: string;
  title: string;
  location: string;
  status: string;
  created_at: string;
};

export type CreateJobResponse =
  | { success: true; job: CreatedJob }
  | { success: false; error: string };

export const AUTH_ERROR = "Unable to authenticate. Please sign in again.";
export const NOT_RECRUITER_ERROR = "Only recruiters can post jobs.";
export const INVALID_JOB_ERROR = "Please check the job details.";
export const CREATE_JOB_ERROR = "Unable to post this job. Please try again.";

const createdJobColumns = "id, title, location, status, created_at";

/**
 * Creates a job posting for the signed-in recruiter, open (Published) unless they chose Closed.
 * The database also checks this: its RLS policy only lets a recruiter insert a job
 * whose recruiter_id is their own id.
 */
export async function createJobPosting(input: unknown): Promise<CreateJobResponse> {
  const parsed = jobPostingSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: INVALID_JOB_ERROR };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: AUTH_ERROR };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { success: false, error: "Unable to load your profile. Please try again." };
  }

  if (!profile || profile.role !== "recruiter") {
    return { success: false, error: NOT_RECRUITER_ERROR };
  }

  const { data: job, error: insertError } = await supabase
    .from("job")
    .insert({
      recruiter_id: user.id,
      title: parsed.data.title,
      firm_name: parsed.data.firm_name,
      location: parsed.data.location,
      work_mode: parsed.data.work_mode,
      employment_type: parsed.data.employment_type,
      required_skills: parsed.data.required_skills,
      salary: parsed.data.salary,
      experience: parsed.data.experience,
      description: parsed.data.description,
      status: parsed.data.status,
    })
    .select(createdJobColumns)
    .single();

  // 42501 = blocked by row level security (not allowed to insert).
  if (insertError?.code === "42501") {
    return { success: false, error: NOT_RECRUITER_ERROR };
  }

  if (insertError || !job) {
    return { success: false, error: CREATE_JOB_ERROR };
  }

  return { success: true, job: job as CreatedJob };
}
