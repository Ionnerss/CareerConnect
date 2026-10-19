"use client";

import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import DashboardHeader, {
  NAV_ITEMS,
  type NavItem,
} from "@/components/dashboard/dashboard-header";
import { ROLE_HOME_PATH, type LoginRole } from "@/lib/auth/roles";

/** Recruiter menu. Add entries here as recruiter pages are built. */
export const RECRUITER_NAV_ITEMS: readonly NavItem[] = [
  { href: "/recruiter/jobs", label: "Job postings", icon: Users },
];

/** Menu per kind of account. The role comes from `profiles.role`. */
const MENUS: Record<LoginRole, readonly NavItem[]> = {
  job_seeker: NAV_ITEMS,
  recruiter: RECRUITER_NAV_ITEMS,
};

/**
 * The signed-in header with the current section highlighted. Reads the URL on
 * the client so the shared layout does not need to know which page it wraps.
 */
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
      ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
    )?.href ?? null;

  return (
    <DashboardHeader
      initials={initials}
      activeHref={active}
      navItems={navItems}
      logoHref={ROLE_HOME_PATH[role]}
      profileHref={role === "recruiter" ? "/recruiter/account" : "/profile"}
      profileLabel={role === "recruiter" ? "Your account" : "Your profile"}
    />
  );
}
