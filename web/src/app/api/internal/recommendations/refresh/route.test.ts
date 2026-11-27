import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { POST } from "./route";

const { mockBatch } = vi.hoisted(() => ({
  mockBatch: vi.fn(),
}));

vi.mock("@/lib/recommendations/worker-batch", () => ({
  processRecommendationBatch: mockBatch,
}));

const SECRET = "test-worker-secret-used-only-in-unit-tests";

const stats = {
  recovered: 0,
  selected: 1,
  claimed: 1,
  succeeded: 1,
  failed: 0,
  skipped: 0,
  claim_errors: 0,
  cleanup_errors: 0,
};

function request(
  authorization: string | null = `Bearer ${SECRET}`,
  body?: string,
) {
  const headers = new Headers();

  if (authorization !== null) {
    headers.set("authorization", authorization);
  }

  return new Request(
    "http://localhost/api/internal/recommendations/refresh",
    {
      method: "POST",
      headers,
      body,
    },
  );
}

beforeEach(() => {
  vi.resetAllMocks();

  vi.stubEnv("RECOMMENDATION_WORKER_SECRET", SECRET);
  vi.stubEnv("RECOMMENDATION_BACKGROUND_REFRESH_ENABLED", "true");

  mockBatch.mockResolvedValue({
    success: true,
    stats,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST internal recommendation refresh", () => {
  it("refuses execution when the worker secret is missing", async () => {
    vi.stubEnv("RECOMMENDATION_WORKER_SECRET", "");

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      code: "WORKER_NOT_CONFIGURED",
    });

    expect(mockBatch).not.toHaveBeenCalled();
  });

  it.each([
    null,
    "Bearer incorrect-secret",
    SECRET,
    `Bearer ${SECRET}-extra`,
  ])("rejects invalid authorization %s", async (authorization) => {
    const response = await POST(request(authorization));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      code: "UNAUTHORIZED",
    });

    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("skips execution while background refresh is disabled", async () => {
    vi.stubEnv("RECOMMENDATION_BACKGROUND_REFRESH_ENABLED", "false");

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      skipped: true,
      reason: "DISABLED",
    });

    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("defaults to disabled when the enabled flag is missing", async () => {
    vi.stubEnv("RECOMMENDATION_BACKGROUND_REFRESH_ENABLED", "");

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      skipped: true,
      reason: "DISABLED",
    });

    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("runs one batch with server-controlled limits", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      stats,
    });

    expect(mockBatch).toHaveBeenCalledExactlyOnceWith({
      maxUsers: 1,
      leaseSeconds: 300,
      recoveryLimit: 25,
    });
  });

  it("ignores caller-supplied users and batch limits", async () => {
    await POST(
      request(
        `Bearer ${SECRET}`,
        JSON.stringify({
          maxUsers: 1000,
          user_id: "caller-selected-user",
        }),
      ),
    );

    expect(mockBatch).toHaveBeenCalledExactlyOnceWith({
      maxUsers: 1,
      leaseSeconds: 300,
      recoveryLimit: 25,
    });
  });

  it("returns a safe response when batch setup fails", async () => {
    mockBatch.mockResolvedValue({
      success: false,
      code: "RECOVERY_FAILED",
      stats,
    });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      code: "BATCH_FAILED",
      stats,
    });
  });

  it("does not expose unexpected exception details", async () => {
    mockBatch.mockRejectedValue(
      new Error("Private database and credential details"),
    );

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      code: "WORKER_FAILED",
    });
  });

  it("marks responses private and non-cacheable", async () => {
    const response = await POST(request());

    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
  });
});