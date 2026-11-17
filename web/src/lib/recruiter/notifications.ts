import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSignedInRecruiter } from "@/lib/recruiter/applicants";

/**
 * One row of the notifications table sent to a recruiter. The database creates them:
 * a new application to one of their postings, or an applicant accepting/declining an interview.
 */
export type RecruiterNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  jobId: string | null;
  applicationId: string | null;
  interviewId: string | null;
};

type Failure = { success: false; error: string };

export type RecruiterNotificationsResponse =
  | { success: true; notifications: RecruiterNotification[] }
  | Failure;

export type NotificationUpdateResult = { success: true } | Failure;

/** Newest notifications shown on the page. */
export const NOTIFICATION_LIMIT = 50;
export const NOTIFICATIONS_LOAD_ERROR = "Unable to load your notifications. Please try again.";
export const NOTIFICATION_UPDATE_ERROR = "Unable to update the notification. Please try again.";
export const NOTIFICATION_NOT_FOUND_ERROR = "This notification was not found.";

const idSchema = z.uuid();

type NotificationRow = {
  id: string;
  type: string;
  title: string | null;
  message: string | null;
  created_at: string;
  is_read: boolean | null;
  job_id: string | null;
  application_id: string | null;
  interview_id: string | null;
};

function toRecruiterNotification(row: NotificationRow): RecruiterNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title?.trim() || "Notification",
    message: row.message?.trim() || "",
    createdAt: row.created_at,
    isRead: row.is_read === true,
    jobId: row.job_id,
    applicationId: row.application_id,
    interviewId: row.interview_id,
  };
}

/** The signed-in recruiter's notifications, newest first. */
export async function getRecruiterNotifications(): Promise<RecruiterNotificationsResponse> {
  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);
  if (!recruiter.success) return recruiter;

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, created_at, is_read, job_id, application_id, interview_id")
    .eq("recipient_id", recruiter.userId)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATION_LIMIT);

  if (error) return { success: false, error: NOTIFICATIONS_LOAD_ERROR };

  return {
    success: true,
    notifications: ((data ?? []) as NotificationRow[]).map(toRecruiterNotification),
  };
}

/** Marks one of the recruiter's own notifications as read or unread. */
export async function setNotificationRead(
  notificationId: unknown,
  read: boolean,
  now: Date = new Date(),
): Promise<NotificationUpdateResult> {
  const parsedId = idSchema.safeParse(notificationId);
  if (!parsedId.success) return { success: false, error: NOTIFICATION_NOT_FOUND_ERROR };

  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);
  if (!recruiter.success) return recruiter;

  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: read === true, read_at: read === true ? now.toISOString() : null })
    .eq("id", parsedId.data)
    .eq("recipient_id", recruiter.userId)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: NOTIFICATION_UPDATE_ERROR };
  if (!data) return { success: false, error: NOTIFICATION_NOT_FOUND_ERROR };

  return { success: true };
}

/** Marks every unread notification of the recruiter as read. */
export async function markAllNotificationsRead(now: Date = new Date()): Promise<NotificationUpdateResult> {
  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);
  if (!recruiter.success) return recruiter;

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: now.toISOString() })
    .eq("recipient_id", recruiter.userId)
    .eq("is_read", false);

  if (error) return { success: false, error: NOTIFICATION_UPDATE_ERROR };

  return { success: true };
}
