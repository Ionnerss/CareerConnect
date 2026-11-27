import {
  BACKEND_ERROR,
  RECOMMENDATIONS_ERROR_STATUS,
} from "@/lib/recommendations/api-response";
import { authorizeRecommendationAccess } from "@/lib/recommendations/refresh-preferences";
import { recommendationRefreshStatusSchema } from "@/lib/recommendations/refresh-status";

const NO_STORE = {
  "Cache-Control": "private, no-store",
};

function backendFailure() {
  return Response.json(
    {
      success: false,
      code: "BACKEND_ERROR",
      error: BACKEND_ERROR,
    },
    {
      status: 500,
      headers: NO_STORE,
    },
  );
}

export async function GET() {
  try {
    const access = await authorizeRecommendationAccess();

    if (!access.success) {
      return Response.json(access, {
        status: RECOMMENDATIONS_ERROR_STATUS[access.code],
        headers: NO_STORE,
      });
    }

    const { data, error } = await access.client.rpc(
      "get_recommendation_refresh_status",
    );

    if (error) {
      return backendFailure();
    }

    const parsed = recommendationRefreshStatusSchema.safeParse(data);

    if (!parsed.success) {
      return backendFailure();
    }

    return Response.json(
      {
        success: true,
        ...parsed.data,
        processing_enabled:
          process.env.RECOMMENDATION_BACKGROUND_REFRESH_ENABLED ===
          "true",
      },
      {
        status: 200,
        headers: NO_STORE,
      },
    );
  } catch {
    return backendFailure();
  }
}