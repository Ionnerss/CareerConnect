import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";
import {
  formatAppliedDate,
  getCompanyTileIndex,
  getStatusLabel,
  getStatusTone,
  type StatusTone,
} from "@/lib/dashboard/summary";

type DashboardApplicationsProps = {
  applications: ApplicationCardData[];
  loadError: boolean;
  now: Date;
};

const RECENT_LIMIT = 5;

// Two-tone letter tiles, picked per company so the same company keeps its colour.
const TILE_STYLES = [
  "bg-[#E8EEFD] text-[#1E40AF]",
  "bg-[#FEF3E2] text-[#92400E]",
  "bg-[#E3F6EE] text-[#065F46]",
  "bg-[#F1EAFE] text-[#5B21B6]",
  "bg-[#FDE8E8] text-[#9B1C1C]",
  "bg-[#E0F2F7] text-[#155E75]",
];

const STATUS_STYLES: Record<StatusTone, string> = {
  progress: "bg-[#E8EEFD] text-[#1D4ED8]",
  interview: "bg-[#FEF3E2] text-[#B45309]",
  offer: "bg-[#E3F6EE] text-[#047857]",
  rejected: "bg-[#F1F2F4] text-[#4B5563]",
  unknown: "bg-[#F1F2F4] text-[#4B5563]",
};

/** Latest applications with status pills. Shows an empty state or an error note when needed. */
export default function DashboardApplications({
  applications,
  loadError,
  now,
}: DashboardApplicationsProps) {
  const recent = applications.slice(0, RECENT_LIMIT);

  return (
    <section
      aria-labelledby="recent-applications-heading"
      className="overflow-hidden rounded-2xl border border-[#E3E6EB] bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E6EB] px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 id="recent-applications-heading" className="text-lg font-bold text-[#0E1726]">
            Recent applications
          </h2>
          {applications.length > 0 && (
            <span className="rounded-full bg-[#F1F2F4] px-2 py-0.5 font-mono text-xs font-semibold text-[#374151]">
              {applications.length}
            </span>
          )}
        </div>
        {applications.length > 0 && (
          <Link
            href="/application-status"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-[#1D4ED8] hover:text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
          >
            View all
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>

      {loadError ? (
        <p role="alert" className="px-5 py-8 text-center text-sm text-[#9B1C1C]">
          We couldn&apos;t load your applications. Please refresh the page.
        </p>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#E8EEFD] text-[#1D4ED8]">
            <Briefcase aria-hidden="true" className="size-6" />
          </span>
          <p className="font-semibold text-[#0E1726]">You haven&apos;t applied to any jobs yet.</p>
          <p className="max-w-sm text-sm text-[#4B5563]">
            When you apply, each application shows up here with its latest status.
          </p>
          <Link
            href="/jobs"
            className="mt-1 inline-flex h-11 items-center rounded-lg bg-[#1D4ED8] px-5 text-sm font-bold text-white hover:bg-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
          >
            Browse jobs
          </Link>
        </div>
      ) : (
        <ul>
          {recent.map((application) => {
            const company = application.job?.firm_name?.trim() || "Company not specified";
            const title = application.job?.title?.trim() || "Position not specified";
            const location = application.job?.location?.trim() || "Location not specified";
            const tile = TILE_STYLES[getCompanyTileIndex(application.job?.firm_name)];
            const tone = getStatusTone(application.status);

            return (
              <li
                key={application.id}
                className="flex items-center gap-4 border-t border-[#EEF0F3] px-5 py-4 first:border-t-0"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${tile}`}
                >
                  {company[0].toUpperCase()}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="line-clamp-2 font-bold text-[#0E1726] sm:truncate">{title}</p>
                  <p className="truncate text-sm text-[#4B5563]">
                    {company} · {location}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[tone]}`}
                  >
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                    {getStatusLabel(application.status)}
                  </span>
                  <span className="font-mono text-[11px] text-[#4B5563]">
                    {formatAppliedDate(application.created_at, now)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
