import {
  BACKEND_ERROR,
  RECOMMENDATIONS_ERROR_STATUS,
} from "@/lib/recommendations/api-response";
import { requestRecommendationRefresh } from "@/lib/recommendations/refresh-request";

const NO_STORE = {
  "Cache-Control": "private, no-store",
};

const ERROR_STATUS = {
  ...RECOMMENDATIONS_ERROR_STATUS,
  RATE_LIMITED: 429,
};

export async function POST() {
  try {
    const result = await requestRecommendationRefresh();

    if (result.success) {
      return Response.json(result, {
        status: 202,
        headers: NO_STORE,
      });
    }

    return Response.json(result, {
      status: ERROR_STATUS[result.code],
      headers: {
        ...NO_STORE,
        ...(result.code === "RATE_LIMITED"
          ? { "Retry-After": "60" }
          : {}),
      },
    });
  } catch {
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
}