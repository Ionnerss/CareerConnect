import { JevError } from "@/lib/ai/jev";
import {
  AI_NOT_CONFIGURED_ERROR,
  BACKEND_ERROR,
  RECOMMENDATIONS_ERROR_STATUS,
  type RecommendationsApiFailure,
} from "@/lib/recommendations/api-response";
import { getRecommendations } from "@/lib/recommendations/recommend";
import { getSavedRecommendations } from "@/lib/recommendations/saved-recommendations";

// GET reads the signed-in seeker's latest successful run.
// POST explicitly generates and publishes a new run.
const NO_STORE = { "Cache-Control": "private, no-store" };

function failure(code: RecommendationsApiFailure["code"], error: string) {
  const body: RecommendationsApiFailure = { success: false, code, error };

  return Response.json(body, {
    status: RECOMMENDATIONS_ERROR_STATUS[code],
    headers: NO_STORE,
  });
}

export async function GET() {
  try {
    const result = await getSavedRecommendations();

    if (!result.success) {
      return failure(result.code, result.error);
    }

    return Response.json(result, { status: 200, headers: NO_STORE });
  } catch {
    return failure("BACKEND_ERROR", BACKEND_ERROR);
  }
}

export async function POST() {
  try {
    const result = await getRecommendations();

    if (!result.success) {
      return failure(result.code, result.error);
    }

    return Response.json(result, { status: 200, headers: NO_STORE });
  } catch (error) {
    if (error instanceof JevError && error.code === "missing_key") {
      return failure("AI_NOT_CONFIGURED", AI_NOT_CONFIGURED_ERROR);
    }

    return failure("BACKEND_ERROR", BACKEND_ERROR);
  }
}