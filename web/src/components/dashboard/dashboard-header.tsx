import Link from "next/link";
import { Briefcase, FileText, Home, ListChecks, type LucideIcon } from "lucide-react";
import DashboardLogoutButton from "@/components/dashboard/dashboard-logout-button";

type DashboardHeaderProps = {
  initials: string;
  /** Which nav link to highlight. Defaults to the dashboard; pass null for pages not in the nav. */
  activeHref?: string | null;
  /** Menu links. Defaults to the job seeker menu; recruiters pass their own. */
  navItems?: readonly NavItem[];
  /** Where the logo goes. Defaults to the job seeker dashboard. */
  logoHref?: string;
  /** Where your avatar goes, and its accessible name. Defaults to the job seeker profile. */
  profileHref?: string;
  profileLabel?: string;
};

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Job seeker menu. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/application-status", label: "Applications", icon: ListChecks },
  { href: "/upload-resume", label: "Resume", icon: FileText },
];

/** Top bar: logo left, main links in the middle, your avatar and log out on the right. */
export default function DashboardHeader({
  initials,
  activeHref = "/dashboard",
  navItems = NAV_ITEMS,
  logoHref = "/dashboard",
  profileHref = "/profile",
  profileLabel = "Your profile",
}: DashboardHeaderProps) {
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
          <span className="text-lg font-extrabold tracking-tight">CareerConnect</span>
        </Link>

        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
          <ul className="flex items-center justify-between gap-1 sm:justify-center">
            {navItems.map(({ href, label, icon: Icon }) => {
              const current = href === activeHref;

              return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] sm:min-w-20 ${
                    current
                      ? "text-[#0E1726] shadow-[inset_0_-2px_0_#0E1726]"
                      : "text-[#4B5563] hover:text-[#0E1726]"
                  }`}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  <span>{label}</span>
                </Link>
              </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
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
