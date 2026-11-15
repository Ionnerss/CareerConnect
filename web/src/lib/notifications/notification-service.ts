
import { createClient } from "@/lib/supabase/client";

import type {
  CareerNotification,
  NotificationDataSource,
} from "@/components/notifications/notification-types";

import { getSeekerNotificationLink } from "@/lib/notifications/notification-links";

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
  deadline_at: string | null;
  dismissed_at: string | null;
};

export function mapNotification(
  row: NotificationRow
): CareerNotification {
  const category: CareerNotification["category"] =
    row.type.includes("deadline")
      ? "deadlines"
      : row.type.includes("interview")
        ? "interviews"
        : "applications";

  const link = getSeekerNotificationLink({
    type: row.type,
    applicationId: row.application_id,
    interviewId: row.interview_id,
  });

  return {
    id: row.id,
    recipientId: row.recipient_id,
    category,
    title: row.title,
    message: row.message,
    organization: "CareerConnect",
    timestamp: row.created_at,
    read: row.is_read,
    href: link.href,
    actionLabel: link.label,
    applicationId: row.application_id ?? undefined,
    interviewId: row.interview_id ?? undefined,
    jobId: row.job_id ?? undefined,
    deadline: row.deadline_at ?? undefined,
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
        "id, recipient_id, type, title, message, application_id, interview_id, job_id, is_read, created_at, deadline_at, dismissed_at"
      )
      .eq("recipient_id", user.id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to load notifications:", error);
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

    const { data, error } = await supabase
      .from("notifications")
      .update({
        is_read: read,
        read_at: read ? new Date().toISOString() : null,
      })
      .eq("id", notificationId)
      .eq("recipient_id", user.id)
      .is("dismissed_at", null)
      .select("id, is_read");

    if (error) {
      console.error("Notification update failed:", error);
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      throw new Error("Notification was not updated.");
    }
  },
};

export async function dismissNotifications(
  notificationIds: string[]
): Promise<void> {
  if (notificationIds.length === 0) return;

  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({
      dismissed_at: new Date().toISOString(),
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .in("id", notificationIds)
    .eq("recipient_id", user.id)
    .is("dismissed_at", null)
    .select("id");

  if (error) {
    console.error("Notification dismissal failed:", error);
    throw new Error(error.message);
  }

  if (!data || data.length !== notificationIds.length) {
    console.warn(
      "Some notifications were not dismissed:",
      notificationIds
    );
  }
}

export function subscribeToNotifications(
  recipientId: string,
  onNotification: (notification: CareerNotification) => void
) {
  const supabase = createClient();

  const channel = supabase
    .channel(`notifications-${recipientId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${recipientId}`,
      },
      (payload) => {
        const row = payload.new as NotificationRow;

        if (
          row.recipient_id !== recipientId ||
          row.dismissed_at !== null
        ) {
          return;
        }

        onNotification(mapNotification(row));
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${recipientId}`,
      },
      (payload) => {
        const row = payload.new as NotificationRow;

        if (row.recipient_id !== recipientId) return;

        if (row.dismissed_at !== null) return;

        onNotification(mapNotification(row));
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
