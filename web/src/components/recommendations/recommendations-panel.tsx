"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { matchLabel } from "@/lib/recommendations/client";
import type {
  RecommendationRequestError,
  RefreshStatusResult,
  SavedRecommendation,
} from "@/lib/recommendations/refresh-client";
import { useRecommendationResults } from "@/lib/recommendations/use-recommendation-results";

export { matchLabel };

const CARD =
  "rounded-3xl border border-[#E3E6EB] bg-white shadow-sm";

const PRIMARY_BUTTON =
  "inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3151D5] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const SECONDARY_BUTTON =
  "inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#3151D5] bg-white px-5 py-2.5 text-sm font-semibold text-[#3151D5] transition-colors hover:bg-[#F2F5FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-2xl border border-[#F3E2B8] bg-[#FFF9EB] px-4 py-3 text-sm text-[#7A5A12]"
    >
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      <span>{children}</span>
    </p>
  );
}

function isAccessError(error: RecommendationRequestError | null) {
  return (
    error?.code === "UNAUTHENTICATED" ||
    error?.code === "MFA_REQUIRED" ||
    error?.code === "NOT_JOB_SEEKER"
  );
}

function RequestProblem({
  error,
  onRetry,
}: {
  error: RecommendationRequestError;
  onRetry?: () => void;
}) {
  let action: React.ReactNode = null;

  if (error.code === "MFA_REQUIRED") {
    action = (
      <Link href="/auth/mfa" className={PRIMARY_BUTTON}>
        Verify with your authenticator
      </Link>
    );
  } else if (error.code === "UNAUTHENTICATED") {
    action = (
      <Link href="/auth/login" className={PRIMARY_BUTTON}>
        Sign in
      </Link>
    );
  } else if (error.code !== "NOT_JOB_SEEKER" && onRetry) {
    action = (
      <button
        type="button"
        onClick={onRetry}
        className={PRIMARY_BUTTON}
      >
        Try again
      </button>
    );
  }

  return (
    <div className={`${CARD} space-y-4 p-5 sm:p-6`}>
      <p
        role="alert"
        className="flex items-start gap-2 text-sm text-[#9B1C1C]"
      >
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>{error.message}</span>
      </p>

      {action}
    </div>
  );
}

