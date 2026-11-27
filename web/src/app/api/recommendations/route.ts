import {
  BACKEND_ERROR,
  RECOMMENDATIONS_ERROR_STATUS,
  type RecommendationsApiFailure,
} from "@/lib/recommendations/api-response";
import { getSavedRecommendations } from "@/lib/recommendations/saved-recommendations";
import { POST as queueRecommendationRefresh } from "./refresh/route";

const NO_STORE = {
  "Cache-Control": "private, no-store",
};

function failure(
  code: RecommendationsApiFailure["code"],
  error: string,
) {
  const body: RecommendationsApiFailure = {
    success: false,
    code,
    error,
  };

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

    return Response.json(result, {
      status: 200,
      headers: NO_STORE,
    });
  } catch {
    return failure("BACKEND_ERROR", BACKEND_ERROR);
  }
}

/**
 * The previous generation endpoint now uses the same queue handler
 * as POST /api/recommendations/refresh.
 *
 * The response acknowledges queued work. Saved results are read with GET.
 */
export async function POST() {
  return queueRecommendationRefresh();
}