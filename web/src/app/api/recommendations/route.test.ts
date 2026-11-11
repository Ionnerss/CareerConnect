import { beforeEach, describe, expect, it, vi } from "vitest";
import { JevError } from "@/lib/ai/jev";
import {
  AI_NOT_CONFIGURED_ERROR,
  BACKEND_ERROR,
  RECOMMENDATIONS_ERROR_STATUS,
} from "@/lib/recommendations/api-response";
import { POST } from "./route";

const { mockGetRecommendations } = vi.hoisted(() => ({ mockGetRecommendations: vi.fn() }));

vi.mock("@/lib/recommendations/recommend", () => ({ getRecommendations: mockGetRecommendations }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/recommendations", () => {
  it("returns the recommendations for a signed-in job seeker", async () => {
    const result = {
      success: true,
      empty_profile: false,
      considered_jobs: 4,
      recommendations: [{ job: { id: "a" }, score: 88, summary: "A good fit." }],
      ai_ranked: true,
      summary_status: "ok",
    };
    mockGetRecommendations.mockResolvedValueOnce(result);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(mockGetRecommendations).toHaveBeenCalledTimes(1);
  });

  it("never lets the browser or a proxy cache a response", async () => {
    mockGetRecommendations.mockResolvedValueOnce({ success: true, recommendations: [] });

    expect((await POST()).headers.get("Cache-Control")).toBe("private, no-store");

    mockGetRecommendations.mockResolvedValueOnce({ success: false, code: "UNAUTHENTICATED", error: "x" });

    expect((await POST()).headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("does not use anything from the request to pick whose profile is used", async () => {
    mockGetRecommendations.mockResolvedValueOnce({ success: true, recommendations: [] });

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
    mockGetRecommendations.mockResolvedValueOnce({ success: false, code, error: "Readable message." });

    const response = await POST();

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ success: false, code, error: "Readable message." });
  });

  it("answers 503 with a plain message when the Jev key is not set up", async () => {
    mockGetRecommendations.mockRejectedValueOnce(
      new JevError("missing_key", "AI_GATEWAY_API_KEY is not set on the server."),
    );

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ success: false, code: "AI_NOT_CONFIGURED", error: AI_NOT_CONFIGURED_ERROR });
    expect(JSON.stringify(body)).not.toContain("AI_GATEWAY_API_KEY");
  });

  it("answers 500 without leaking details when something unexpected is thrown", async () => {
    mockGetRecommendations.mockRejectedValueOnce(new Error("connection string postgres://secret"));

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ success: false, code: "BACKEND_ERROR", error: BACKEND_ERROR });
    expect(JSON.stringify(body)).not.toContain("postgres");

    mockGetRecommendations.mockRejectedValueOnce(new JevError("timeout", "Jev did not answer within 20000 ms."));

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
