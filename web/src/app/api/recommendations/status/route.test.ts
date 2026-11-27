import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { GET } from "./route";

const { mockAuthorize, mockRpc } = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/recommendations/refresh-preferences", () => ({
  authorizeRecommendationAccess: mockAuthorize,
}));

const status = {
  status: "queued",
  stale: true,
  background_enabled: true,
  manual_pending: false,
  attempt_count: 0,
  max_attempts: 3,
  next_attempt_at: null,
  last_failure_code: null,
  generated_at: null,
  checked_at: null,
};

beforeEach(() => {
  vi.resetAllMocks();

  vi.stubEnv(
    "RECOMMENDATION_BACKGROUND_REFRESH_ENABLED",
    "false",
  );

  mockAuthorize.mockResolvedValue({
    success: true,
    userId: "fe300000-0000-4000-8000-000000000001",
    client: { rpc: mockRpc },
  });

  mockRpc.mockResolvedValue({
    data: status,
    error: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/recommendations/status", () => {
  it.each([
    ["false", false],
    ["true", true],
  ])(
    "reports processing_enabled for flag %s",
    async (flag, enabled) => {
      vi.stubEnv(
        "RECOMMENDATION_BACKGROUND_REFRESH_ENABLED",
        flag,
      );

      const response = await GET();

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        ...status,
        processing_enabled: enabled,
      });

      expect(mockRpc).toHaveBeenCalledExactlyOnceWith(
        "get_recommendation_refresh_status",
      );
    },
  );

  it("rejects signed-out requests before querying status", async () => {
    mockAuthorize.mockResolvedValue({
      success: false,
      code: "UNAUTHENTICATED",
      error: "Sign in again.",
    });

    expect((await GET()).status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects malformed database status data", async () => {
    mockRpc.mockResolvedValue({
      data: { ...status, status: "unexpected" },
      error: null,
    });

    expect((await GET()).status).toBe(500);
  });

  it("handles database errors safely", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Private database details" },
    });

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(
      "Private database details",
    );
  });

  it("handles unexpected exceptions safely", async () => {
    mockAuthorize.mockRejectedValue(
      new Error("Private configuration details"),
    );

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(
      "Private configuration details",
    );
  });

  it("marks status responses private and non-cacheable", async () => {
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
  });
});