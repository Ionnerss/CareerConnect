
"use client";

import { useState } from "react";
import Link from "next/link";

import type {
  CareerNotification,
  NotificationCategory,
  NotificationFilter,
} from "@/components/notifications/notification-types";

import { initialNotifications } from "@/lib/notifications/mock-notifications";

import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Inbox,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type Category = NotificationCategory;
type Filter = NotificationFilter;
type Notification = CareerNotification;

type SectionConfig = {
  category: Category;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  iconBackground: string;
};

const PAGE_SIZE = 3;

const sections: SectionConfig[] = [
  {
    category: "applications",
    title: "Application updates",
    subtitle: "Track the progress of your applications.",
    icon: BriefcaseBusiness,
    accent: "#3151D5",
    iconBackground: "#EEF2FF",
  },
  {
    category: "interviews",
    title: "Interview invitations",
    subtitle: "Your next conversations start here.",
    icon: CalendarCheck2,
    accent: "#7C3AED",
    iconBackground: "#F3E8FF",
  },
  {
    category: "deadlines",
    title: "Upcoming deadlines",
    subtitle: "Stay ahead of important dates.",
    icon: CalendarClock,
    accent: "#B97818",
    iconBackground: "#FFF4DF",
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

function DateTile({
  value,
  category,
}: {
  value: string;
  category: "interviews" | "deadlines";
}) {
  const date = new Date(value);

  const month = new Intl.DateTimeFormat("en-CA", {
    month: "short",
    timeZone: "America/Toronto",
  }).format(date);

  const day = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    timeZone: "America/Toronto",
  }).format(date);

  const isInterview = category === "interviews";

  return (
    <div
      className={`flex h-[76px] w-[70px] shrink-0 flex-col items-center justify-center rounded-2xl border ${
        isInterview
          ? "border-[#E9DDFB] bg-[#F8F3FF]"
          : "border-[#F4E2BE] bg-[#FFF9ED]"
      }`}
      aria-label={formatDate(value)}
    >
      <span
        className={`text-[10px] font-extrabold uppercase tracking-[0.12em] ${
          isInterview ? "text-[#7C3AED]" : "text-[#B97818]"
        }`}
      >
        {month}
      </span>

      <span className="mt-0.5 text-[28px] font-extrabold leading-none tracking-tight text-[#0E1726]">
        {day}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  description,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3.5 transition-colors hover:bg-white/[0.11] sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#CBD5E1]">
          {label}
        </span>

        <Icon
          className="h-4 w-4 text-[#A9C1FF]"
          aria-hidden="true"
        />
      </div>

      <div className="mt-2 flex items-end gap-3">
        <p className="text-[32px] font-extrabold leading-none tracking-tight text-white">
          {value}
        </p>

        <p className="pb-0.5 text-[11px] text-[#9EADC2]">
          {description}
        </p>
      </div>
    </div>
  );
}

