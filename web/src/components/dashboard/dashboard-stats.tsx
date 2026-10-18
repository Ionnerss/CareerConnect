import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DashboardStatusCounts } from "@/lib/dashboard/summary";

type DashboardStatsProps = {
  counts: DashboardStatusCounts;
};

/** One card with big numbers and small captions. Links to the application status page. */
export default function DashboardStats({ counts }: DashboardStatsProps) {
  const cells = [
    { label: "Total", value: counts.total, dot: "bg-[#0E1726]" },
    { label: "In progress", value: counts.inProgress, dot: "bg-[#1D4ED8]" },
    { label: "Interviews", value: counts.interview, dot: "bg-[#B45309]" },
    { label: "Offers", value: counts.offers, dot: "bg-[#047857]" },
    { label: "Rejected", value: counts.rejected, dot: "bg-[#6B7280]" },
  ];

  return (
    <section
      aria-labelledby="dashboard-stats-heading"
      className="rounded-2xl border border-[#E3E6EB] bg-white shadow-[0_10px_30px_-18px_rgba(14,23,38,0.35)]"
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <h2
          id="dashboard-stats-heading"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#4B5563]"
        >
          Your applications
        </h2>
        <Link
          href="/application-status"
          className="inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-bold text-[#1D4ED8] hover:text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
        >
          Track
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-y-2 px-2 pb-4 sm:grid-cols-5">
        {cells.map((cell, index) => (
          <div
            key={cell.label}
            className={`flex flex-col gap-1 px-3 py-2 ${index > 0 ? "sm:border-l sm:border-[#EEF0F3]" : ""} ${index === 0 ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-[#4B5563]">
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${cell.dot}`} />
              {cell.label}
            </dt>
            <dd className="text-3xl font-extrabold tracking-tight text-[#0E1726] tabular-nums">
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
