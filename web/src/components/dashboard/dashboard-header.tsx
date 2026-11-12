
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  Bell,
  Briefcase,
  CalendarDays,
  FileText,
  Home,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import DashboardLogoutButton from "@/components/dashboard/dashboard-logout-button";
import { createClient } from "@/lib/supabase/client";

type DashboardHeaderProps = {
  initials: string;
  activeHref?: string | null;
  navItems?: readonly NavItem[];
  logoHref?: string;
  profileHref?: string;
  profileLabel?: string;
  notificationsHref?: string;
  notificationsActive?: boolean;
  unreadCount?: number | null;
};

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  {
    href: "/application-status",
    label: "Applications",
    icon: ListChecks,
  },
  {
    href: "/interviews",
    label: "Interviews",
    icon: CalendarDays,
  },
  {
    href: "/upload-resume",
    label: "Resume",
    icon: FileText,
  },
];

export default function DashboardHeader({
  initials,
  activeHref = "/dashboard",
  navItems = NAV_ITEMS,
  logoHref = "/dashboard",
  profileHref = "/profile",
  profileLabel = "Your profile",
  notificationsHref = "/notifications",
  notificationsActive = false,
  unreadCount = null,
}: DashboardHeaderProps) {
  const [liveUnreadCount, setLiveUnreadCount] =
    useState<number | null>(null);

  const isJobSeekerNotifications =
    notificationsHref === "/notifications";

  const refreshUnreadCount = useCallback(async () => {
    if (!isJobSeekerNotifications) return;

    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setLiveUnreadCount(null);
      return;
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    if (error) {
      setLiveUnreadCount(null);
      return;
    }

    setLiveUnreadCount(count ?? 0);
  }, [isJobSeekerNotifications]);

  useEffect(() => {
    if (!isJobSeekerNotifications) return;

    // Schedule the initial fetch after the effect setup.
    // This avoids react-hooks/set-state-in-effect.
    const initialRefresh = window.setTimeout(() => {
      void refreshUnreadCount();
    }, 0);

    function handleFocus() {
      void refreshUnreadCount();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshUnreadCount();
      }
    }

    window.addEventListener("focus", handleFocus);

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearTimeout(initialRefresh);

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [isJobSeekerNotifications, refreshUnreadCount]);

  const displayedUnreadCount = isJobSeekerNotifications
    ? liveUnreadCount
    : unreadCount;

  const showUnreadBadge =
    displayedUnreadCount != null &&
    Number.isFinite(displayedUnreadCount) &&
    displayedUnreadCount > 0;

  return (
    <header className="sticky top-0 z-20 border-b border-[#E3E6EB] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
        <Link
          href={logoHref}
          className="flex items-center gap-2.5 rounded-lg text-[#0E1726] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
        >
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-[10px] bg-[#1D4ED8] text-base font-extrabold text-white"
          >
            C
          </span>

          <span className="text-lg font-extrabold tracking-tight">
            CareerConnect
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="order-3 w-full sm:order-none sm:w-auto sm:flex-1"
        >
          <ul className="flex items-center justify-between gap-1 sm:justify-center">
            {navItems.map(({ href, label, icon: Icon }) => {
              const current = href === activeHref;

              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={
                      current ? "page" : undefined
                    }
                    className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] sm:min-w-20 ${
                      current
                        ? "text-[#0E1726] shadow-[inset_0_-2px_0_#0E1726]"
                        : "text-[#4B5563] hover:text-[#0E1726]"
                    }`}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-5"
                    />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          {notificationsHref && (
            <Link
              href={notificationsHref}
              aria-label={
                showUnreadBadge
                  ? `Notifications, ${displayedUnreadCount} unread`
                  : "Notifications"
              }
              aria-current={
                notificationsActive ? "page" : undefined
              }
              title="Notifications"
              className={`relative flex size-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                notificationsActive
                  ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#3151D5]"
                  : "border-[#E3E6EB] bg-white text-[#4B5563] hover:border-[#C7D2FE] hover:bg-[#F3F6FF] hover:text-[#3151D5]"
              }`}
            >
              <Bell
                aria-hidden="true"
                className="size-5"
              />

              {showUnreadBadge && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#DC2626] px-1 text-[10px] font-bold leading-none text-white"
                >
                  {displayedUnreadCount! > 9
                    ? "9+"
                    : displayedUnreadCount}
                </span>
              )}
            </Link>
          )}

          <DashboardLogoutButton />

          <Link
            href={profileHref}
            aria-label={profileLabel}
            className="flex size-11 items-center justify-center rounded-full bg-[#0E1726] text-sm font-bold text-white transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
          >
            {initials}
          </Link>
        </div>
      </div>
    </header>
  );
}
