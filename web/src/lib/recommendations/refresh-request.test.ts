import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestRecommendationRefresh } from "./refresh-request";

const { mockAuthorize, mockRpc } = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("./refresh-preferences", () => ({
  authorizeRecommendationAccess: mockAuthorize,
}));

beforeEach(() => {
  vi.resetAllMocks();

  mockAuthorize.mockResolvedValue({
    success: true,
    userId: "fe100000-0000-4000-8000-000000000001",
    client: { rpc: mockRpc },
  });

  mockRpc.mockResolvedValue({
    data: "queued",
    error: null,
  });
});

describe("requestRecommendationRefresh", () => {
  it.each(["queued", "already_pending"] as const)(
    "returns the database queue result %s",
    async (status) => {
      mockRpc.mockResolvedValue({
        data: status,
        error: null,
      });

      expect(await requestRecommendationRefresh()).toEqual({
        success: true,
        status,
      });
    },
  );

  it.each([
    "UNAUTHENTICATED",
    "MFA_REQUIRED",
    "NOT_JOB_SEEKER",
  ] as const)(
    "stops before queueing when authorization returns %s",
    async (code) => {
      const failure = {
        success: false,
        code,
        error: "Access denied.",
      };

      mockAuthorize.mockResolvedValue(failure);

      expect(await requestRecommendationRefresh()).toEqual(
        failure,
      );

      expect(mockRpc).not.toHaveBeenCalled();
    },
  );

  it("returns a rate-limit response for the cooldown", async () => {
    mockRpc.mockResolvedValue({
      data: "rate_limited",
      error: null,
    });

    expect(await requestRecommendationRefresh()).toEqual({
      success: false,
      code: "RATE_LIMITED",
      error: "Please wait before requesting another refresh.",
    });
  });

  it("handles database errors without exposing their details", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Private database details" },
    });

    const result = await requestRecommendationRefresh();

    expect(result).toMatchObject({
      success: false,
      code: "LOAD_FAILED",
    });

    expect(JSON.stringify(result)).not.toContain(
      "Private database details",
    );
  });

  it("rejects an unexpected database response", async () => {
    mockRpc.mockResolvedValue({
      data: "unexpected",
      error: null,
    });

    expect(await requestRecommendationRefresh()).toMatchObject({
      success: false,
      code: "LOAD_FAILED",
    });
  });

  it("calls the queue function without a caller-selected identity", async () => {
    await requestRecommendationRefresh();

    expect(mockAuthorize).toHaveBeenCalledOnce();

    expect(mockRpc).toHaveBeenCalledExactlyOnceWith(
      "request_recommendation_refresh",
    );
  });
});