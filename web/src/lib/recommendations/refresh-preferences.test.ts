import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecommendationRefreshPreference,
  setRecommendationRefreshPreference,
} from "./refresh-preferences";

const {
  mockGetUser,
  mockMfa,
  mockFrom,
  mockProfile,
  mockPreference,
  mockRpc,
  filters,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockMfa: vi.fn(),
  mockFrom: vi.fn(),
  mockProfile: vi.fn(),
  mockPreference: vi.fn(),
  mockRpc: vi.fn(),
  filters: [] as {
    table: string;
    column: string;
    value: unknown;
  }[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/auth/require-mfa", () => ({
  checkMfaForClient: mockMfa,
}));

const USER_ID = "fc100000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();
  filters.length = 0;

  mockGetUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });

  mockMfa.mockResolvedValue(null);

  mockProfile.mockResolvedValue({
    data: { role: "job_seeker" },
    error: null,
  });

  mockPreference.mockResolvedValue({
    data: { enabled: true },
    error: null,
  });

  mockRpc.mockResolvedValue({
    data: true,
    error: null,
  });

  mockFrom.mockImplementation((table: string) => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle:
        table === "profiles" ? mockProfile : mockPreference,
    };

    query.select.mockReturnValue(query);

    query.eq.mockImplementation(
      (column: string, value: unknown) => {
        filters.push({ table, column, value });
        return query;
      },
    );

    return query;
  });
});

describe("recommendation refresh preferences", () => {
  it("rejects signed-out requests before accessing tables", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    expect(
      await getRecommendationRefreshPreference(),
    ).toMatchObject({
      success: false,
      code: "UNAUTHENTICATED",
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects updates while MFA is pending", async () => {
    mockMfa.mockResolvedValue("MFA_REQUIRED");

    expect(
      await setRecommendationRefreshPreference(true),
    ).toMatchObject({
      success: false,
      code: "MFA_REQUIRED",
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fails closed when MFA cannot be checked", async () => {
    mockMfa.mockResolvedValue("AUTH_UNAVAILABLE");

    expect(
      await getRecommendationRefreshPreference(),
    ).toMatchObject({
      success: false,
      code: "AUTH_UNAVAILABLE",
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects recruiter updates", async () => {
    mockProfile.mockResolvedValue({
      data: { role: "recruiter" },
      error: null,
    });

    expect(
      await setRecommendationRefreshPreference(true),
    ).toMatchObject({
      success: false,
      code: "NOT_JOB_SEEKER",
    });

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns disabled when no preference row exists", async () => {
    mockPreference.mockResolvedValue({
      data: null,
      error: null,
    });

    expect(
      await getRecommendationRefreshPreference(),
    ).toEqual({
      success: true,
      enabled: false,
    });
  });

  it("reads preferences using only the authenticated owner", async () => {
    expect(
      await getRecommendationRefreshPreference(),
    ).toEqual({
      success: true,
      enabled: true,
    });

    expect(filters).toEqual([
      {
        table: "profiles",
        column: "id",
        value: USER_ID,
      },
      {
        table: "recommendation_refresh_preferences",
        column: "user_id",
        value: USER_ID,
      },
    ]);
  });

  it("handles preference read failures safely", async () => {
    mockPreference.mockResolvedValue({
      data: null,
      error: { message: "Private database details" },
    });

    expect(
      await getRecommendationRefreshPreference(),
    ).toMatchObject({
      success: false,
      code: "LOAD_FAILED",
    });
  });

  it.each([true, false])(
    "saves enabled=%s through the authenticated RPC",
    async (enabled) => {
      mockRpc.mockResolvedValue({
        data: enabled,
        error: null,
      });

      expect(
        await setRecommendationRefreshPreference(enabled),
      ).toEqual({
        success: true,
        enabled,
      });

      expect(mockRpc).toHaveBeenCalledExactlyOnceWith(
        "set_recommendation_background_refresh",
        { p_enabled: enabled },
      );
    },
  );

  it("rejects a database response that differs from the requested value", async () => {
    mockRpc.mockResolvedValue({
      data: false,
      error: null,
    });

    expect(
      await setRecommendationRefreshPreference(true),
    ).toMatchObject({
      success: false,
      code: "LOAD_FAILED",
    });
  });

  it("handles preference update failures safely", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Private database details" },
    });

    expect(
      await setRecommendationRefreshPreference(true),
    ).toMatchObject({
      success: false,
      code: "LOAD_FAILED",
    });
  });
});