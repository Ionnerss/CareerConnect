"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, History, Search } from "lucide-react";
import { PageBody, PageHero, Surface } from "@/components/app/page-hero";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";
import {
  ANALYTICS_RANGES,
  DEFAULT_ANALYTICS_RANGE,
  applicationsInRange,
  bucketApplications,
  formatHistoryDate,
  type AnalyticsRange,
} from "@/lib/application_status/analytics";
import {
  countApplicationStatuses,
  getStatusLabel,
  getStatusTone,
  type StatusTone,
} from "@/lib/dashboard/summary";

type AnalyticsDashboardProps = {
  applications: ApplicationCardData[];
  loadError?: boolean;
  /** Only passed by tests so the chart does not depend on the real clock. */
  now?: Date;
};

/** How many applications the history list shows before linking to the full status page. */
export const HISTORY_LIMIT = 10;

const RANGE_SUMMARY: Record<AnalyticsRange, string> = {
  "1d": "in the last 24 hours",
  "7d": "in the last 7 days",
  "30d": "in the last 30 days",
  "3m": "in the last 3 months",
  "1y": "in the last 12 months",
};

/** Only some bars get a label underneath so the axis stays readable. */
const LABEL_EVERY: Record<AnalyticsRange, number> = {
  "1d": 4,
  "7d": 1,
  "30d": 5,
  "3m": 2,
  "1y": 1,
};

const STATUS_STYLES: Record<StatusTone, string> = {
  progress: "bg-[#E8EEFD] text-[#1D4ED8]",
  interview: "bg-[#FEF3E2] text-[#B45309]",
  offer: "bg-[#E3F6EE] text-[#047857]",
  rejected: "bg-[#F1F2F4] text-[#4B5563]",
  unknown: "bg-[#F1F2F4] text-[#4B5563]",
};

const linkButton =
  "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#D9DEE5] bg-white px-4 text-sm font-semibold text-[#1F2937] transition-colors hover:bg-[#F5F6F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]";

