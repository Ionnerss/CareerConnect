"use client";

import Link from "next/link";
import {
  ArrowRight,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { matchLabel } from "@/lib/recommendations/client";
import type {
  RecommendationRequestError,
  RefreshStatusResult,
  SavedRecommendationResults,
} from "@/lib/recommendations/refresh-client";
import { useRecommendationResults } from "@/lib/recommendations/use-recommendation-results";

export const DASHBOARD_RECOMMENDATION_LIMIT = 5;

const FULL_PAGE_HREF = "/jobs/recommendations";

const PRIMARY_BUTTON =
  "inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-bold text-white hover:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]";

const TEXT_LINK =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-[#1D4ED8] hover:text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]";

type RequestProblemProps = {
  error: RecommendationRequestError;
  onRetry?: () => void;
};

function isAccessError(error: RecommendationRequestError | null): boolean {
  return (
    error?.code === "UNAUTHENTICATED" ||
    error?.code === "MFA_REQUIRED" ||
    error?.code === "NOT_JOB_SEEKER"
  );
}

function RequestProblem({ error, onRetry }: RequestProblemProps) {
  let action: React.ReactNode = null;

  if (error.code === "MFA_REQUIRED") {
    action = (
      <Link href="/auth/mfa" className={PRIMARY_BUTTON}>
        Verify your account
      </Link>
    );
  } else if (error.code === "UNAUTHENTICATED") {
    action = (
      <Link href="/auth/login" className={PRIMARY_BUTTON}>
        Log in again
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
    <div className="space-y-3">
      <p
        role="alert"
        className="flex items-start gap-2 text-sm text-[#9B1C1C]"
      >
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0"
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
      return "Refresh queued. Your saved matches remain available.";

    case "running":
      return "Refreshing your matches. Your saved matches remain available.";

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
    <div className="space-y-2 text-sm text-[#4B5563]">
      {message && <p role="status">{message}</p>}

      {status.stale && (
        <p>Your saved matches may be out of date.</p>
      )}

      <div className="space-y-1 text-xs text-[#6B7280]">
        <SavedTime label="Generated:" value={status.generated_at} />
        <SavedTime label="Last checked:" value={status.checked_at} />
      </div>
    </div>
  );
}

function SavedMatches({ data }: { data: SavedRecommendationResults }) {
  if (!data.run) {
    return (
      <div className="space-y-3">
        <p className="font-semibold text-[#0E1726]">
          No saved recommendations yet.
        </p>

        <p className="max-w-md text-sm text-[#4B5563]">
          Request your first matches. Your skills, experience and preferences
          help determine which postings fit your profile.
        </p>

        <Link href="/profile" className={TEXT_LINK}>
          Review your profile
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    );
  }

  const top = data.recommendations.slice(
    0,
    DASHBOARD_RECOMMENDATION_LIMIT,
  );

  if (top.length === 0) {
    return (
      <div className="space-y-3">
        <p className="font-semibold text-[#0E1726]">
          No saved matches are currently available.
        </p>

        <p className="max-w-md text-sm text-[#4B5563]">
          You can browse available jobs, review your profile or request
          another refresh.
        </p>

        <div className="flex flex-wrap gap-2">
          <Link href="/jobs" className={TEXT_LINK}>
            Browse jobs
          </Link>

          <Link href="/profile" className={TEXT_LINK}>
            Review your profile
          </Link>
        </div>
      </div>
    );
  }

  const usesFallback =
    data.run.ranking_mode === "code_only" ||
    data.run.ranking_mode === "mixed";

  return (
    <div className="space-y-3">
      {usesFallback && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-[#F3E2B8] bg-[#FFF9EB] px-4 py-3 text-sm text-[#7A5A12]"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            These saved results include profile-based scoring where AI
            ranking was unavailable.
          </span>
        </p>
      )}

      <ol aria-label="Your top job matches">
        {top.map((item, index) => {
          const title = item.job.title?.trim() || "Untitled position";
          const company =
            item.job.firm_name?.trim() || "Company not listed";
          const location = item.job.location?.trim();

          return (
            <li
              key={item.job.id}
              className="flex items-center gap-4 border-t border-[#EEF0F3] py-4 first:border-t-0"
            >
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E8EEFD] text-lg font-extrabold text-[#1E40AF]"
              >
                {index + 1}
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="line-clamp-2 font-bold text-[#0E1726] sm:truncate">
                  {title}
                </p>

                <p className="truncate text-sm text-[#4B5563]">
                  {company}
                  {location ? ` · ${location}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-full bg-[#F2F5FF] px-2.5 py-1 text-xs font-bold text-[#1D4ED8]">
                  {item.score}% · {matchLabel(item.score)}
                </span>

                <Link
                  href={`/jobs?selectedJob=${encodeURIComponent(item.job.id)}`}
                  aria-label={`View posting for ${title}`}
                  className="inline-flex min-h-8 items-center gap-1 rounded text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                >
                  View posting
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>

                <Link
                  href={`/jobs/${encodeURIComponent(item.job.id)}/apply`}
                  aria-label={`Apply for ${title}`}
                  className="inline-flex min-h-8 items-center gap-1 rounded text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                >
                  Apply
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-[#6B7280]">
        Suggestions only: you decide where to apply. A match score is
        not a guarantee of an interview or offer.
      </p>
    </div>
  );
}

export default function DashboardRecommendations() {
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

  const refreshDisabled =
    loading || requesting || refreshPending;

  let refreshLabel = saved?.run
    ? "Refresh matches"
    : "Find my matches";

  if (requesting) {
    refreshLabel = "Requesting refresh…";
  } else if (refreshPending) {
    refreshLabel = "Refresh pending";
  }

  return (
    <section
      aria-labelledby="dashboard-recommendations-heading"
      aria-busy={loading || requesting}
      className="overflow-hidden rounded-2xl border border-[#E3E6EB] bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E6EB] px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles
            aria-hidden="true"
            className="size-5 text-[#1D4ED8]"
          />

          <h2
            id="dashboard-recommendations-heading"
            className="text-lg font-bold text-[#0E1726]"
          >
            Recommended for you
          </h2>
        </div>

        <Link href={FULL_PAGE_HREF} className={TEXT_LINK}>
          See all recommendations
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <div className="space-y-4 px-5 py-5">
        {loading && !saved && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-[#4B5563]"
          >
            <RefreshCw
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            Loading your saved recommendations…
          </p>
        )}

        {loadError && (
          <RequestProblem
            error={loadError}
            onRetry={() => void reload()}
          />
        )}

        {refreshError && (
          <RequestProblem error={refreshError} />
        )}

        {saved && <SavedMatches data={saved} />}

        {refreshStatus && (
          <RefreshDetails status={refreshStatus} />
        )}

        {saved && !accessBlocked && (
          <div className="flex flex-wrap items-center gap-3 border-t border-[#E3E6EB] pt-4">
            <button
              type="button"
              disabled={refreshDisabled}
              onClick={() => void requestRefresh()}
              className={PRIMARY_BUTTON}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              {refreshLabel}
            </button>

            <button
              type="button"
              disabled={loading || requesting}
              onClick={() => void reload()}
              className={`${TEXT_LINK} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              Check status
            </button>
          </div>
        )}
      </div>
    </section>
  );
}