function NotificationCard({
  notification,
  onToggleRead,
}: {
  notification: Notification;
  onToggleRead: (id: string) => void;
}) {
  const isInterview = notification.category === "interviews";
  const isDeadline = notification.category === "deadlines";
  const isApplication = notification.category === "applications";

  const Icon = isInterview
    ? CalendarCheck2
    : isDeadline
      ? CalendarClock
      : BriefcaseBusiness;

  const accent = isInterview
    ? "#7C3AED"
    : isDeadline
      ? "#B97818"
      : "#3151D5";

  const iconBackground = isInterview
    ? "#F3E8FF"
    : isDeadline
      ? "#FFF4DF"
      : "#EEF2FF";

  return (
    <article
      className={`group relative rounded-2xl border p-4 transition-all duration-200 hover:border-[#C7D2E5] hover:shadow-[0_8px_24px_rgba(14,23,38,0.055)] ${
        notification.read
          ? "border-[#E8EBF0] bg-white"
          : "border-[#CCD7FF] bg-[#FAFBFF]"
      }`}
    >
      <div className="flex items-start gap-3">
        {notification.deadline &&
        (isInterview || isDeadline) ? (
          <DateTile
            value={notification.deadline}
            category={isInterview ? "interviews" : "deadlines"}
          />
        ) : (
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: iconBackground }}
          >
            <Icon
              className="h-5 w-5"
              style={{ color: accent }}
              aria-hidden="true"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#718096]">
              {notification.organization}
            </span>

            {!notification.read && (
              <span className="rounded-full bg-[#E9EEFF] px-2 py-0.5 text-[10px] font-bold text-[#3151D5]">
                NEW
              </span>
            )}
          </div>

          <h3 className="mt-1 text-[15px] font-extrabold leading-snug text-[#0E1726]">
            {notification.title}
          </h3>

          <p className="mt-1.5 text-[13px] leading-[1.65] text-[#607086]">
            {notification.message}
          </p>

          {notification.deadline && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                  isInterview
                    ? "bg-[#F3E8FF] text-[#6D28D9]"
                    : "bg-[#FFF4DF] text-[#986012]"
                }`}
              >
                <Clock3 className="h-3.5 w-3.5" />
                {isInterview ? "Interview" : "Due"} ·{" "}
                {formatTime(notification.deadline)}
              </span>
            </div>
          )}

          {isApplication && notification.status && (
            <div className="mt-2.5">
              <span className="inline-flex rounded-full border border-[#DAE3F5] bg-white px-2.5 py-1 text-[11px] font-bold text-[#475569]">
                {notification.status}
              </span>
            </div>
          )}
        </div>

        {!notification.read && (
          <span
            aria-label="Unread notification"
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#3151D5] ring-4 ring-[#E8EDFF]"
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#E9EDF4] pt-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8290A4]">
          <Clock3
            className="h-3.5 w-3.5"
            aria-hidden="true"
          />

          <time dateTime={notification.timestamp}>
            Posted {formatDate(notification.timestamp)}
          </time>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleRead(notification.id)}
            aria-label={
              notification.read
                ? `Mark ${notification.title} as unread`
                : `Mark ${notification.title} as read`
            }
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#64748B] transition-colors hover:bg-[#EEF2F8] hover:text-[#0E1726] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3151D5]"
          >
            {notification.read ? (
              <Circle className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}

            {notification.read ? "Mark unread" : "Mark read"}
          </button>

          <Link
            href={notification.href}
            className="inline-flex items-center gap-1 text-xs font-extrabold text-[#3151D5] transition-colors hover:text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3151D5]"
          >
            {notification.actionLabel}

            <ArrowUpRight
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}

function NotificationSection({
  config,
  notifications,
  onToggleRead,
}: {
  config: SectionConfig;
  notifications: Notification[];
  onToggleRead: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  const Icon = config.icon;

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  const readCount = notifications.length - unreadCount;

  const filtered = notifications.filter((notification) => {
    if (filter === "unread") return !notification.read;
    if (filter === "read") return notification.read;
    return true;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);

  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function changeFilter(nextFilter: Filter) {
    setFilter(nextFilter);
    setPage(1);
  }

  return (
    <section
      id={config.category}
      aria-labelledby={`${config.category}-heading`}
      className="scroll-mt-24 rounded-[24px] border border-[#E3E8F0] bg-white p-4 shadow-[0_8px_30px_rgba(14,23,38,0.035)] sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: config.iconBackground }}
          >
            <Icon
              className="h-5 w-5"
              style={{ color: config.accent }}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2
              id={`${config.category}-heading`}
              className="text-lg font-extrabold tracking-tight text-[#0E1726]"
            >
              {config.title}
            </h2>

            <p className="mt-1 text-[13px] text-[#718096]">
              {config.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#F2F4F8] px-3 py-1.5 text-xs font-bold text-[#475569]">
            {notifications.length} total
          </span>

          {unreadCount > 0 && (
            <span className="rounded-full bg-[#E9EEFF] px-3 py-1.5 text-xs font-bold text-[#3151D5]">
              {unreadCount} unread
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF0F5] pb-4">
        <div
          role="group"
          aria-label={`${config.title} filter`}
          className="inline-flex flex-wrap gap-1 rounded-xl bg-[#F4F6FA] p-1"
        >
          {(["all", "unread", "read"] as const).map(
            (option) => {
              const active = filter === option;

              const count =
                option === "all"
                  ? notifications.length
                  : option === "unread"
                    ? unreadCount
                    : readCount;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => changeFilter(option)}
                  aria-pressed={active}
                  className={`rounded-lg px-3 py-2 text-xs font-bold capitalize transition-all sm:px-3.5 ${
                    active
                      ? "bg-white text-[#0E1726] shadow-sm"
                      : "text-[#7B8798] hover:text-[#0E1726]"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {option}

                    <span
                      className={
                        active
                          ? "text-[#3151D5]"
                          : "text-[#94A3B8]"
                      }
                    >
                      ({count})
                    </span>
                  </span>
                </button>
              );
            }
          )}
        </div>

        <span className="text-xs font-medium text-[#8A96A7]">
          Showing {visible.length} of {filtered.length}
        </span>
      </div>

      {visible.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {visible.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onToggleRead={onToggleRead}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F4FA]">
            <Inbox
              className="h-6 w-6 text-[#92A0B5]"
              aria-hidden="true"
            />
          </div>

          <h3 className="mt-4 text-sm font-bold text-[#334155]">
            All caught up
          </h3>

          <p className="mt-1 max-w-xs text-sm text-[#8A96A7]">
            {filter === "unread"
              ? "No unread notifications in this category."
              : filter === "read"
                ? "You haven't read any notifications here yet."
                : "New notifications will appear here."}
          </p>
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F5] pt-4">
          <span className="text-xs font-medium text-[#8290A4]">
            Page {currentPage} of {totalPages}
          </span>

          <nav
            aria-label={`${config.title} pagination`}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label={`Previous ${config.title} page`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E0E6EF] text-[#475569] transition-colors hover:bg-[#F2F5FB] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#3151D5] px-3 text-xs font-bold text-white">
              {currentPage}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label={`Next ${config.title} page`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E0E6EF] text-[#475569] transition-colors hover:bg-[#F2F5FB] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      )}
    </section>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(
    initialNotifications
  );

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  const interviewCount = notifications.filter(
    (notification) =>
      notification.category === "interviews"
  ).length;

  const deadlineCount = notifications.filter(
    (notification) =>
      notification.category === "deadlines"
  ).length;

  function toggleRead(id: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, read: !notification.read }
          : notification
      )
    );
  }

  function markAllRead() {
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read: true,
      }))
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F6F8] pb-16">
      {/* Compact hero */}
      <section className="relative overflow-hidden bg-[#0E1726] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-44 h-[430px] w-[430px] rounded-full border border-white/10"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-28 h-[310px] w-[310px] rounded-full border border-white/10"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-12 top-0 h-[180px] w-[180px] rounded-full bg-[#3151D5]/20 blur-3xl"
        />

        <div className="relative mx-auto max-w-[1200px] px-4 pb-20 pt-7 sm:px-6 sm:pt-9">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#ADBBD0] transition-colors hover:text-white"
          >
            <ArrowLeft
              className="h-4 w-4"
              aria-hidden="true"
            />
            Back to dashboard
          </Link>

          <div className="mt-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#9DB7FF]">
                <Sparkles className="h-3.5 w-3.5" />
                CareerConnect / Signal Center
              </div>

              <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[42px]">
                Stay in the loop
                <span className="text-[#A9C1FF]">.</span>
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-7 text-[#B7C4D8]">
                Every application update, interview invitation,
                and important deadline — organized around
                your next opportunity.
              </p>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Unread notifications"
              value={unreadCount}
              icon={Bell}
              description="Need your attention"
            />

            <StatCard
              label="Interview invitations"
              value={interviewCount}
              icon={CalendarCheck2}
              description="Total received"
            />

            <StatCard
              label="Deadline reminders"
              value={deadlineCount}
              icon={CalendarClock}
              description="Total reminders"
            />
          </div>
        </div>
      </section>

      {/* Notification overview */}
      <div className="relative z-10 mx-auto -mt-11 max-w-[1200px] px-4 sm:px-6">
        <div className="rounded-[24px] border border-[#E5EAF1] bg-white px-5 py-4 shadow-[0_10px_35px_rgba(14,23,38,0.07)] sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8290A4]">
                Your activity
              </p>

              <h2 className="mt-1 text-lg font-extrabold text-[#0E1726]">
                Notification overview
              </h2>
            </div>

            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-[#DCE4F0] bg-white px-4 py-2.5 text-xs font-bold text-[#3151D5] transition-colors hover:bg-[#F3F6FF] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck
                className="h-4 w-4"
                aria-hidden="true"
              />
              Mark all as read
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {sections.map((section) => {
              const Icon = section.icon;

              const count = notifications.filter(
                (item) =>
                  item.category === section.category &&
                  !item.read
              ).length;

              return (
                <a
                  key={section.category}
                  href={`#${section.category}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#E8ECF3] bg-[#FAFBFE] px-3 py-3 transition-all hover:border-[#CBD5E1] hover:bg-[#F3F6FD]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={{ color: section.accent }}
                      aria-hidden="true"
                    />

                    <span className="truncate text-xs font-semibold text-[#475569]">
                      {section.title}
                    </span>
                  </span>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                      count > 0
                        ? "bg-[#E9EEFF] text-[#3151D5]"
                        : "bg-[#EDF5F0] text-[#387A55]"
                    }`}
                  >
                    {count > 0
                      ? `${count} unread`
                      : "All read"}
                  </span>
                </a>
              );
            })}
          </div>
        </div>

        {/* Independent notification sections */}
        <div className="mt-6 space-y-5">
          {sections.map((config) => (
            <NotificationSection
              key={config.category}
              config={config}
              notifications={notifications.filter(
                (notification) =>
                  notification.category === config.category
              )}
              onToggleRead={toggleRead}
            />
          ))}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-[#94A0B1]">
          <Check className="h-3.5 w-3.5" />
          You&apos;re in control of your next opportunity.
        </div>
      </div>
    </main>
  );
}
