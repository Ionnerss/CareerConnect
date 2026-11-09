import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import type { ApplicationNotification } from "@/lib/recruiter/notifications";
import {
  formatNotificationDate,
  formatNotificationTime,
} from "@/lib/recruiter/notification-time";

type ApplicationNotificationsProps = {
  notifications: ApplicationNotification[];
  /** Passed in so the relative times ("3 hours ago") can be tested. */
  now: Date;
};

/** List of "new application" notifications for a recruiter, newest first. */
export function ApplicationNotifications({ notifications, now }: ApplicationNotificationsProps) {
  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E3E6EB] bg-white p-8 text-center">
        <p className="font-bold text-[#0E1726]">No notifications yet.</p>
        <p className="mt-1 text-sm text-[#4B5563]">
          You&apos;ll see a notification here when a job seeker applies to one of your postings.
        </p>
      </div>
    );
  }

  return (
    <ul
      aria-label="Notifications"
      className="divide-y divide-[#EEF0F3] overflow-hidden rounded-2xl border border-[#E3E6EB] bg-white"
    >
      {notifications.map((notification) => (
        <li key={notification.id} className="flex flex-wrap items-start gap-3 p-4 sm:flex-nowrap">
          <span
            aria-hidden="true"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E8EEFD] text-[#1D4ED8]"
          >
            <Bell className="size-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm text-[#1F2937]">
              <span className="font-bold text-[#0E1726]">
                {notification.applicantName ?? "A candidate"}
              </span>{" "}
              applied for your{" "}
              <span className="font-bold text-[#0E1726]">{notification.jobTitle}</span> position.
            </p>
            <time
              dateTime={notification.createdAt}
              title={formatNotificationDate(notification.createdAt)}
              className="mt-0.5 block text-xs text-[#6B7280]"
            >
              {formatNotificationTime(notification.createdAt, now)}
            </time>
          </div>

          <Link
            href={`/recruiter/jobs/${notification.jobId}/applicants`}
            aria-label={`View applicants for ${notification.jobTitle}`}
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#1D4ED8] hover:text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
          >
            View applicants
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
