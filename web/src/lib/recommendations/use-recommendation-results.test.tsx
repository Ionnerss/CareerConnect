// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import {
  RecommendationRequestError,
  type RefreshQueueResult,
  type RefreshStatusResult,
  type SavedRecommendationResults,
} from "./refresh-client";
import {
  RECOMMENDATION_POLL_INTERVAL_MS,
  useRecommendationResults,
} from "./use-recommendation-results";

const {
  mockSaved,
  mockStatus,
  mockEnqueue,
} = vi.hoisted(() => ({
  mockSaved: vi.fn(),
  mockStatus: vi.fn(),
  mockEnqueue: vi.fn(),
}));

vi.mock("./refresh-client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./refresh-client")>();

  return {
    ...original,
    fetchSavedRecommendations: mockSaved,
    fetchRecommendationRefreshStatus: mockStatus,
    enqueueRecommendationRefresh: mockEnqueue,
  };
});

function saved(id = "run-1"): SavedRecommendationResults {
  return {
    success: true,
    run: {
      id,
      created_at: "2026-11-27T00:00:00Z",
      completed_at: "2026-11-27T00:00:10Z",
      result_count: 0,
      summary_count: 0,
      ranking_mode: null,
    },
    recommendations: [],
  };
}

function status(
  value: RefreshStatusResult["status"] = "idle",
  processingEnabled = true,
): RefreshStatusResult {
  return {
    success: true,
    processing_enabled: processingEnabled,
    status: value,
    stale: value !== "idle",
    background_enabled: true,
    manual_pending: value === "queued",
    attempt_count: 0,
    max_attempts: 3,
    next_attempt_at: null,
    last_failure_code: null,
    generated_at: "2026-11-27T00:00:00Z",
    checked_at: "2026-11-27T00:00:10Z",
  };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.resetAllMocks();

  mockSaved.mockResolvedValue(saved());
  mockStatus.mockResolvedValue(status());
  mockEnqueue.mockResolvedValue({
    success: true,
    status: "queued",
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useRecommendationResults", () => {
  it("reads status and saved results without requesting generation", async () => {
    const { result } = renderHook(() =>
      useRecommendationResults(),
    );

    expect(result.current.loading).toBe(true);

    await settle();

    expect(result.current.saved?.run?.id).toBe("run-1");
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshPending).toBe(false);
    expect(mockEnqueue).not.toHaveBeenCalled();

    expect(mockStatus.mock.invocationCallOrder[0]).toBeLessThan(
      mockSaved.mock.invocationCallOrder[0],
    );
  });

  it("keeps saved results visible while requesting a refresh", async () => {
    let resolveQueue!: (value: RefreshQueueResult) => void;

    mockEnqueue.mockReturnValue(
      new Promise<RefreshQueueResult>((resolve) => {
        resolveQueue = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useRecommendationResults(),
    );

    await settle();

    let refreshPromise!: Promise<void>;

    act(() => {
      refreshPromise = result.current.requestRefresh();
    });

    expect(result.current.requesting).toBe(true);
    expect(result.current.saved?.run?.id).toBe("run-1");

    mockSaved.mockResolvedValue(saved("run-2"));

    await act(async () => {
      resolveQueue({ success: true, status: "queued" });
      await refreshPromise;
    });

    expect(result.current.saved?.run?.id).toBe("run-2");
    expect(result.current.requesting).toBe(false);
  });

  it("preserves the last saved result when reloading fails", async () => {
    const { result } = renderHook(() =>
      useRecommendationResults(),
    );

    await settle();

    mockStatus.mockRejectedValueOnce(
      new RecommendationRequestError("NETWORK"),
    );

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.saved?.run?.id).toBe("run-1");
    expect(result.current.loadError?.code).toBe("NETWORK");
    expect(result.current.loading).toBe(false);
  });

  it("suppresses duplicate refresh requests", async () => {
    let resolveQueue!: (value: RefreshQueueResult) => void;

    mockEnqueue.mockReturnValue(
      new Promise<RefreshQueueResult>((resolve) => {
        resolveQueue = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useRecommendationResults(),
    );

    await settle();

    let firstRequest!: Promise<void>;

    act(() => {
      firstRequest = result.current.requestRefresh();
    });

    await act(async () => {
      await result.current.requestRefresh();
    });

    expect(mockEnqueue).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveQueue({ success: true, status: "queued" });
      await firstRequest;
    });
  });

  it("retains saved content and cooldown information after rejection", async () => {
    const { result } = renderHook(() =>
      useRecommendationResults(),
    );

    await settle();

    mockEnqueue.mockRejectedValueOnce(
      new RecommendationRequestError("RATE_LIMITED", 60),
    );

    await act(async () => {
      await result.current.requestRefresh();
    });

    expect(result.current.saved?.run?.id).toBe("run-1");
    expect(result.current.refreshError?.code).toBe("RATE_LIMITED");
    expect(
      result.current.refreshError?.retryAfterSeconds,
    ).toBe(60);
    expect(result.current.requesting).toBe(false);
  });

  it("polls pending work and stops after completion", async () => {
    vi.useFakeTimers();

    mockStatus
      .mockResolvedValueOnce(status("queued"))
      .mockResolvedValue(status("idle"));

    mockSaved
      .mockResolvedValueOnce(saved("old-run"))
      .mockResolvedValue(saved("new-run"));

    const { result } = renderHook(() =>
      useRecommendationResults(),
    );

    await settle();

    expect(result.current.refreshPending).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        RECOMMENDATION_POLL_INTERVAL_MS,
      );
    });

    expect(result.current.saved?.run?.id).toBe("new-run");
    expect(result.current.refreshPending).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        RECOMMENDATION_POLL_INTERVAL_MS * 2,
      );
    });

    expect(mockStatus).toHaveBeenCalledTimes(2);
    expect(mockSaved).toHaveBeenCalledTimes(2);
  });

  it("does not poll while processing is disabled", async () => {
    vi.useFakeTimers();

    mockStatus.mockResolvedValue(status("queued", false));

    const { result } = renderHook(() =>
      useRecommendationResults(),
    );

    await settle();

    expect(result.current.refreshPending).toBe(true);
    expect(
      result.current.refreshStatus?.processing_enabled,
    ).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        RECOMMENDATION_POLL_INTERVAL_MS * 3,
      );
    });

    expect(mockStatus).toHaveBeenCalledTimes(1);
  });

  it("aborts requests and cancels polling when unmounted", async () => {
    vi.useFakeTimers();

    mockStatus.mockResolvedValue(status("running"));

    const { unmount } = renderHook(() =>
      useRecommendationResults(),
    );

    await settle();

    const signal = mockStatus.mock.calls[0][0] as AbortSignal;

    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        RECOMMENDATION_POLL_INTERVAL_MS * 2,
      );
    });

    expect(mockStatus).toHaveBeenCalledTimes(1);
  });

  it("preserves authentication errors without querying saved content", async () => {
    mockStatus.mockRejectedValue(
      new RecommendationRequestError("MFA_REQUIRED"),
    );

    const { result } = renderHook(() =>
      useRecommendationResults(),
    );

    await settle();

    expect(result.current.loadError?.code).toBe("MFA_REQUIRED");
    expect(result.current.saved).toBeNull();
    expect(mockSaved).not.toHaveBeenCalled();
  });

  it("ignores an older response that arrives after a newer reload", async () => {
    let resolveOld!: (
      value: SavedRecommendationResults,
    ) => void;

    mockSaved
      .mockReturnValueOnce(
        new Promise<SavedRecommendationResults>((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValue(saved("new-run"));

    const { result } = renderHook(() =>
      useRecommendationResults(),
    );

    await settle();

    expect(mockSaved).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.saved?.run?.id).toBe("new-run");

    await act(async () => {
      resolveOld(saved("old-run"));
      await Promise.resolve();
    });

    expect(result.current.saved?.run?.id).toBe("new-run");
  });
});