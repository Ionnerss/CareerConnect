// Pure helper shared by the server and the browser. Keep it free of server-only imports
// (like the Supabase server client) so client components can use it.

import type { RecruiterNotification } from "./notifications";

/** Where a notification's link goes, or null when there is nothing to open. */
export function getNotificationLink(
  notification: Pick<RecruiterNotification, "type" | "interviewId" | "jobId">,
): { href: string; label: string } | null {
  if (notification.interviewId || notification.type.startsWith("interview")) {
    return { href: "/recruiter/interviews", label: "View interviews" };
  }
  if (notification.jobId) {
    return { href: `/recruiter/jobs/${notification.jobId}/applicants`, label: "View applicants" };
  }
  return null;
}