function subscribeNever() {
  return () => {};
}

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function AnalyticsDashboard({ applications, loadError = false, now }: AnalyticsDashboardProps) {
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_ANALYTICS_RANGE);
  // The chart uses the viewer's own time zone, so it is only drawn in the browser.
  // Drawing it on the server (UTC) would give different bars than the browser and break hydration.
  const isBrowser = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [browserNow] = useState(() => new Date());
  const today = now ?? (isBrowser ? browserNow : null);

  const counts = useMemo(() => countApplicationStatuses(applications), [applications]);
  const buckets = useMemo(
    () => (today ? bucketApplications(applications, range, today) : []),
    [applications, range, today],
  );
  const inRange = useMemo(
    () => (today ? applicationsInRange(applications, range, today) : []),
    [applications, range, today],
  );
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));

  const tiles = [
    { label: "Total", value: counts.total, dot: "bg-[#0E1726]" },
    { label: "Pending", value: counts.inProgress, dot: "bg-[#1D4ED8]" },
    { label: "Interviews", value: counts.interview, dot: "bg-[#B45309]" },
    { label: "Offers", value: counts.offers, dot: "bg-[#047857]" },
    { label: "Rejected", value: counts.rejected, dot: "bg-[#6B7280]" },
  ];

  return (
    <main>
      <PageHero
        label="Applications"
        title="Application analytics"
        description="Your application history and job search activity at a glance."
        action={
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-[#A9C1FF] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B93FF]"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to dashboard
          </Link>
        }
      />

      <PageBody>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3">
            <Link href="/application-status" className={linkButton}>
              View application status
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/interviews" className={linkButton}>
              View interviews
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>

          {loadError ? (
            <p
              role="alert"
              className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-sm font-medium text-[#B91C1C]"
            >
              We couldn&apos;t load your applications. Please refresh the page.
            </p>
          ) : (
            <>
              <section aria-labelledby="status-summary-heading">
                <Surface className="shadow-[0_10px_30px_-18px_rgba(14,23,38,0.35)]">
                  <h2
                    id="status-summary-heading"
                    className="px-5 pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[#4B5563]"
                  >
                    Applications by status
                  </h2>
                  <dl className="grid grid-cols-2 gap-y-2 px-2 pb-4 sm:grid-cols-5">
                    {tiles.map((tile, index) => (
                      <div
                        key={tile.label}
                        className={`flex flex-col gap-1 px-3 py-2 ${index > 0 ? "sm:border-l sm:border-[#EEF0F3]" : ""} ${index === 0 ? "col-span-2 sm:col-span-1" : ""}`}
                      >
                        <dt className="flex items-center gap-1.5 text-xs font-semibold text-[#4B5563]">
                          <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tile.dot}`} />
                          {tile.label}
                        </dt>
                        <dd className="text-3xl font-extrabold tracking-tight text-[#0E1726] tabular-nums">
                          {tile.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Surface>
              </section>

              {applications.length === 0 ? (
                <Surface className="flex flex-col items-center gap-3 p-8 text-center">
                  <p className="font-bold text-[#0E1726]">You haven&apos;t applied to any jobs yet.</p>
                  <p className="max-w-md text-sm text-[#4B5563]">
                    Your application history and activity chart will appear here after your first application.
                  </p>
                  <Link
                    href="/jobs"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#1D4ED8] px-5 text-sm font-bold text-white hover:bg-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                  >
                    <Search aria-hidden="true" className="size-4" />
                    Browse jobs
                  </Link>
                </Surface>
              ) : (
                <>
                  <section aria-labelledby="activity-heading">
                    <Surface className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#E8EEFD] text-[#1D4ED8]">
                            <BarChart3 aria-hidden="true" className="size-5" />
                          </span>
                          <div>
                            <h2 id="activity-heading" className="text-lg font-bold text-[#0E1726]">
                              Applications submitted over time
                            </h2>
                            <p className="text-sm text-[#4B5563]">
                              {today
                                ? `${pluralize(inRange.length, "application")} ${RANGE_SUMMARY[range]}`
                                : "Loading activity…"}
                            </p>
                          </div>
                        </div>

                        <div role="group" aria-label="Time range" className="flex flex-wrap gap-1 rounded-xl bg-[#F5F6F8] p-1">
                          {ANALYTICS_RANGES.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={range === option.value}
                              onClick={() => setRange(option.value)}
                              className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                                range === option.value
                                  ? "bg-white text-[#0E1726] shadow-sm"
                                  : "text-[#4B5563] hover:text-[#0E1726]"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {today && inRange.length === 0 && (
                        <p role="status" className="mt-4 text-sm text-[#4B5563]">
                          No applications {RANGE_SUMMARY[range]}. Try a longer time range.
                        </p>
                      )}

                      <ol
                        aria-label={`Applications per period ${RANGE_SUMMARY[range]}`}
                        className="mt-6 flex h-48 items-end gap-1"
                      >
                        {buckets.map((bucket, index) => (
                          <li
                            key={bucket.key}
                            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                            title={`${bucket.fullLabel}: ${pluralize(bucket.count, "application")}`}
                          >
                            <span className="sr-only">
                              {bucket.fullLabel}: {pluralize(bucket.count, "application")}
                            </span>
                            {bucket.count > 0 && (
                              <span aria-hidden="true" className="text-[11px] font-bold text-[#0E1726] tabular-nums">
                                {bucket.count}
                              </span>
                            )}
                            <span
                              aria-hidden="true"
                              data-testid="chart-bar"
                              className={`w-full max-w-10 rounded-t-md ${bucket.count > 0 ? "bg-[#1D4ED8]" : "bg-[#EEF0F3]"}`}
                              style={{ height: bucket.count > 0 ? `${(bucket.count / maxCount) * 85}%` : "4px" }}
                            />
                            <span aria-hidden="true" className="h-4 truncate text-[10px] text-[#6B7280]">
                              {index % LABEL_EVERY[range] === 0 ? bucket.label : ""}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </Surface>
                  </section>

                  <section aria-labelledby="history-heading">
                    <Surface className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#E8EEFD] text-[#1D4ED8]">
                            <History aria-hidden="true" className="size-5" />
                          </span>
                          <h2 id="history-heading" className="text-lg font-bold text-[#0E1726]">
                            Application history
                          </h2>
                        </div>
                        {inRange.length > HISTORY_LIMIT && (
                          <Link
                            href="/application-status"
                            className="text-sm font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
                          >
                            View all {inRange.length}
                          </Link>
                        )}
                      </div>

                      {!today ? null : inRange.length === 0 ? (
                        <p className="mt-4 rounded-xl border border-dashed border-[#D9DEE5] px-4 py-6 text-center text-sm text-[#6B7280]">
                          No applications {RANGE_SUMMARY[range]}.
                        </p>
                      ) : (
                        <ul aria-label="Application history" className="mt-4 divide-y divide-[#EEF0F3]">
                          {inRange.slice(0, HISTORY_LIMIT).map((application) => {
                            const tone = getStatusTone(application.status);
                            return (
                              <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-[#0E1726]">
                                    {application.job?.title?.trim() || "Position not specified"}
                                  </p>
                                  <p className="text-sm text-[#4B5563]">
                                    {application.job?.firm_name?.trim() || "Company not specified"} · Applied{" "}
                                    {formatHistoryDate(application.created_at)}
                                  </p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[tone]}`}>
                                  {tone === "progress" ? "Pending" : getStatusLabel(application.status)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Surface>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </PageBody>
    </main>
  );
}
