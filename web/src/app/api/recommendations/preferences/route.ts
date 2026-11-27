import { z } from "zod";
import {
  BACKEND_ERROR,
  RECOMMENDATIONS_ERROR_STATUS,
} from "@/lib/recommendations/api-response";
import {
  getRecommendationRefreshPreference,
  setRecommendationRefreshPreference,
  type RefreshPreferenceResponse,
} from "@/lib/recommendations/refresh-preferences";

const NO_STORE = {
  "Cache-Control": "private, no-store",
};

const updateSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

function preferenceResponse(result: RefreshPreferenceResponse) {
  return Response.json(result, {
    status: result.success
      ? 200
      : RECOMMENDATIONS_ERROR_STATUS[result.code],
    headers: NO_STORE,
  });
}

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
    return preferenceResponse(
      await getRecommendationRefreshPreference(),
    );
  } catch {
    return backendFailure();
  }
}

export async function PUT(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        code: "INVALID_REQUEST",
        error: "Provide enabled as a boolean.",
      },
      {
        status: 400,
        headers: NO_STORE,
      },
    );
  }

  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        code: "INVALID_REQUEST",
        error: "Provide enabled as a boolean.",
      },
      {
        status: 400,
        headers: NO_STORE,
      },
    );
  }

  try {
    return preferenceResponse(
      await setRecommendationRefreshPreference(
        parsed.data.enabled,
      ),
    );
  } catch {
    return backendFailure();
  }
}