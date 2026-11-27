import { beforeEach, describe, expect, it, vi } from "vitest";
import { failRecommendationRefresh } from "./worker-retry";

const {
  mockCreateServiceClient,
  mockFrom,
  mockSelect,
  mockEq,
  mockMaybeSingle,
  mockRpc,
} = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockCreateServiceClient,
}));

const TOKEN = "f3100000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();

  const query = {
    select: mockSelect,
    eq: mockEq,
    maybeSingle: mockMaybeSingle,
  };

  mockFrom.mockReturnValue(query);
  mockSelect.mockReturnValue(query);
  mockEq.mockReturnValue(query);

  mockCreateServiceClient.mockReturnValue({
    from: mockFrom,
    rpc: mockRpc,
  });

  mockMaybeSingle.mockResolvedValue({
    data: { attempt_count: 1 },
    error: null,
  });

  mockRpc.mockResolvedValue({
    data: true,
    error: null,
  });
});

describe("failRecommendationRefresh", () => {
  it.each([
    [1, 60],
    [2, 120],
    [3, 240],
    [10, 3600],
  ])(
    "uses a %i-attempt delay of %i seconds",
    async (attempt, delay) => {
      mockMaybeSingle.mockResolvedValue({
        data: { attempt_count: attempt },
        error: null,
      });

      await expect(
        failRecommendationRefresh(TOKEN, "generation_failed"),
      ).resolves.toBe(true);

      expect(mockFrom).toHaveBeenCalledWith(
        "recommendation_refresh_state",
      );
      expect(mockSelect).toHaveBeenCalledWith("attempt_count");
      expect(mockEq).toHaveBeenCalledWith("claim_token", TOKEN);

      expect(mockRpc).toHaveBeenCalledWith(
        "fail_recommendation_refresh",
        {
          p_claim_token: TOKEN,
          p_failure_code: "generation_failed",
          p_retry_seconds: delay,
        },
      );
    },
  );

  it("passes publication failures to the database", async () => {
    await failRecommendationRefresh(TOKEN, "publication_failed");

    expect(mockRpc).toHaveBeenCalledWith(
      "fail_recommendation_refresh",
      {
        p_claim_token: TOKEN,
        p_failure_code: "publication_failed",
        p_retry_seconds: 60,
      },
    );
  });

  it("returns false when the claim no longer exists", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      failRecommendationRefresh(TOKEN, "generation_failed"),
    ).resolves.toBe(false);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns false when ownership changes before the RPC", async () => {
    mockRpc.mockResolvedValue({
      data: false,
      error: null,
    });

    await expect(
      failRecommendationRefresh(TOKEN, "generation_failed"),
    ).resolves.toBe(false);
  });

  it("rejects invalid tokens before opening a service client", async () => {
    await expect(
      failRecommendationRefresh("invalid", "generation_failed"),
    ).rejects.toThrow("Invalid recommendation claim token");

    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it("fails safely when the claim query fails", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "Private database details" },
    });

    await expect(
      failRecommendationRefresh(TOKEN, "generation_failed"),
    ).rejects.toThrow("Unable to read recommendation retry state");

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects invalid attempt counts", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { attempt_count: 0 },
      error: null,
    });

    await expect(
      failRecommendationRefresh(TOKEN, "generation_failed"),
    ).rejects.toThrow("Invalid recommendation attempt count");

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fails safely when the failure RPC fails", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Private database details" },
    });

    await expect(
      failRecommendationRefresh(TOKEN, "generation_failed"),
    ).rejects.toThrow(
      "Unable to record recommendation refresh failure",
    );
  });

  it("rejects an unexpected RPC response", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      failRecommendationRefresh(TOKEN, "generation_failed"),
    ).rejects.toThrow(
      "Unable to record recommendation refresh failure",
    );
  });
});