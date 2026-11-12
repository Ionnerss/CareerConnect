import type {
  CareerNotification,
  NotificationDataSource,
} from "@/components/notifications/notification-types";

import { createClient } from "@/lib/supabase/client";

type RelatedJob = {
  firm_name: string | null;
  title: string;
  deadline: string | null;
};

type NotificationRow = {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  application_id: string | null;
  interview_id: string | null;
  job_id: string | null;
  is_read: boolean;
  created_at: string;
  job: RelatedJob | null;
  application: {
    status: string;
    job: RelatedJob | null;
  } | null;
  interview: {
    scheduled_at: string;
    status: string;
    application: {
      job: RelatedJob | null;
    } | null;
  } | null;
};

function mapNotification(row: NotificationRow): CareerNotification {
  const job =
    row.application?.job ??
    row.interview?.application?.job ??
    row.job;

  const type = row.type.toLowerCase();

  const category =
    type.includes("interview")
      ? "interviews"
      : type.includes("deadline")
        ? "deadlines"
        : "applications";

  const href = row.interview_id
    ? "/application-status"
    : row.application_id
      ? "/application-status"
      : "/jobs";

  const actionLabel =
    row.interview_id
      ? "View interview"
      : row.application_id
        ? "View application"
        : "View job";

  return {
    id: row.id,
    recipientId: row.recipient_id,
    category,
    title: row.title,
    message: row.message,
    organization: job?.firm_name ?? job?.title ?? "CareerConnect",
    timestamp: row.created_at,
    read: row.is_read,
    href,
    actionLabel,
    deadline:
    category === "interviews" ? row.interview?.scheduled_at ?? undefined: category === "deadlines"? job?.deadline ?? undefined: undefined,
    status: row.application?.status ?? row.interview?.status ?? undefined,
    applicationId: row.application_id ?? undefined,
    jobId: row.job_id ?? undefined,
  };
}

export const notificationService: NotificationDataSource = {
  async getNotifications(recipientId: string): Promise<CareerNotification[]> {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error("You must be logged in to view notifications.");

    if (user.id !== recipientId) {
      throw new Error("You can only view your own notifications.");
    }

    const { data, error } = await supabase
      .from("notifications")
      .select(`
        id,
        recipient_id,
        type,
        title,
        message,
        application_id,
        interview_id,
        job_id,
        is_read,
        created_at,
        job:job (
          firm_name,
          title,
          deadline
        ),
        application:applications (
          status,
          job:job (
            firm_name,
            title,
            deadline
          )
        ),
        interview:interviews (
          scheduled_at,
          status,
          application:applications (
            job:job (
              firm_name,
              title,
              deadline
            )
          )
        )
      `)
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return ((data ?? []) as unknown as NotificationRow[]).map(
      mapNotification
    );
  },

  async setReadStatus(notificationId: string, read: boolean): Promise<void> {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error("You must be logged in.");

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: read,
        read_at: read ? new Date().toISOString() : null,
      })
      .eq("id", notificationId)
      .eq("recipient_id", user.id);

    if (error) throw error;
  },
};