function SavedTime({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return (
    <p>
      <span>{label}</span>{" "}
      <time dateTime={value}>{date.toLocaleString()}</time>
    </p>
  );
}

function refreshMessage(status: RefreshStatusResult): string | null {
  const pending =
    status.status === "queued" ||
    status.status === "running" ||
    status.status === "retry_wait";

  if (pending && !status.processing_enabled) {
    return "Refresh queued. Recommendation processing is currently paused.";
  }

  switch (status.status) {
    case "queued":
      return "Refresh queued. Your saved recommendations remain available.";

    case "running":
      return "Refreshing your recommendations. Your saved results remain available.";

    case "retry_wait":
      return "The last attempt did not finish. Another attempt is scheduled.";

    case "failed":
      return "The last refresh failed. You can request another refresh.";

    default:
      return null;
  }
}

function RefreshDetails({ status }: { status: RefreshStatusResult }) {
  const message = refreshMessage(status);

  return (
    <div className="space-y-2 text-sm text-[#64748B]">
      {message && <p role="status">{message}</p>}

      {status.stale && (
        <p>Your saved recommendations may be out of date.</p>
      )}

      <div className="space-y-1 text-xs">
        <SavedTime label="Generated:" value={status.generated_at} />
        <SavedTime label="Last checked:" value={status.checked_at} />
      </div>
    </div>
  );
}

function RecommendationCard({
  item,
  rank,
}: {
  item: SavedRecommendation;
  rank: number;
}) {
  const { job } = item;
  const title = job.title?.trim() || "Untitled position";
  const company = job.firm_name?.trim() || "Company not listed";
  const matched = item.skill_match?.matched ?? [];
  const missing = item.skill_match?.missing ?? [];

  return (
    <li className={`${CARD} p-5 sm:p-6`}>
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-base font-extrabold text-[#1E40AF]"
        >
          {rank}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-snug tracking-tight text-[#0E1726]">
                {title}
              </h3>

              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-[#475569]">
                <Building2
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]"
                />
                <span className="truncate">{company}</span>
              </p>
            </div>

            <p className="shrink-0 rounded-2xl bg-[#F2F5FF] px-4 py-2 text-center">
              <span className="block text-2xl font-extrabold leading-none text-[#1D4ED8]">
                {item.score}%
              </span>
              <span className="mt-1 block text-xs font-semibold text-[#475569]">
                {matchLabel(item.score)}
              </span>
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {job.location && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-[#E5EAF2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#64748B]">
                <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                {job.location}
              </span>
            )}

            {job.work_mode && (
              <span className="rounded-lg border border-[#E5EAF2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#64748B]">
                {job.work_mode}
              </span>
            )}

            {job.employment_type && (
              <span className="rounded-lg border border-[#E5EAF2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#64748B]">
                {job.employment_type}
              </span>
            )}

            {job.salary !== null && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-[#DCEFE7] bg-[#F0FAF5] px-2.5 py-1.5 text-xs font-semibold text-[#18794E]">
                <Wallet aria-hidden="true" className="h-3.5 w-3.5" />
                ${job.salary.toLocaleString("en-CA")}
              </span>
            )}
          </div>

          {item.summary ? (
            <div className="mt-4 rounded-2xl bg-[#F8FAFC] px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                <Sparkles
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-[#1D4ED8]"
                />
                AI summary
              </p>
              <p className="mt-1.5 text-sm leading-6 text-[#334155]">
                {item.summary}
              </p>
            </div>
          ) : (
            item.reasons.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64748B]">
                  Why it fits
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                  {item.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )
          )}

          {item.fit?.lowConfidence && (
            <p className="mt-3 text-sm text-[#7A5A12]">
              The AI was less sure about this one, so double-check the
              details before applying.
            </p>
          )}

          {(matched.length > 0 || missing.length > 0) && (
            <div className="mt-4 space-y-2">
              {matched.length > 0 && (
                <p className="flex flex-wrap items-center gap-1.5 text-sm text-[#334155]">
                  <span className="font-semibold">Skills you have:</span>
                  {matched.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-[#CBEBD9] bg-[#F0FAF5] px-2.5 py-0.5 text-xs font-medium text-[#18794E]"
                    >
                      {skill}
                    </span>
                  ))}
                </p>
              )}

              {missing.length > 0 && (
                <p className="flex flex-wrap items-center gap-1.5 text-sm text-[#334155]">
                  <span className="font-semibold">Skills to build:</span>
                  {missing.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-[#F3E2B8] bg-[#FFF9EB] px-2.5 py-0.5 text-xs font-medium text-[#7A5A12]"
                    >
                      {skill}
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3 border-t border-[#EEF1F6] pt-4">
            <Link
              href={`/jobs?selectedJob=${encodeURIComponent(job.id)}`}
              aria-label={`View posting for ${title}`}
              className={SECONDARY_BUTTON}
            >
              View posting
            </Link>

            <Link
              href={`/jobs/${encodeURIComponent(job.id)}/apply`}
              aria-label={`Apply for ${title}`}
              className={PRIMARY_BUTTON}
            >
              Apply
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function RecommendationsPanel() {
  const {
    saved,
    refreshStatus,
    loading,
    requesting,
    loadError,
    refreshError,
    refreshPending,
    reload,
    requestRefresh,
  } = useRecommendationResults();

  const accessBlocked =
    isAccessError(loadError) || isAccessError(refreshError);

  const count = saved?.recommendations.length ?? 0;

  const usesFallback =
    saved?.run?.ranking_mode === "code_only" ||
    saved?.run?.ranking_mode === "mixed";

  let refreshLabel = saved?.run
    ? "Refresh recommendations"
    : "Find my matches";

  if (requesting) {
    refreshLabel = "Requesting refresh…";
  } else if (refreshPending) {
    refreshLabel = "Refresh pending";
  }

  return (
    <div
      className="space-y-5"
      aria-busy={loading || requesting}
    >
      {loading && !saved && (
        <div className={`${CARD} px-6 py-14 text-center`} role="status">
          <RefreshCw
            aria-hidden="true"
            className="mx-auto h-8 w-8 animate-spin text-[#1D4ED8] motion-reduce:animate-none"
          />
          <h2 className="mt-5 text-xl font-bold text-[#0E1726]">
            Loading your saved recommendations…
          </h2>
        </div>
      )}

      {loadError && (
        <RequestProblem
          error={loadError}
          onRetry={() => void reload()}
        />
      )}

      {refreshError && <RequestProblem error={refreshError} />}

      {saved && (
        <>
          <div className={`${CARD} space-y-4 px-5 py-4 sm:px-6`}>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-[#0E1726]">
                {count > 0
                  ? `Your top ${count} ${count === 1 ? "match" : "matches"}`
                  : "Your saved recommendations"}
              </h2>

              <p className="mt-2 flex items-start gap-1.5 text-sm text-[#64748B]">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#18794E]"
                />
                <span>
                  Suggestions only: you decide where to apply.
                  Your name, email, employers and schools are never
                  sent to the AI.
                </span>
              </p>
            </div>

            {refreshStatus && (
              <RefreshDetails status={refreshStatus} />
            )}

            {!accessBlocked && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={loading || requesting || refreshPending}
                  onClick={() => void requestRefresh()}
                  className={PRIMARY_BUTTON}
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  {refreshLabel}
                </button>

                <button
                  type="button"
                  disabled={loading || requesting}
                  onClick={() => void reload()}
                  className={SECONDARY_BUTTON}
                >
                  Check status
                </button>
              </div>
            )}
          </div>

          {!saved.run && (
            <div className={`${CARD} space-y-3 px-6 py-10`}>
              <h3 className="text-lg font-bold text-[#0E1726]">
                No saved recommendations yet.
              </h3>
              <p className="text-sm leading-6 text-[#64748B]">
                Request your first matches. Your skills, experience and
                preferences help determine which postings fit your profile.
              </p>
              <Link href="/profile" className={SECONDARY_BUTTON}>
                Review your profile
              </Link>
            </div>
          )}

          {saved.run && count === 0 && (
            <div className={`${CARD} space-y-3 px-6 py-10`}>
              <h3 className="text-lg font-bold text-[#0E1726]">
                No saved matches are currently available.
              </h3>
              <p className="text-sm leading-6 text-[#64748B]">
                You can browse available jobs, review your profile or
                request another refresh.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/jobs" className={PRIMARY_BUTTON}>
                  Browse all jobs
                </Link>
                <Link href="/profile" className={SECONDARY_BUTTON}>
                  Review your profile
                </Link>
              </div>
            </div>
          )}

          {count > 0 && usesFallback && (
            <Notice>
              These saved results include profile-based scoring where
              AI ranking was unavailable.
            </Notice>
          )}

          {count > 0 && (
            <ol
              aria-label="Recommended jobs"
              className="flex flex-col gap-4"
            >
              {saved.recommendations.map((item, index) => (
                <RecommendationCard
                  key={item.job.id}
                  item={item}
                  rank={index + 1}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}