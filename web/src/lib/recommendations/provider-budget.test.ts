import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBudgetedRecommendationProviders } from "./provider-budget";

const {
  mockService,
  mockRpc,
  mockAsk,
  mockComplete,
} = vi.hoisted(() => ({
  mockService: vi.fn(),
  mockRpc: vi.fn(),
  mockAsk: vi.fn(),
  mockComplete: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockService,
}));

vi.mock("@/lib/ai/jev", () => ({
  askJevScores: mockAsk,
}));

vi.mock("./summaries", () => ({
  groqComplete: mockComplete,
}));

const USER_ID = "fb100000-0000-4000-8000-000000000001";
const TOKEN = "fb200000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();

  mockService.mockReturnValue({ rpc: mockRpc });

  mockRpc.mockImplementation(async (name: string) => {
    if (name === "reserve_recommendation_provider_call") {
      return { data: TOKEN, error: null };
    }

    if (name === "release_recommendation_provider_call") {
      return { data: true, error: null };
    }

    throw new Error("Unexpected RPC");
  });

  mockAsk.mockResolvedValue({});
  mockComplete.mockResolvedValue('{"summaries":[]}');
});

describe("createBudgetedRecommendationProviders", () => {
  it("reserves and releases capacity around a Jev call", async () => {
    const providers = createBudgetedRecommendationProviders(USER_ID);

    await expect(providers.options.ask({}, {})).resolves.toEqual({});

    expect(mockRpc.mock.calls).toEqual([
      [
        "reserve_recommendation_provider_call",
        {
          p_user_id: USER_ID,
          p_provider: "jev",
          p_lease_seconds: 60,
        },
      ],
      [
        "release_recommendation_provider_call",
        { p_token: TOKEN },
      ],
    ]);

    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(
      mockAsk.mock.invocationCallOrder[0],
    );

    expect(mockAsk.mock.invocationCallOrder[0]).toBeLessThan(
      mockRpc.mock.invocationCallOrder[1],
    );

    expect(() => providers.assertAvailable()).not.toThrow();
  });

  it("uses the Groq budget for summaries", async () => {
    const providers = createBudgetedRecommendationProviders(USER_ID);
    const messages = [
      { role: "user" as const, content: "Test input" },
    ];

    await providers.options.complete(messages);

    expect(mockComplete).toHaveBeenCalledWith(messages);

    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_recommendation_provider_call",
      {
        p_user_id: USER_ID,
        p_provider: "groq",
        p_lease_seconds: 60,
      },
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "release_recommendation_provider_call",
      { p_token: TOKEN },
    );
  });

  it("blocks provider calls when no reservation is available", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const providers = createBudgetedRecommendationProviders(USER_ID);

    await expect(
      providers.options.ask({}, {}),
    ).rejects.toThrow(
      "Recommendation provider budget is unavailable",
    );

    expect(mockAsk).not.toHaveBeenCalled();

    expect(() => providers.assertAvailable()).toThrow(
      "Recommendation provider budget is unavailable",
    );
  });

  it("fails closed when reservation lookup fails", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Private database details" },
    });

    const providers = createBudgetedRecommendationProviders(USER_ID);

    await expect(
      providers.options.ask({}, {}),
    ).rejects.toThrow(
      "Recommendation provider budget is unavailable",
    );

    expect(mockAsk).not.toHaveBeenCalled();
  });

  it("releases capacity after an ordinary provider failure", async () => {
    mockAsk.mockRejectedValue(new Error("Provider timeout"));

    const providers = createBudgetedRecommendationProviders(USER_ID);

    await expect(
      providers.options.ask({}, {}),
    ).rejects.toThrow("Provider timeout");

    expect(mockRpc).toHaveBeenCalledWith(
      "release_recommendation_provider_call",
      { p_token: TOKEN },
    );

    // An ordinary provider failure can use the existing fallback rules.
    expect(() => providers.assertAvailable()).not.toThrow();
  });

  it("prevents publication when capacity release fails", async () => {
    mockRpc.mockResolvedValueOnce({
      data: TOKEN,
      error: null,
    });

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Release failed" },
    });

    const providers = createBudgetedRecommendationProviders(USER_ID);

    await expect(
      providers.options.ask({}, {}),
    ).rejects.toThrow(
      "Unable to release recommendation provider capacity",
    );

    expect(() => providers.assertAvailable()).toThrow(
      "Recommendation provider budget is unavailable",
    );
  });

  it("serializes Jev calls within the worker attempt", async () => {
    let active = 0;
    let peak = 0;

    mockAsk.mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);

      await Promise.resolve();

      active -= 1;
      return {};
    });

    const providers = createBudgetedRecommendationProviders(USER_ID);

    await Promise.all([
      providers.options.ask({}, {}),
      providers.options.ask({}, {}),
      providers.options.ask({}, {}),
    ]);

    expect(mockAsk).toHaveBeenCalledTimes(3);
    expect(peak).toBe(1);
  });

  it("stops further reservations after a budget denial", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const providers = createBudgetedRecommendationProviders(USER_ID);

    await expect(
      providers.options.ask({}, {}),
    ).rejects.toThrow();

    await expect(
      providers.options.complete([]),
    ).rejects.toThrow();

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockAsk).not.toHaveBeenCalled();
    expect(mockComplete).not.toHaveBeenCalled();
  });
});