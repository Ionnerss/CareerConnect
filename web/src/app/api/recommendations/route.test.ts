import { beforeEach, describe, expect, it, vi } from "vitest";
import { JevError } from "@/lib/ai/jev";
import {
  AI_NOT_CONFIGURED_ERROR,
  BACKEND_ERROR,
  RECOMMENDATIONS_ERROR_STATUS,
} from "@/lib/recommendations/api-response";
import { GET, POST } from "./route";

const { mockGetRecommendations, mockGetSavedRecommendations } = vi.hoisted(
  () => ({
    mockGetRecommendations: vi.fn(),
    mockGetSavedRecommendations: vi.fn(),
  }),
);

vi.mock("@/lib/recommendations/recommend", () => ({
  getRecommendations: mockGetRecommendations,
}));

vi.mock("@/lib/recommendations/saved-recommendations", () => ({
  getSavedRecommendations: mockGetSavedRecommendations,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/recommendations", () => {
  it("returns the latest saved recommendations without starting a refresh", async () => {
    const result = {
      success: true,
      run: {
        id: "22222222-2222-4222-8222-222222222222",
        created_at: "2026-11-15T10:00:00Z",
        completed_at: "2026-11-15T10:01:00Z",
        result_count: 1,
        summary_count: 0,
        ranking_mode: "code_only",
      },
      recommendations: [
        {
          job: { id: "33333333-3333-4333-8333-333333333333" },
          score: 75,
          match_score: 75,
          fit: null,
          fit_error: "timeout",
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
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(result);
    expect(mockGetSavedRecommendations).toHaveBeenCalledOnce();
    expect(mockGetSavedRecommendations).toHaveBeenCalledWith();
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });

  it("distinguishes no saved run from an empty successful run", async () => {
    mockGetSavedRecommendations.mockResolvedValueOnce({
      success: true,
      run: null,
      recommendations: [],
    });

    const noRun = await GET();

    expect(noRun.status).toBe(200);
    expect(await noRun.json()).toEqual({
      success: true,
      run: null,
      recommendations: [],
    });

    const emptyRun = {
      id: "22222222-2222-4222-8222-222222222222",
      created_at: "2026-11-15T10:00:00Z",
      completed_at: "2026-11-15T10:01:00Z",
      result_count: 0,
      summary_count: 0,
      ranking_mode: null,
    };
    mockGetSavedRecommendations.mockResolvedValueOnce({
      success: true,
      run: emptyRun,
      recommendations: [],
    });

    const emptySuccess = await GET();

    expect(emptySuccess.status).toBe(200);
    expect(await emptySuccess.json()).toEqual({
      success: true,
      run: emptyRun,
      recommendations: [],
    });
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAUTHENTICATED", 401],
    ["MFA_REQUIRED", 403],
    ["NOT_JOB_SEEKER", 403],
    ["AUTH_UNAVAILABLE", 503],
    ["LOAD_FAILED", 500],
  ] as const)("maps %s to HTTP %i", async (code, status) => {
    mockGetSavedRecommendations.mockResolvedValueOnce({
      success: false,
      code,
      error: "Readable message.",
    });

    const response = await GET();

    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      success: false,
      code,
      error: "Readable message.",
    });
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });

  it("returns a safe error when the saved reader throws", async () => {
    mockGetSavedRecommendations.mockRejectedValueOnce(
      new Error("connection string postgres://secret"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toEqual({
      success: false,
      code: "BACKEND_ERROR",
      error: BACKEND_ERROR,
    });
    expect(JSON.stringify(body)).not.toContain("postgres");
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });
});

describe("POST /api/recommendations", () => {
  it("returns freshly generated recommendations", async () => {
    const result = {
      success: true,
      empty_profile: false,
      considered_jobs: 4,
      recommendations: [
        { job: { id: "a" }, score: 88, summary: "A good fit." },
      ],
      ai_ranked: true,
      summary_status: "ok",
    };
    mockGetRecommendations.mockResolvedValueOnce(result);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(mockGetRecommendations).toHaveBeenCalledOnce();
    expect(mockGetSavedRecommendations).not.toHaveBeenCalled();
  });

  it("never lets the browser or a proxy cache a response", async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      success: true,
      recommendations: [],
    });

    expect((await POST()).headers.get("Cache-Control")).toBe(
      "private, no-store",
    );

    mockGetRecommendations.mockResolvedValueOnce({
      success: false,
      code: "UNAUTHENTICATED",
      error: "x",
    });

    expect((await POST()).headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
  });

  it("does not use request data to choose the seeker", async () => {
    mockGetRecommendations.mockResolvedValueOnce({
      success: true,
      recommendations: [],
    });

    await POST();

    expect(mockGetRecommendations).toHaveBeenCalledWith();
  });

  it.each([
    ["UNAUTHENTICATED", 401],
    ["MFA_REQUIRED", 403],
    ["NOT_JOB_SEEKER", 403],
    ["AUTH_UNAVAILABLE", 503],
    ["LOAD_FAILED", 500],
  ] as const)("maps %s to HTTP %i and keeps the message", async (code, status) => {
    mockGetRecommendations.mockResolvedValueOnce({
      success: false,
      code,
      error: "Readable message.",
    });

    const response = await POST();

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({
      success: false,
      code,
      error: "Readable message.",
    });
  });

  it("answers 503 without exposing the missing Jev key", async () => {
    mockGetRecommendations.mockRejectedValueOnce(
      new JevError(
        "missing_key",
        "AI_GATEWAY_API_KEY is not set on the server.",
      ),
    );

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      success: false,
      code: "AI_NOT_CONFIGURED",
      error: AI_NOT_CONFIGURED_ERROR,
    });
    expect(JSON.stringify(body)).not.toContain("AI_GATEWAY_API_KEY");
  });

  it("answers 500 without leaking unexpected errors", async () => {
    mockGetRecommendations.mockRejectedValueOnce(
      new Error("connection string postgres://secret"),
    );

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      code: "BACKEND_ERROR",
      error: BACKEND_ERROR,
    });
    expect(JSON.stringify(body)).not.toContain("postgres");

    mockGetRecommendations.mockRejectedValueOnce(
      new JevError("timeout", "Jev did not answer within 20000 ms."),
    );

    expect((await POST()).status).toBe(500);
  });

  it("has an HTTP status for every error code", () => {
    for (const status of Object.values(RECOMMENDATIONS_ERROR_STATUS)) {
      expect(status).toBeGreaterThanOrEqual(400);
    }

    expect(Object.keys(RECOMMENDATIONS_ERROR_STATUS).sort()).toEqual(
      [
        "AI_NOT_CONFIGURED",
        "AUTH_UNAVAILABLE",
        "BACKEND_ERROR",
        "LOAD_FAILED",
        "MFA_REQUIRED",
        "NOT_JOB_SEEKER",
        "UNAUTHENTICATED",
      ].sort(),
    );
  });
});