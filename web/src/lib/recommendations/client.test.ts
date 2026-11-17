/** Tests the browser helper that calls POST /api/recommendations (dashboard card). */

import { describe, expect, it, vi } from "vitest";
import {
  GENERIC_ERROR,
  NETWORK_ERROR,
  matchLabel,
  requestRecommendations,
} from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const success = {
  success: true,
  empty_profile: false,
  considered_jobs: 3,
  recommendations: [],
  ai_ranked: true,
  summary_status: "skipped",
};

describe("requestRecommendations", () => {
  it("sends a POST to the endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(success));

    await requestRecommendations(undefined, fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/recommendations", { method: "POST", signal: undefined });
  });

  it("returns the data on success", async () => {
    const result = await requestRecommendations(undefined, vi.fn().mockResolvedValue(jsonResponse(success)));

    expect(result).toEqual({ ok: true, data: success });
  });

  it("passes the endpoint's error code and message through", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ success: false, code: "NOT_JOB_SEEKER", error: "Only job seekers can get recommendations." }, 403),
    );

    expect(await requestRecommendations(undefined, fetcher)).toEqual({
      ok: false,
      code: "NOT_JOB_SEEKER",
      error: "Only job seekers can get recommendations.",
    });
  });

  it("uses a generic message when an error has no text", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ success: false, code: "LOAD_FAILED", error: " " }, 500));

    expect(await requestRecommendations(undefined, fetcher)).toEqual({
      ok: false,
      code: "LOAD_FAILED",
      error: GENERIC_ERROR,
    });
  });

  it("reports a network error when the request fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await requestRecommendations(undefined, fetcher)).toEqual({
      ok: false,
      code: "NETWORK",
      error: NETWORK_ERROR,
    });
  });

  it("reports a backend error for a body that is not JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("<html>oops</html>", { status: 502 }));

    expect(await requestRecommendations(undefined, fetcher)).toEqual({
      ok: false,
      code: "BACKEND_ERROR",
      error: GENERIC_ERROR,
    });
  });

  it("reports a backend error for JSON of the wrong shape", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ success: true, recommendations: "nope" }));

    expect((await requestRecommendations(undefined, fetcher)).ok).toBe(false);
  });

  it("rethrows when the request was aborted, so the caller can ignore it", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));

    await expect(requestRecommendations(controller.signal, fetcher)).rejects.toThrow("Aborted");
  });
});

describe("matchLabel", () => {
  it.each([
    [100, "Strong match"],
    [80, "Strong match"],
    [79, "Good match"],
    [60, "Good match"],
    [59, "Possible match"],
    [0, "Possible match"],
  ])("labels %i as %s", (score, label) => {
    expect(matchLabel(score)).toBe(label);
  });
});
