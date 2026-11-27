import { beforeEach, describe, expect, it, vi } from "vitest";
import { processRecommendationBatch } from "./worker-batch";

const {
  mockService,
  mockRpc,
  mockProcess,
  mockFail,
} = vi.hoisted(() => ({
  mockService: vi.fn(),
  mockRpc: vi.fn(),
  mockProcess: vi.fn(),
  mockFail: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockService,
}));

vi.mock("./worker", () => ({
  processRecommendationClaim: mockProcess,
}));

vi.mock("./worker-retry", () => ({
  failRecommendationRefresh: mockFail,
}));

const USER_A = "f9100000-0000-4000-8000-000000000001";
const USER_B = "f9100000-0000-4000-8000-000000000002";
const TOKEN_A = "f9200000-0000-4000-8000-000000000001";
const TOKEN_B = "f9200000-0000-4000-8000-000000000002";
const RUN_ID = "f9300000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();

  mockService.mockReturnValue({ rpc: mockRpc });

  mockRpc.mockImplementation(
    async (name: string, args: Record<string, unknown>) => {
      if (name === "recover_recommendation_refreshes") {
        return { data: 0, error: null };
      }

      if (name === "list_due_recommendation_refreshes") {
        return {
          data: [{ user_id: USER_A }, { user_id: USER_B }],
          error: null,
        };
      }

      if (name === "claim_recommendation_refresh") {
        return {
          data: [
            {
              claim_token:
                args.p_user_id === USER_A ? TOKEN_A : TOKEN_B,
            },
          ],
          error: null,
        };
      }

      throw new Error("Unexpected RPC");
    },
  );

  mockProcess.mockResolvedValue({
    success: true,
    run_id: RUN_ID,
  });

  mockFail.mockResolvedValue(true);
});

describe("processRecommendationBatch", () => {
  it("recovers before selection and processes the selected claims", async () => {
    expect(await processRecommendationBatch()).toEqual({
      success: true,
      stats: {
        recovered: 0,
        selected: 2,
        claimed: 2,
        succeeded: 2,
        failed: 0,
        skipped: 0,
        claim_errors: 0,
        cleanup_errors: 0,
      },
    });

    expect(mockRpc.mock.calls.slice(0, 2)).toEqual([
      [
        "recover_recommendation_refreshes",
        { p_limit: 25, p_retry_seconds: 60 },
      ],
      [
        "list_due_recommendation_refreshes",
        { p_limit: 5 },
      ],
    ]);

    expect(mockProcess.mock.calls).toEqual([
      [TOKEN_A],
      [TOKEN_B],
    ]);
  });

  it("processes claims sequentially within the batch", async () => {
    let active = 0;
    let peak = 0;

    mockProcess.mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;

      return { success: true, run_id: RUN_ID };
    });

    await processRecommendationBatch();

    expect(peak).toBe(1);
  });

  it("rejects invalid limits before creating a service client", async () => {
    expect(
      await processRecommendationBatch({ maxUsers: 0 }),
    ).toMatchObject({
      success: false,
      code: "INVALID_OPTIONS",
    });

    expect(mockService).not.toHaveBeenCalled();
  });

  it("reports missing service configuration safely", async () => {
    mockService.mockImplementation(() => {
      throw new Error("Private configuration details");
    });

    expect(await processRecommendationBatch()).toMatchObject({
      success: false,
      code: "SETUP_FAILED",
    });
  });

  it("stops when recovery fails", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Database unavailable" },
    });

    expect(await processRecommendationBatch()).toMatchObject({
      success: false,
      code: "RECOVERY_FAILED",
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("rejects selection results exceeding the requested limit", async () => {
    expect(
      await processRecommendationBatch({ maxUsers: 1 }),
    ).toMatchObject({
      success: false,
      code: "SELECTION_FAILED",
    });

    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("skips work that another invocation already claimed", async () => {
    mockRpc.mockResolvedValueOnce({ data: 0, error: null });
    mockRpc.mockResolvedValueOnce({
      data: [{ user_id: USER_A }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    expect(await processRecommendationBatch()).toMatchObject({
      success: true,
      stats: {
        claimed: 0,
        skipped: 1,
      },
    });

    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("continues after one claim query fails", async () => {
    mockRpc.mockResolvedValueOnce({ data: 0, error: null });
    mockRpc.mockResolvedValueOnce({
      data: [{ user_id: USER_A }, { user_id: USER_B }],
      error: null,
    });
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Claim query failed" },
    });

    expect(await processRecommendationBatch()).toMatchObject({
      success: true,
      stats: {
        claim_errors: 1,
        claimed: 1,
        succeeded: 1,
      },
    });

    expect(mockProcess).toHaveBeenCalledWith(TOKEN_B);
  });

  it("releases a claim when input loading fails", async () => {
    mockProcess
      .mockResolvedValueOnce({
        success: false,
        code: "LOAD_FAILED",
      })
      .mockResolvedValueOnce({
        success: true,
        run_id: RUN_ID,
      });

    expect(await processRecommendationBatch()).toMatchObject({
      success: true,
      stats: {
        failed: 1,
        succeeded: 1,
      },
    });

    expect(mockFail).toHaveBeenCalledWith(
      TOKEN_A,
      "load_failed",
    );
  });

  it("preserves a claim after reservation fails", async () => {
    mockProcess.mockResolvedValue({
      success: false,
      code: "RESERVATION_FAILED",
    });

    expect(await processRecommendationBatch()).toMatchObject({
      success: true,
      stats: {
        skipped: 2,
        failed: 0,
      },
    });

    expect(mockFail).not.toHaveBeenCalled();
  });

  it("counts generation failures already handled by the worker", async () => {
    mockProcess.mockResolvedValue({
      success: false,
      run_id: RUN_ID,
      code: "GENERATION_FAILED",
      cleanup_failed: false,
    });

    expect(await processRecommendationBatch()).toMatchObject({
      success: true,
      stats: {
        failed: 2,
        cleanup_errors: 0,
      },
    });

    expect(mockFail).not.toHaveBeenCalled();
  });

  it("counts cleanup errors reported by the worker", async () => {
    mockProcess.mockResolvedValue({
      success: false,
      run_id: RUN_ID,
      code: "PUBLICATION_FAILED",
      cleanup_failed: true,
    });

    expect(await processRecommendationBatch()).toMatchObject({
      success: true,
      stats: {
        failed: 2,
        cleanup_errors: 2,
      },
    });
  });

  it("handles an unexpected worker exception and continues", async () => {
    mockProcess
      .mockRejectedValueOnce(new Error("Unexpected failure"))
      .mockResolvedValueOnce({
        success: true,
        run_id: RUN_ID,
      });

    expect(await processRecommendationBatch()).toMatchObject({
      success: true,
      stats: {
        failed: 1,
        succeeded: 1,
      },
    });

    expect(mockFail).toHaveBeenCalledWith(
      TOKEN_A,
      "generation_failed",
    );
  });

  it("reports cleanup errors after an input-loading failure", async () => {
    mockProcess.mockResolvedValue({
      success: false,
      code: "LOAD_FAILED",
    });

    mockFail.mockRejectedValue(new Error("Database unavailable"));

    expect(await processRecommendationBatch()).toMatchObject({
      success: true,
      stats: {
        failed: 2,
        cleanup_errors: 2,
      },
    });
  });
});