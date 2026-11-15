"use client";

// "Recommended for you" on the dashboard (#101, dashboard part of #203).
// Each load asks the AI to rate about 10 postings, so nothing is requested until the seeker
// presses the button: opening the dashboard never costs an AI call. It shows the top 5 and
// links to the full recommendations page. The AI only suggests; each job links to the normal
// apply page, nothing is applied to automatically.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import {
  matchLabel,
  requestRecommendations,
  type ClientErrorCode,
  type RecommendationsSuccess,
} from "@/lib/recommendations/client";

/** How many recommendations the dashboard shows (#101: a maximum of 5). */
export const DASHBOARD_RECOMMENDATION_LIMIT = 5;

const FULL_PAGE_HREF = "/jobs/recommendations";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: RecommendationsSuccess }
  | { kind: "error"; code: ClientErrorCode; error: string };

const PRIMARY_BUTTON =
  "inline-flex h-11 items-center gap-2 rounded-lg bg-[#1D4ED8] px-5 text-sm font-bold text-white hover:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]";

const TEXT_LINK =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-[#1D4ED8] hover:text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]";

/** What to show (and where to send the seeker) for each error. */
function errorAction(code: ClientErrorCode): { href: string; label: string } | null {
  if (code === "MFA_REQUIRED") return { href: "/auth/mfa", label: "Verify your account" };
  if (code === "UNAUTHENTICATED") return { href: "/auth/login", label: "Log in again" };
  return null;
}

export default function DashboardRecommendations() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);

  // Stop a request that is still running if the seeker leaves the dashboard.
  useEffect(() => () => controller.current?.abort(), []);

  async function load() {
    if (state.kind === "loading") return;

    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState({ kind: "loading" });

    try {
      const result = await requestRecommendations(current.signal);
      if (current.signal.aborted) return;
      setState(
        result.ok
          ? { kind: "ready", data: result.data }
          : { kind: "error", code: result.code, error: result.error },
      );
    } catch {
      // Only an aborted request throws; the dashboard is gone, so there is nothing to update.
    }
  }

  const loading = state.kind === "loading";

  return (
    <section
      aria-labelledby="dashboard-recommendations-heading"
      aria-busy={loading}
      className="overflow-hidden rounded-2xl border border-[#E3E6EB] bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E6EB] px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-5 text-[#1D4ED8]" />
          <h2 id="dashboard-recommendations-heading" className="text-lg font-bold text-[#0E1726]">
            Recommended for you
          </h2>
        </div>
        <Link href={FULL_PAGE_HREF} className={TEXT_LINK}>
          See all recommendations
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <div aria-live="polite">
        {state.kind === "idle" && (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <p className="font-semibold text-[#0E1726]">Jobs picked for your profile</p>
            <p className="max-w-md text-sm text-[#4B5563]">
              We compare your skills, experience and preferences with the open postings and show your
              top {DASHBOARD_RECOMMENDATION_LIMIT} matches. Suggestions only: you decide where to apply.
            </p>
            <button type="button" onClick={() => void load()} className={`${PRIMARY_BUTTON} mt-1`}>
              <Sparkles aria-hidden="true" className="size-4" />
              Show my top matches
            </button>
          </div>
        )}

        {loading && (
          <p role="status" className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-[#4B5563]">
            <RefreshCw aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            Finding your best matches. This can take a few seconds.
          </p>
        )}

        {state.kind === "error" && <ErrorState code={state.code} error={state.error} onRetry={() => void load()} />}

        {state.kind === "ready" && <ReadyState data={state.data} onRefresh={() => void load()} />}
      </div>
    </section>
  );
}

function ErrorState({
  code,
  error,
  onRetry,
}: {
  code: ClientErrorCode;
  error: string;
  onRetry: () => void;
}) {
  const action = errorAction(code);

  return (
    <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
      <p role="alert" className="flex items-start gap-2 text-sm text-[#9B1C1C]">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{error}</span>
      </p>
      {action ? (
        <Link href={action.href} className={PRIMARY_BUTTON}>
          {action.label}
        </Link>
      ) : (
        <button type="button" onClick={onRetry} className={PRIMARY_BUTTON}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Try again
        </button>
      )}
    </div>
  );
}

function ReadyState({ data, onRefresh }: { data: RecommendationsSuccess; onRefresh: () => void }) {
  if (data.empty_profile) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
        <p className="font-semibold text-[#0E1726]">Add a few details to get recommendations.</p>
        <p className="max-w-sm text-sm text-[#4B5563]">
          Add your skills, experience and the role you want to your profile, then try again.
        </p>
        <Link href="/profile" className={PRIMARY_BUTTON}>
          Complete your profile
        </Link>
      </div>
    );
  }

  const top = data.recommendations.slice(0, DASHBOARD_RECOMMENDATION_LIMIT);

  if (top.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
        <p className="font-semibold text-[#0E1726]">No matching open jobs right now.</p>
        <p className="max-w-sm text-sm text-[#4B5563]">
          New postings show up here when they match your profile. You can still browse every job.
        </p>
        <Link href="/jobs" className={PRIMARY_BUTTON}>
          Browse jobs
        </Link>
      </div>
    );
  }

  return (
    <>
      {!data.ai_ranked && (
        <p
          role="status"
          className="flex items-start gap-2 border-b border-[#F3E2B8] bg-[#FFF9EB] px-5 py-3 text-sm text-[#7A5A12]"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>AI ranking is unavailable right now, so these are ordered by profile match only.</span>
        </p>
      )}

      <ol aria-label="Your top job matches">
        {top.map((item, index) => {
          const title = item.job.title?.trim() || "Untitled position";
          const company = item.job.firm_name?.trim() || "Company not listed";
          const location = item.job.location?.trim();

          return (
            <li
              key={item.job.id}
              className="flex items-center gap-4 border-t border-[#EEF0F3] px-5 py-4 first:border-t-0"
            >
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E8EEFD] text-lg font-extrabold text-[#1E40AF]"
              >
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="line-clamp-2 font-bold text-[#0E1726] sm:truncate">{title}</p>
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
                  href={`/jobs/${encodeURIComponent(item.job.id)}/apply`}
                  aria-label={`View and apply for ${title}`}
                  className="inline-flex min-h-8 items-center gap-1 rounded text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                >
                  View and apply
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E3E6EB] px-5 py-3">
        <p className="text-xs text-[#6B7280]">
          Picked from {data.considered_jobs} open {data.considered_jobs === 1 ? "job" : "jobs"}. A
          match score is not a guarantee of an interview or offer.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[#4B5563] hover:text-[#0E1726] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh
        </button>
      </div>
    </>
  );
}
