import { JevError } from "@/lib/ai/jev";
import {
  AI_NOT_CONFIGURED_ERROR,
  BACKEND_ERROR,
  RECOMMENDATIONS_ERROR_STATUS,
  type RecommendationsApiFailure,
} from "@/lib/recommendations/api-response";
import { getRecommendations } from "@/lib/recommendations/recommend";

// Server only. Returns AI job recommendations for the signed-in job seeker.
//
// POST, not GET, on purpose: every call asks the AI models, so it must not be triggered
// by link prefetching, crawlers or another site sending the user's browser here.
// The seeker is always the signed-in user; nothing in the request decides whose profile is used.
// Sign-in, two-factor authentication and the job_seeker role are checked in getRecommendations().

const NO_STORE = { "Cache-Control": "private, no-store" };

function failure(code: RecommendationsApiFailure["code"], error: string) {
  const body: RecommendationsApiFailure = { success: false, code, error };
  return Response.json(body, { status: RECOMMENDATIONS_ERROR_STATUS[code], headers: NO_STORE });
}

export async function POST() {
  try {
    const result = await getRecommendations();

    if (!result.success) {
      return failure(result.code, result.error);
    }

    return Response.json(result, { status: 200, headers: NO_STORE });
  } catch (error) {
    // A missing Jev key is a server setup problem. Say so, without any detail.
    if (error instanceof JevError && error.code === "missing_key") {
      return failure("AI_NOT_CONFIGURED", AI_NOT_CONFIGURED_ERROR);
    }
    return failure("BACKEND_ERROR", BACKEND_ERROR);
  }
}
