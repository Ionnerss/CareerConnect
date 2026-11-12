
"use client";

import { usePathname } from "next/navigation";
import { CalendarClock, Users } from "lucide-react";

import DashboardHeader, {
  NAV_ITEMS,
  type NavItem,
} from "@/components/dashboard/dashboard-header";

import {
  ROLE_HOME_PATH,
  type LoginRole,
} from "@/lib/auth/roles";

export const RECRUITER_NAV_ITEMS: readonly NavItem[] = [
  { href: "/recruiter/jobs", label: "Job postings", icon: Users },
  { href: "/recruiter/interviews", label: "Interviews", icon: CalendarClock },
];

const MENUS: Record<LoginRole, readonly NavItem[]> = {
  job_seeker: NAV_ITEMS,
  recruiter: RECRUITER_NAV_ITEMS,
};

export default function AppHeader({
  initials,
  role = "job_seeker",
}: {
  initials: string;
  role?: LoginRole;
}) {
  const pathname = usePathname() ?? "";
  const navItems = MENUS[role];

  const active =
    navItems.find(
      ({ href }) =>
        pathname === href ||
        pathname.startsWith(`${href}/`),
    )?.href ?? null;

  const notificationsHref =
    role === "recruiter"
      ? "/recruiter/notifications"
      : "/notifications";

  return (
    <DashboardHeader
      initials={initials}
      activeHref={active}
      navItems={navItems}
      logoHref={ROLE_HOME_PATH[role]}
      profileHref={
        role === "recruiter"
          ? "/recruiter/account"
          : "/profile"
      }
      profileLabel={
        role === "recruiter"
          ? "Your account"
          : "Your profile"
      }
      notificationsHref={notificationsHref}
      notificationsActive={
        pathname === notificationsHref ||
        pathname.startsWith(`${notificationsHref}/`)
      }
    />
  );
}
