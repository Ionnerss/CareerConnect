import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { BACKEND_ERROR } from "@/lib/recommendations/api-response";
import { GET, POST } from "./route";

const {
  mockGetRecommendations,
  mockGetSavedRecommendations,
  mockQueueRecommendationRefresh,
} = vi.hoisted(() => ({
  mockGetRecommendations: vi.fn(),
  mockGetSavedRecommendations: vi.fn(),
  mockQueueRecommendationRefresh: vi.fn(),
}));

// This mock guards against accidentally restoring synchronous generation.
vi.mock("@/lib/recommendations/recommend", () => ({
  getRecommendations: mockGetRecommendations,
}));

vi.mock("@/lib/recommendations/saved-recommendations", () => ({
  getSavedRecommendations: mockGetSavedRecommendations,
}));

vi.mock("./refresh/route", () => ({
  POST: mockQueueRecommendationRefresh,
}));

const NO_STORE = {
  "Cache-Control": "private, no-store",
};

function savedRun() {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    created_at: "2026-11-27T12:00:00.000Z",
    completed_at: "2026-11-27T12:01:00.000Z",
    result_count: 1,
    summary_count: 0,
    ranking_mode: "code_only",
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  expect(mockGetRecommendations).not.toHaveBeenCalled();
});

describe("GET /api/recommendations", () => {
  it("returns saved recommendations without queuing work", async () => {
    const result = {
      success: true,
      run: savedRun(),
      recommendations: [
        {
          job: {
            id: "33333333-3333-4333-8333-333333333333",
          },
          score: 75,
          match_score: 75,
          fit: null,
          fit_error: null,
          fit_generated_at: null,
          skill_match: null,
          reasons: ["You have relevant Java skills"],
          summary: null,
        },
      ],
    };

    mockGetSavedRecommendations.mockResolvedValueOnce(result);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
    expect(await response.json()).toEqual(result);

    expect(mockGetSavedRecommendations).toHaveBeenCalledOnce();
    expect(mockGetSavedRecommendations).toHaveBeenCalledWith();
    expect(mockQueueRecommendationRefresh).not.toHaveBeenCalled();
  });

  it("distinguishes no saved run from an empty successful run", async () => {
    const noRunResult = {
      success: true,
      run: null,
      recommendations: [],
    };

    mockGetSavedRecommendations.mockResolvedValueOnce(
      noRunResult,
    );

    const noRunResponse = await GET();

    expect(noRunResponse.status).toBe(200);
    expect(await noRunResponse.json()).toEqual(noRunResult);

    const emptyRunResult = {
      success: true,
      run: {
        ...savedRun(),
        result_count: 0,
        ranking_mode: null,
      },
      recommendations: [],
    };

    mockGetSavedRecommendations.mockResolvedValueOnce(
      emptyRunResult,
    );

    const emptyRunResponse = await GET();

    expect(emptyRunResponse.status).toBe(200);
    expect(await emptyRunResponse.json()).toEqual(
      emptyRunResult,
    );

    expect(mockQueueRecommendationRefresh).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAUTHENTICATED", 401],
    ["MFA_REQUIRED", 403],
    ["NOT_JOB_SEEKER", 403],
    ["AUTH_UNAVAILABLE", 503],
    ["LOAD_FAILED", 500],
  ] as const)(
    "maps saved-read failure %s to HTTP %i",
    async (code, status) => {
      const result = {
        success: false,
        code,
        error: "Readable message.",
      };

      mockGetSavedRecommendations.mockResolvedValueOnce(
        result,
      );

      const response = await GET();

      expect(response.status).toBe(status);
      expect(response.headers.get("Cache-Control")).toBe(
        "private, no-store",
      );
      expect(await response.json()).toEqual(result);

      expect(mockQueueRecommendationRefresh).not.toHaveBeenCalled();
    },
  );

  it("returns a safe error when the saved reader throws", async () => {
    mockGetSavedRecommendations.mockRejectedValueOnce(
      new Error("connection string postgres://secret"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
    expect(body).toEqual({
      success: false,
      code: "BACKEND_ERROR",
      error: BACKEND_ERROR,
    });

    expect(JSON.stringify(body)).not.toContain("postgres");
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(mockQueueRecommendationRefresh).not.toHaveBeenCalled();
  });
});

describe("POST /api/recommendations", () => {
  it.each(["queued", "already_pending"] as const)(
    "returns the queue handler's %s acknowledgement unchanged",
    async (status) => {
      const body = {
        success: true,
        status,
      };

      const queuedResponse = Response.json(body, {
        status: 202,
        headers: NO_STORE,
      });

      mockQueueRecommendationRefresh.mockResolvedValueOnce(
        queuedResponse,
      );

      const response = await POST();

      expect(response).toBe(queuedResponse);
      expect(response.status).toBe(202);
      expect(response.headers.get("Cache-Control")).toBe(
        "private, no-store",
      );
      expect(await response.json()).toEqual(body);

      expect(mockQueueRecommendationRefresh).toHaveBeenCalledOnce();
      expect(mockQueueRecommendationRefresh).toHaveBeenCalledWith();
      expect(mockGetSavedRecommendations).not.toHaveBeenCalled();
    },
  );

  it("preserves cooldown status and Retry-After", async () => {
    const body = {
      success: false,
      code: "RATE_LIMITED",
      error: "Please wait before requesting another refresh.",
    };

    const queuedResponse = Response.json(body, {
      status: 429,
      headers: {
        ...NO_STORE,
        "Retry-After": "60",
      },
    });

    mockQueueRecommendationRefresh.mockResolvedValueOnce(
      queuedResponse,
    );

    const response = await POST();

    expect(response).toBe(queuedResponse);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
    expect(await response.json()).toEqual(body);

    expect(mockGetSavedRecommendations).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAUTHENTICATED", 401],
    ["MFA_REQUIRED", 403],
    ["NOT_JOB_SEEKER", 403],
    ["AUTH_UNAVAILABLE", 503],
    ["LOAD_FAILED", 500],
    ["BACKEND_ERROR", 500],
  ] as const)(
    "preserves the queue handler's %s response",
    async (code, status) => {
      const body = {
        success: false,
        code,
        error: "Readable queue error.",
      };

      const queuedResponse = Response.json(body, {
        status,
        headers: NO_STORE,
      });

      mockQueueRecommendationRefresh.mockResolvedValueOnce(
        queuedResponse,
      );

      const response = await POST();

      expect(response).toBe(queuedResponse);
      expect(response.status).toBe(status);
      expect(response.headers.get("Cache-Control")).toBe(
        "private, no-store",
      );
      expect(await response.json()).toEqual(body);

      expect(mockQueueRecommendationRefresh).toHaveBeenCalledOnce();
      expect(mockGetSavedRecommendations).not.toHaveBeenCalled();
    },
  );

  it("does not forward browser-supplied identity to the queue handler", async () => {
    mockQueueRecommendationRefresh.mockResolvedValueOnce(
      Response.json(
        {
          success: true,
          status: "queued",
        },
        {
          status: 202,
          headers: NO_STORE,
        },
      ),
    );

    // Route handlers can receive a Request even when their implementation
    // does not consume it.
    const invokePost: (request: Request) => Promise<Response> =
      POST;

    const request = new Request(
      "https://careerconnect.example/api/recommendations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: "99999999-9999-4999-8999-999999999999",
        }),
      },
    );

    const response = await invokePost(request);

    expect(response.status).toBe(202);
    expect(mockQueueRecommendationRefresh).toHaveBeenCalledOnce();
    expect(mockQueueRecommendationRefresh).toHaveBeenCalledWith();
    expect(mockGetSavedRecommendations).not.toHaveBeenCalled();
  });
});