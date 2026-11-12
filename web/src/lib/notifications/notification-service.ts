
import { createClient } from "@/lib/supabase/client";

import type {
  CareerNotification,
  NotificationDataSource,
} from "@/components/notifications/notification-types";

type NotificationRow = {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  application_id: string | null;
  job_id: string | null;
  is_read: boolean;
  created_at: string;
};

function mapNotification(
  row: NotificationRow
): CareerNotification {
  const category: CareerNotification["category"] =
    row.type.includes("interview")
      ? "interviews"
      : row.type.includes("deadline")
        ? "deadlines"
        : "applications";

  return {
    id: row.id,
    recipientId: row.recipient_id,
    category,
    title: row.title,
    message: row.message,
    organization: "CareerConnect",
    timestamp: row.created_at,
    read: row.is_read,
    href: "/application-status",
    actionLabel: "View application",
    applicationId: row.application_id ?? undefined,
    jobId: row.job_id ?? undefined,
  };
}

export const notificationService: NotificationDataSource = {
  async getNotifications(
    recipientId: string
  ): Promise<CareerNotification[]> {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || user.id !== recipientId) {
      throw new Error("Unable to verify notification recipient.");
    }

    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, recipient_id, type, title, message, application_id, job_id, is_read, created_at"
      )
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("Unable to load notifications.");
    }

    return (data as NotificationRow[]).map(mapNotification);
  },

  async setReadStatus(
    notificationId: string,
    read: boolean
  ): Promise<void> {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("You must be signed in.");
    }

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: read,
        read_at: read ? new Date().toISOString() : null,
      })
      .eq("id", notificationId)
      .eq("recipient_id", user.id);

    if (error) {
      throw new Error("Unable to update notification status.");
    }
  },
};
