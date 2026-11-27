import { createHash, timingSafeEqual } from "node:crypto";
import { processRecommendationBatch } from "@/lib/recommendations/worker-batch";

export const runtime = "nodejs";
export const maxDuration = 240;

const NO_STORE = {
  "Cache-Control": "private, no-store",
};

function respond(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: NO_STORE,
  });
}

function matchesAuthorization(
  authorization: string | null,
  secret: string,
): boolean {
  const supplied = createHash("sha256")
    .update(authorization ?? "")
    .digest();

  const expected = createHash("sha256")
    .update(`Bearer ${secret}`)
    .digest();

  return timingSafeEqual(supplied, expected);
}

export async function POST(request: Request) {
  const secret = process.env.RECOMMENDATION_WORKER_SECRET?.trim();

  if (!secret) {
    return respond(
      { success: false, code: "WORKER_NOT_CONFIGURED" },
      503,
    );
  }

  if (
    !matchesAuthorization(
      request.headers.get("authorization"),
      secret,
    )
  ) {
    return respond(
      { success: false, code: "UNAUTHORIZED" },
      401,
    );
  }

  if (
    process.env.RECOMMENDATION_BACKGROUND_REFRESH_ENABLED !== "true"
  ) {
    return respond(
      {
        success: true,
        skipped: true,
        reason: "DISABLED",
      },
      200,
    );
  }

  try {
    // Server-controlled limits. Request bodies cannot select users
    // or increase the batch size.
    const result = await processRecommendationBatch({
      maxUsers: 1,
      leaseSeconds: 300,
      recoveryLimit: 25,
    });

    if (!result.success) {
      return respond(
        {
          success: false,
          code: "BATCH_FAILED",
          stats: result.stats,
        },
        503,
      );
    }

    return respond(
      {
        success: true,
        stats: result.stats,
      },
      200,
    );
  } catch {
    return respond(
      { success: false, code: "WORKER_FAILED" },
      500,
    );
  }
}