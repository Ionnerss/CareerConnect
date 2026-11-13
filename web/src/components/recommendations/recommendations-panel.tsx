"use client";

// The body of the "Recommended for you" page (task #203). It asks POST /api/recommendations
// once when the page opens (and again when the seeker presses Refresh), then shows the
// ranked jobs with the AI-written note, the skills they have and the skills to build.
// Nothing is ever applied to on the seeker's behalf: each card only links to the normal
// apply page.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
  Wallet,
} from "lucide-react";
import type {
  RecommendationsApiFailure,
  RecommendationsApiResponse,
} from "@/lib/recommendations/api-response";

type Success = Extract<RecommendationsApiResponse, { success: true }>;
type Recommendation = Success["recommendations"][number];

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: Success }
  | { kind: "error"; failure: Pick<RecommendationsApiFailure, "error"> & { code: RecommendationsApiFailure["code"] | "NETWORK" } };

const NETWORK_ERROR = "We could not reach the server. Check your connection and try again.";
const GENERIC_ERROR = "Unable to load your recommendations. Please try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Calls the endpoint and turns anything unexpected into a readable error state. */
async function requestRecommendations(): Promise<State> {
  let response: Response;
  try {
    response = await fetch("/api/recommendations", { method: "POST" });
  } catch {
    return { kind: "error", failure: { code: "NETWORK", error: NETWORK_ERROR } };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "error", failure: { code: "BACKEND_ERROR", error: GENERIC_ERROR } };
  }

  if (isRecord(body) && body.success === true && Array.isArray(body.recommendations)) {
    return { kind: "ready", data: body as Success };
  }

  if (isRecord(body) && body.success === false && typeof body.code === "string") {
    return {
      kind: "error",
      failure: {
        code: body.code as RecommendationsApiFailure["code"],
        error: typeof body.error === "string" && body.error ? body.error : GENERIC_ERROR,
      },
    };
  }

  return { kind: "error", failure: { code: "BACKEND_ERROR", error: GENERIC_ERROR } };
}

/** Words next to the number, so the score never relies on colour alone. */
export function matchLabel(score: number): string {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Good match";
  return "Possible match";
}

const CARD = "rounded-3xl border border-[#E3E6EB] bg-white shadow-sm";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-2xl border border-[#F3E2B8] bg-[#FFF9EB] px-4 py-3 text-sm text-[#7A5A12]"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function RecommendationCard({ item, rank }: { item: Recommendation; rank: number }) {
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
                <Building2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
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
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-[#1D4ED8]" />
                AI summary
              </p>
              <p className="mt-1.5 text-sm leading-6 text-[#334155]">{item.summary}</p>
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
              The AI was less sure about this one, so double-check the details before applying.
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

          <div className="mt-5 border-t border-[#EEF1F6] pt-4">
            <Link
              href={`/jobs/${encodeURIComponent(job.id)}/apply`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#3151D5] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
            >
              <span>
                View and apply<span className="sr-only"> for {title}</span>
              </span>
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

function Message({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={`${CARD} px-6 py-14 text-center`}>
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#1D4ED8]">
        {icon}
      </div>
      <h2 className="text-xl font-bold text-[#0E1726]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#64748B]">{children}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-xl bg-[#3151D5] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 disabled:opacity-60";

export default function RecommendationsPanel() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const started = useRef(false);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    setState(await requestRecommendations());
  }, []);

  // Ask once when the page opens. The guard keeps React's development double-run from
  // sending two requests, because every request costs an AI call.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div className={`${CARD} px-6 py-14 text-center`} role="status" aria-live="polite" aria-busy="true">
        <RefreshCw aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-[#1D4ED8]" />
        <h2 className="mt-5 text-xl font-bold text-[#0E1726]">Finding your best matches…</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#64748B]">
          We are comparing your profile with open jobs. This can take a few seconds.
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    const { code, error } = state.failure;

    let action: React.ReactNode = (
      <button type="button" onClick={() => void load()} className={PRIMARY_BUTTON}>
        Try again
      </button>
    );
    if (code === "MFA_REQUIRED") {
      action = (
        <Link href="/auth/mfa" className={PRIMARY_BUTTON}>
          Verify with your authenticator
        </Link>
      );
    } else if (code === "UNAUTHENTICATED") {
      action = (
        <Link href="/auth/login" className={PRIMARY_BUTTON}>
          Sign in
        </Link>
      );
    } else if (code === "NOT_JOB_SEEKER") {
      action = undefined;
    }

    return (
      <div role="alert">
        <Message
          icon={<TriangleAlert aria-hidden="true" className="h-8 w-8" />}
          title="We could not load your recommendations"
          action={action}
        >
          {error}
        </Message>
      </div>
    );
  }

  const { data } = state;

  if (data.empty_profile) {
    return (
      <Message
        icon={<UserRound aria-hidden="true" className="h-8 w-8" />}
        title="Complete your profile to get recommendations"
        action={
          <Link href="/profile" className={PRIMARY_BUTTON}>
            Go to my profile
          </Link>
        }
      >
        Add your skills, work experience, education or the role you are looking for, and we will
        match you with open jobs.
      </Message>
    );
  }

  if (data.recommendations.length === 0) {
    return (
      <Message
        icon={<Building2 aria-hidden="true" className="h-8 w-8" />}
        title="No open jobs to recommend right now"
        action={
          <Link href="/jobs" className={PRIMARY_BUTTON}>
            Browse all jobs
          </Link>
        }
      >
        You have already applied to the best matches, or there are no open postings at the moment.
        Check back soon.
      </Message>
    );
  }

  return (
    <div className="space-y-5">
      <div className={`${CARD} flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6`}>
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-tight text-[#0E1726]">
            Your top {data.recommendations.length} match
            {data.recommendations.length === 1 ? "" : "es"}
          </h2>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-[#64748B]">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#18794E]" />
            <span>
              Picked from {data.considered_jobs} open job{data.considered_jobs === 1 ? "" : "s"}.
              AI suggestions only: you decide where to apply. Your name, email, employers and
              schools are never sent to the AI.
            </span>
          </p>
        </div>
        <button type="button" onClick={() => void load()} className={PRIMARY_BUTTON}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {!data.ai_ranked && (
        <Notice>
          AI ranking is unavailable right now, so these jobs are ordered by how well your profile
          matches each posting.
        </Notice>
      )}

      <ol aria-label="Recommended jobs" className="flex flex-col gap-4">
        {data.recommendations.map((item, index) => (
          <RecommendationCard key={item.job.id} item={item} rank={index + 1} />
        ))}
      </ol>
    </div>
  );
}
