import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { mockRequestRefresh } = vi.hoisted(() => ({
  mockRequestRefresh: vi.fn(),
}));

vi.mock("@/lib/recommendations/refresh-request", () => ({
  requestRecommendationRefresh: mockRequestRefresh,
}));

beforeEach(() => {
  vi.resetAllMocks();

  mockRequestRefresh.mockResolvedValue({
    success: true,
    status: "queued",
  });
});

describe("POST /api/recommendations/refresh", () => {
  it.each(["queued", "already_pending"] as const)(
    "returns 202 for %s work",
    async (status) => {
      mockRequestRefresh.mockResolvedValue({
        success: true,
        status,
      });

      const response = await POST();

      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({
        success: true,
        status,
      });
    },
  );

  it.each([
    ["UNAUTHENTICATED", 401],
    ["MFA_REQUIRED", 403],
    ["NOT_JOB_SEEKER", 403],
    ["AUTH_UNAVAILABLE", 503],
  ] as const)(
    "maps %s to HTTP %i",
    async (code, status) => {
      mockRequestRefresh.mockResolvedValue({
        success: false,
        code,
        error: "Unable to continue.",
      });

      const response = await POST();

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({
        success: false,
        code,
        error: "Unable to continue.",
      });
    },
  );

  it("returns 429 and retry guidance during cooldown", async () => {
    mockRequestRefresh.mockResolvedValue({
      success: false,
      code: "RATE_LIMITED",
      error: "Please wait before requesting another refresh.",
    });

    const response = await POST();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("does not expose unexpected exception details", async () => {
    mockRequestRefresh.mockRejectedValue(
      new Error("Private database and credential details"),
    );

    const response = await POST();

    expect(response.status).toBe(500);

    const body = await response.json();

    expect(body).toMatchObject({
      success: false,
      code: "BACKEND_ERROR",
    });

    expect(JSON.stringify(body)).not.toContain(
      "Private database and credential details",
    );
  });

  it("marks successful and rejected responses non-cacheable", async () => {
    const accepted = await POST();

    mockRequestRefresh.mockResolvedValue({
      success: false,
      code: "RATE_LIMITED",
      error: "Please wait.",
    });

    const rejected = await POST();

    expect(accepted.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );

    expect(rejected.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
  });
});