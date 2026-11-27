"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";

const ENDPOINT = "/api/recommendations/preferences";

const preferenceSchema = z.object({
  success: z.literal(true),
  enabled: z.boolean(),
});

const failureSchema = z.object({
  success: z.literal(false),
  code: z.string(),
});

class PreferenceRequestError extends Error {
  constructor(readonly code: string) {
    super(
      code === "UNAUTHENTICATED"
        ? "Sign in to manage background refresh."
        : code === "MFA_REQUIRED"
          ? "Complete two-factor authentication to manage background refresh."
          : "Unable to load or save your background refresh setting. Please try again.",
    );

    this.name = "PreferenceRequestError";
  }
}

type State =
  | { kind: "loading" }
  | {
      kind: "load_error";
      failure: PreferenceRequestError;
    }
  | {
      kind: "ready";
      enabled: boolean;
      saving: boolean;
      failure: PreferenceRequestError | null;
    };

async function requestPreference(
  method: "GET" | "PUT",
  signal: AbortSignal,
  enabled?: boolean,
): Promise<boolean> {
  const response = await fetch(ENDPOINT, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    signal,
    ...(method === "PUT"
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        }
      : {}),
  });

  const body: unknown = await response.json();

  if (!response.ok) {
    const failure = failureSchema.safeParse(body);

    throw new PreferenceRequestError(
      failure.success ? failure.data.code : "REQUEST_FAILED",
    );
  }

  const parsed = preferenceSchema.safeParse(body);

  if (
    !parsed.success ||
    (method === "PUT" && parsed.data.enabled !== enabled)
  ) {
    throw new PreferenceRequestError("REQUEST_FAILED");
  }

  return parsed.data.enabled;
}

function asPreferenceError(error: unknown): PreferenceRequestError {
  return error instanceof PreferenceRequestError
    ? error
    : new PreferenceRequestError("REQUEST_FAILED");
}

function FailureNotice({
  failure,
}: {
  failure: PreferenceRequestError;
}) {
  return (
    <p role="alert" className="mt-3 text-sm text-[#B42318]">
      {failure.message}

      {failure.code === "UNAUTHENTICATED" && (
        <>
          {" "}
          <Link href="/auth/login" className="font-semibold underline">
            Sign in
          </Link>
        </>
      )}

      {failure.code === "MFA_REQUIRED" && (
        <>
          {" "}
          <Link href="/auth/mfa" className="font-semibold underline">
            Verify your account
          </Link>
        </>
      )}
    </p>
  );
}

export default function BackgroundRefreshControl() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const controller = useRef<AbortController | null>(null);
  const saving = useRef(false);

  const headingId = useId();
  const descriptionId = useId();

  const load = useCallback((signal: AbortSignal) => {
    return requestPreference("GET", signal).then(
        (enabled) => {
        if (signal.aborted) return;

        setState({
            kind: "ready",
            enabled,
            saving: false,
            failure: null,
        });
        },
        (error: unknown) => {
        if (signal.aborted) return;

        setState({
            kind: "load_error",
            failure: asPreferenceError(error),
        });
        },
    );
    }, []);

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;

    void load(current.signal);

    return () => current.abort();
  }, [load]);

  function retryLoad() {
    controller.current?.abort();

    const current = new AbortController();
    controller.current = current;

    setState({ kind: "loading" });
    void load(current.signal);
  }

  async function toggle() {
    const current = controller.current;

    if (
      state.kind !== "ready" ||
      state.saving ||
      saving.current ||
      !current ||
      current.signal.aborted
    ) {
      return;
    }

    const previousEnabled = state.enabled;
    saving.current = true;

    setState({
      kind: "ready",
      enabled: previousEnabled,
      saving: true,
      failure: null,
    });

    try {
      const enabled = await requestPreference(
        "PUT",
        current.signal,
        !previousEnabled,
      );

      if (!current.signal.aborted) {
        setState({
          kind: "ready",
          enabled,
          saving: false,
          failure: null,
        });
      }
    } catch (error) {
      if (!current.signal.aborted) {
        setState({
          kind: "ready",
          enabled: previousEnabled,
          saving: false,
          failure: asPreferenceError(error),
        });
      }
    } finally {
      saving.current = false;
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-3xl border border-[#E3E6EB] bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2
            id={headingId}
            className="text-lg font-bold text-[#0E1726]"
          >
            Background refresh
          </h2>

          <p
            id={descriptionId}
            className="mt-1 text-sm leading-6 text-[#64748B]"
          >
            Allow CareerConnect to refresh your matches while you are
            away, using your matching profile details and open job
            postings. You can turn this off at any time.
          </p>
        </div>

        {state.kind === "ready" && (
          <button
            type="button"
            role="switch"
            aria-checked={state.enabled}
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
            disabled={state.saving}
            onClick={() => void toggle()}
            className="min-h-11 min-w-20 rounded-xl border border-[#3151D5] px-4 py-2 text-sm font-semibold text-[#3151D5] transition-colors hover:bg-[#F2F5FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {state.enabled ? "On" : "Off"}
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p role="status" className="mt-3 text-sm text-[#64748B]">
          Loading your setting…
        </p>
      )}

      {state.kind === "ready" && state.saving && (
        <p role="status" className="mt-3 text-sm text-[#64748B]">
          Saving your setting…
        </p>
      )}

      {state.kind === "ready" && state.failure && (
        <FailureNotice failure={state.failure} />
      )}

      {state.kind === "load_error" && (
        <>
          <FailureNotice failure={state.failure} />

          <button
            type="button"
            onClick={retryLoad}
            className="mt-3 min-h-11 rounded-xl border border-[#E3E6EB] px-4 py-2 text-sm font-semibold text-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
          >
            Retry loading setting
          </button>
        </>
      )}
    </section>
  );
}