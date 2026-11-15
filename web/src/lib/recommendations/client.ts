// Browser-side helpers for POST /api/recommendations, used by the dashboard card.
// Only type imports from the server modules, so no server code ends up in the browser bundle.

import type {
  RecommendationsApiFailure,
  RecommendationsApiResponse,
} from "./api-response";

export type RecommendationsSuccess = Extract<RecommendationsApiResponse, { success: true }>;
export type ClientRecommendation = RecommendationsSuccess["recommendations"][number];

/** Error codes from the endpoint, plus NETWORK when the request never got an answer. */
export type ClientErrorCode = RecommendationsApiFailure["code"] | "NETWORK";

export type RecommendationsResult =
  | { ok: true; data: RecommendationsSuccess }
  | { ok: false; code: ClientErrorCode; error: string };

export const NETWORK_ERROR = "We could not reach the server. Check your connection and try again.";
export const GENERIC_ERROR = "Unable to load your recommendations. Please try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Asks the endpoint for recommendations. Never throws: anything unexpected (no connection,
 * a non-JSON body, a body of the wrong shape) becomes a readable error.
 * An aborted request rethrows the AbortError so the caller can ignore it.
 */
export async function requestRecommendations(
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<RecommendationsResult> {
  let response: Response;
  try {
    response = await fetcher("/api/recommendations", { method: "POST", signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, code: "NETWORK", error: NETWORK_ERROR };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, code: "BACKEND_ERROR", error: GENERIC_ERROR };
  }

  if (isRecord(body) && body.success === true && Array.isArray(body.recommendations)) {
    return { ok: true, data: body as RecommendationsSuccess };
  }

  if (isRecord(body) && body.success === false && typeof body.code === "string") {
    return {
      ok: false,
      code: body.code as ClientErrorCode,
      error: typeof body.error === "string" && body.error.trim() ? body.error : GENERIC_ERROR,
    };
  }

  return { ok: false, code: "BACKEND_ERROR", error: GENERIC_ERROR };
}

/** Words next to the number, so the score never relies on colour alone. Same as the full page. */
export function matchLabel(score: number): string {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Good match";
  return "Possible match";
}
