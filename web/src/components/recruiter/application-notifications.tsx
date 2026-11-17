"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Bell, CalendarCheck, CheckCheck, Mail, MailOpen } from "lucide-react";
import {
  markAllNotificationsReadAction,
  setNotificationReadAction,
} from "@/app/recruiter/notifications/actions";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/components/dashboard/dashboard-header";
import { getNotificationLink } from "@/lib/recruiter/notification-links";
import type { RecruiterNotification } from "@/lib/recruiter/notifications";
import { formatNotificationDate, formatNotificationTime } from "@/lib/recruiter/notification-time";

export type NotificationFilter = "all" | "unread" | "read";

const FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

const EMPTY_FILTER_MESSAGES: Record<NotificationFilter, string> = {
  all: "No notifications yet.",
  unread: "You're all caught up. No unread notifications.",
  read: "No read notifications yet.",
};

type RecruiterNotificationsListProps = {
  notifications: RecruiterNotification[];
  /** ISO time used for "3 hours ago", passed in so the server and browser agree. */
  now: string;
};

/** Tells the header bell to refresh its unread badge. */
function announceChange() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

/**
 * A recruiter's notifications (new applications, interview replies) with a read/unread
 * check on each one, an All/Unread/Read filter, and unread and total counts.
 */
export function RecruiterNotificationsList({ notifications, now }: RecruiterNotificationsListProps) {
  const [items, setItems] = useState(notifications);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const nowDate = new Date(now);

  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E3E6EB] bg-white p-8 text-center">
        <p className="font-bold text-[#0E1726]">No notifications yet.</p>
        <p className="mt-1 text-sm text-[#4B5563]">
          You&apos;ll be notified here when someone applies to one of your postings or answers an
          interview invitation.
        </p>
      </div>
    );
  }

  const unreadCount = items.filter((item) => !item.isRead).length;
  const counts: Record<NotificationFilter, number> = {
    all: items.length,
    unread: unreadCount,
    read: items.length - unreadCount,
  };
  const visible = items.filter((item) =>
    filter === "all" ? true : filter === "unread" ? !item.isRead : item.isRead,
  );

  function toggleRead(id: string, read: boolean) {
    const before = items;
    setError("");
    // Update right away, and put it back if the save fails.
    setItems((current) => current.map((item) => (item.id === id ? { ...item, isRead: read } : item)));

    startTransition(async () => {
      const result = await setNotificationReadAction(id, read);
      if (!result.success) {
        setItems(before);
        setError(result.error);
        return;
      }
      announceChange();
    });
  }

  function markAllRead() {
    const before = items;
    setError("");
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));

    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.success) {
        setItems(before);
        setError(result.error);
        return;
      }
      announceChange();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#4B5563]">
          Unread: <span data-testid="unread-count" className="text-[#1D4ED8]">{unreadCount}</span>
          <span aria-hidden="true"> · </span>
          Total: <span data-testid="total-count" className="text-[#0E1726]">{items.length}</span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filter notifications" className="flex rounded-xl border border-[#D9DEE5] bg-white p-1">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                  filter === value ? "bg-[#1D4ED8] text-white" : "text-[#4B5563] hover:bg-[#F5F6F8]"
                }`}
              >
                {label} ({counts[value]})
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0 || isPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#D9DEE5] bg-white px-3 text-sm font-semibold text-[#1F2937] transition-colors hover:bg-[#F5F6F8] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
          >
            <CheckCheck aria-hidden="true" className="size-4" />
            Mark all as read
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm font-medium text-[#B91C1C]">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#D9DEE5] bg-white px-4 py-8 text-center text-sm text-[#6B7280]">
          {EMPTY_FILTER_MESSAGES[filter]}
        </p>
      ) : (
        <ul aria-label="Notifications" className="flex flex-col gap-3">
          {visible.map((notification) => {
            const link = getNotificationLink(notification);
            const Icon = notification.interviewId ? CalendarCheck : Bell;

            return (
              <li
                key={notification.id}
                data-read={notification.isRead}
                className={`flex flex-col gap-3 rounded-2xl border p-5 shadow-[0_10px_30px_-22px_rgba(14,23,38,0.35)] sm:flex-row sm:items-center sm:justify-between ${
                  notification.isRead ? "border-[#E3E6EB] bg-white" : "border-[#C7D5FA] bg-[#F5F8FF]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                      notification.isRead ? "bg-[#F3F4F6] text-[#6B7280]" : "bg-[#E8EEFD] text-[#1D4ED8]"
                    }`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={notification.isRead ? "font-semibold text-[#1F2937]" : "font-bold text-[#0E1726]"}>
                        {notification.title}
                      </span>
                      {!notification.isRead && (
                        <span className="rounded-full bg-[#1D4ED8] px-2 py-0.5 text-xs font-bold text-white">New</span>
                      )}
                    </p>
                    {notification.message && <p className="mt-0.5 text-sm text-[#4B5563]">{notification.message}</p>}
                    <time
                      dateTime={notification.createdAt}
                      title={formatNotificationDate(notification.createdAt)}
                      className="mt-1 block font-mono text-xs text-[#6B7280]"
                    >
                      {formatNotificationTime(notification.createdAt, nowDate)}
                    </time>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRead(notification.id, !notification.isRead)}
                    disabled={isPending}
                    aria-label={`Mark "${notification.title}" as ${notification.isRead ? "unread" : "read"}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D9DEE5] bg-white px-3 text-sm font-semibold text-[#1F2937] transition-colors hover:bg-[#F5F6F8] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                  >
                    {notification.isRead ? (
                      <Mail aria-hidden="true" className="size-4" />
                    ) : (
                      <MailOpen aria-hidden="true" className="size-4" />
                    )}
                    {notification.isRead ? "Mark as unread" : "Mark as read"}
                  </button>

                  {link && (
                    <Link
                      href={link.href}
                      onClick={() => {
                        if (!notification.isRead) toggleRead(notification.id, true);
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#C7D5FA] bg-[#F3F6FE] px-3 text-sm font-semibold text-[#1D4ED8] transition-colors hover:bg-[#E8EEFD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                    >
                      {link.label}
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
