import { createClient } from "@/lib/supabase/server";
import { getSignedInRecruiter } from "@/lib/recruiter/applicants";

/** One "new application" notification for a recruiter. */
export type ApplicationNotification = {
  /** The application id; one notification per application. */
  id: string;
  jobId: string;
  jobTitle: string;
  applicantName: string | null;
  createdAt: string;
};

export type RecruiterNotificationsResponse =
  | { success: true; notifications: ApplicationNotification[] }
  | { success: false; error: string };

/** How many of the most recent notifications are shown. */
export const NOTIFICATION_LIMIT = 50;

export const NOTIFICATIONS_LOAD_ERROR = "Unable to load your notifications. Please try again.";

/**
 * Builds the recruiter's notifications from applications to their own job postings, newest first.
 * Read/unread is not stored yet; that needs a notifications table and will be added later.
 */
export async function getRecruiterNotifications(): Promise<RecruiterNotificationsResponse> {
  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);

  if (!recruiter.success) {
    return recruiter;
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("job")
    .select("id, title")
    .eq("recruiter_id", recruiter.userId);

  if (jobsError) {
    return { success: false, error: NOTIFICATIONS_LOAD_ERROR };
  }

  if (!jobs || jobs.length === 0) {
    return { success: true, notifications: [] };
  }

  const titles = new Map<string, string>(
    jobs.map((job): [string, string] => [job.id, job.title ?? ""]),
  );

  const { data: applications, error: applicationsError } = await supabase
    .from("applications")
    .select("id, job_id, created_at, profiles(full_name)")
    .in("job_id", [...titles.keys()])
    .order("created_at", { ascending: false })
    .limit(NOTIFICATION_LIMIT);

  if (applicationsError) {
    return { success: false, error: NOTIFICATIONS_LOAD_ERROR };
  }

  const notifications: ApplicationNotification[] = (applications ?? []).map((application) => {
    const profile = Array.isArray(application.profiles)
      ? application.profiles[0]
      : application.profiles;

    return {
      id: application.id,
      jobId: application.job_id,
      jobTitle: titles.get(application.job_id)?.trim() || "your job posting",
      applicantName: profile?.full_name?.trim() || null,
      createdAt: application.created_at,
    };
  });

  return { success: true, notifications };
}
