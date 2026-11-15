// Pure helper shared by the server and the browser. Keep it free of server-only imports
// (like the Supabase server client) so client components can use it.

import type { RecruiterNotification } from "./notifications";

/**
 * Where a notification's link goes, or null when there is nothing to open.
 * Links end with an #anchor so the page scrolls to (and highlights) the exact
 * interview or applicant row the notification is about.
 */
export function getNotificationLink(
  notification: Pick<RecruiterNotification, "type" | "interviewId" | "jobId"> &
    Partial<Pick<RecruiterNotification, "applicationId">>,
): { href: string; label: string } | null {
  if (notification.interviewId || notification.type.startsWith("interview")) {
    const anchor = notification.interviewId ? `#interview-${notification.interviewId}` : "";
    return { href: `/recruiter/interviews${anchor}`, label: "View interview" };
  }
  if (notification.jobId) {
    const anchor = notification.applicationId ? `#applicant-${notification.applicationId}` : "";
    return {
      href: `/recruiter/jobs/${notification.jobId}/applicants${anchor}`,
      label: notification.applicationId ? "View applicant" : "View applicants",
    };
  }
  return null;
}
