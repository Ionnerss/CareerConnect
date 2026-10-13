import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type RecruiterJob = {
  id: string;
  title: string;
  location: string;
  status: string;
  created_at: string;
  applicant_count: number;
};

export type JobApplicant = {
  application_id: string;
  applicant_id: string;
  full_name: string | null;
  status: string;
  applied_at: string;
};

type Failure = { success: false; error: string };

export type RecruiterJobsResponse = { success: true; jobs: RecruiterJob[] } | Failure;

export type JobApplicantsResponse =
  | {
      success: true;
      job: { id: string; title: string; location: string; status: string };
      applicants: JobApplicant[];
    }
  | Failure;

export const AUTH_ERROR = "Unable to authenticate. Please sign in again.";
export const NOT_RECRUITER_ERROR = "Only recruiters can view applicants.";
export const JOB_NOT_FOUND_ERROR = "Job posting not found.";

const jobIdSchema = z.uuid();

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Signs in the current user and confirms they have the recruiter role. */
async function getSignedInRecruiter(
  supabase: SupabaseClient
): Promise<{ success: true; userId: string } | Failure> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
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

  return { success: true, userId: user.id };
}

/** Lists the signed-in recruiter's own job postings with how many people applied to each. */
export async function getRecruiterJobs(): Promise<RecruiterJobsResponse> {
  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);

  if (!recruiter.success) {
    return recruiter;
  }

  const { data, error } = await supabase
    .from("job")
    .select("id, title, location, status, created_at, applications(count)")
    .eq("recruiter_id", recruiter.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: "Unable to load your job postings. Please try again." };
  }

  const jobs: RecruiterJob[] = (data ?? []).map((job) => ({
    id: job.id,
    title: job.title,
    location: job.location,
    status: job.status,
    created_at: job.created_at,
    applicant_count: job.applications?.[0]?.count ?? 0,
  }));

  return { success: true, jobs };
}

/**
 * Lists everyone who applied to one of the recruiter's postings, oldest application first.
 * A recruiter can only see applicants for postings they created.
 */
export async function getJobApplicants(jobId: unknown): Promise<JobApplicantsResponse> {
  const parsedJobId = jobIdSchema.safeParse(jobId);

  if (!parsedJobId.success) {
    return { success: false, error: JOB_NOT_FOUND_ERROR };
  }

  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);

  if (!recruiter.success) {
    return recruiter;
  }

  const { data: job, error: jobError } = await supabase
    .from("job")
    .select("id, title, location, status")
    .eq("id", parsedJobId.data)
    .eq("recruiter_id", recruiter.userId)
    .maybeSingle();

  if (jobError) {
    return { success: false, error: "Unable to load this job posting. Please try again." };
  }

  if (!job) {
    return { success: false, error: JOB_NOT_FOUND_ERROR };
  }

  const { data: applications, error: applicationsError } = await supabase
    .from("applications")
    .select("id, applicant_id, status, created_at, profiles(full_name)")
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });

  if (applicationsError) {
    return { success: false, error: "Unable to load applicants. Please try again." };
  }

  const applicants: JobApplicant[] = (applications ?? []).map((application) => {
    const profile = Array.isArray(application.profiles)
      ? application.profiles[0]
      : application.profiles;

    return {
      application_id: application.id,
      applicant_id: application.applicant_id,
      full_name: profile?.full_name ?? null,
      status: application.status,
      applied_at: application.created_at,
    };
  });

  return { success: true, job, applicants };
}

const STATUS_LABELS: Record<string, string> = {
  applied: "Applied",
  under_review: "Under review",
  interview: "Interview",
  offered: "Offered",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/** Turns a stored status like "under_review" into "Under review". */
export function formatApplicationStatus(status: string): string {
  if (STATUS_LABELS[status]) {
    return STATUS_LABELS[status];
  }

  const words = status.replace(/_/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Unknown";
}
