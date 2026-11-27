"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  enqueueRecommendationRefresh,
  fetchRecommendationRefreshStatus,
  fetchSavedRecommendations,
  RecommendationRequestError,
  type RefreshStatusResult,
  type SavedRecommendationResults,
} from "./refresh-client";

export const RECOMMENDATION_POLL_INTERVAL_MS = 5000;

type RecommendationResultsState = {
  saved: SavedRecommendationResults | null;
  refreshStatus: RefreshStatusResult | null;
  loading: boolean;
  requesting: boolean;
  loadError: RecommendationRequestError | null;
  refreshError: RecommendationRequestError | null;
};

function asRequestError(error: unknown): RecommendationRequestError {
  return error instanceof RecommendationRequestError
    ? error
    : new RecommendationRequestError("BACKEND_ERROR");
}

function isPending(status: RefreshStatusResult | null): boolean {
  return (
    status?.status === "queued" ||
    status?.status === "running" ||
    status?.status === "retry_wait"
  );
}

export function useRecommendationResults() {
  const [state, setState] = useState<RecommendationResultsState>({
    saved: null,
    refreshStatus: null,
    loading: true,
    requesting: false,
    loadError: null,
    refreshError: null,
  });

  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequence = useRef(0);
  const requesting = useRef(false);

  const load = useCallback(function load(
    signal: AbortSignal,
  ): Promise<void> {
    const currentSequence = ++sequence.current;

    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    return fetchRecommendationRefreshStatus(signal)
      .then(async (refreshStatus) => {
        const saved = await fetchSavedRecommendations(signal);
        return { saved, refreshStatus };
      })
      .then(
        ({ saved, refreshStatus }) => {
          if (
            signal.aborted ||
            currentSequence !== sequence.current
          ) {
            return;
          }

          setState((previous) => ({
            ...previous,
            saved,
            refreshStatus,
            loading: false,
            loadError: null,
          }));

          if (
            refreshStatus.processing_enabled &&
            isPending(refreshStatus)
          ) {
            timer.current = setTimeout(() => {
              timer.current = null;

              if (!signal.aborted && !document.hidden) {
                void load(signal);
              }
            }, RECOMMENDATION_POLL_INTERVAL_MS);
          }
        },
        (error: unknown) => {
          if (
            signal.aborted ||
            currentSequence !== sequence.current
          ) {
            return;
          }

          setState((previous) => ({
            ...previous,
            loading: false,
            loadError: asRequestError(error),
          }));
        },
      );
  }, []);

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;

    void load(current.signal);

    function resumeWhenVisible() {
      if (!document.hidden && !requesting.current) {
        void load(current.signal);
      }
    }

    document.addEventListener(
      "visibilitychange",
      resumeWhenVisible,
    );

    return () => {
      current.abort();
      sequence.current += 1;

      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }

      document.removeEventListener(
        "visibilitychange",
        resumeWhenVisible,
      );
    };
  }, [load]);

  const reload = useCallback((): Promise<void> => {
    const current = controller.current;

    if (!current || current.signal.aborted) {
      return Promise.resolve();
    }

    setState((previous) => ({
      ...previous,
      loading: true,
      loadError: null,
    }));

    return load(current.signal);
  }, [load]);

  const requestRefresh = useCallback(async (): Promise<void> => {
    const current = controller.current;

    if (
      requesting.current ||
      !current ||
      current.signal.aborted
    ) {
      return;
    }

    requesting.current = true;
    sequence.current += 1;

    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    setState((previous) => ({
      ...previous,
      requesting: true,
      refreshError: null,
    }));

    try {
      await enqueueRecommendationRefresh(current.signal);

      if (!current.signal.aborted) {
        await load(current.signal);
      }
    } catch (error) {
      if (!current.signal.aborted) {
        setState((previous) => ({
          ...previous,
          refreshError: asRequestError(error),
        }));
      }
    } finally {
      requesting.current = false;

      if (!current.signal.aborted) {
        setState((previous) => ({
          ...previous,
          requesting: false,
        }));
      }
    }
  }, [load]);

  return {
    ...state,
    refreshPending: isPending(state.refreshStatus),
    reload,
    requestRefresh,
  };
}