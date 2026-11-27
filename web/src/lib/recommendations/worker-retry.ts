import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

export type WorkerFailureCode =
  | "generation_failed"
  | "publication_failed"
  | "load_failed";

const attemptSchema = z.number().int().min(1).max(10);

const BASE_RETRY_SECONDS = 60;
const MAX_RETRY_SECONDS = 3600;

/**
 * Returns false when the claim is no longer present or owned.
 * Throws when retry state cannot be read or failure recording fails.
 */
export async function failRecommendationRefresh(
  claimToken: string,
  failureCode: WorkerFailureCode,
): Promise<boolean> {
  if (!z.uuid().safeParse(claimToken).success) {
    throw new Error("Invalid recommendation claim token");
  }

  const service = createServiceClient();

  const { data: claim, error: claimError } = await service
    .from("recommendation_refresh_state")
    .select("attempt_count")
    .eq("claim_token", claimToken)
    .maybeSingle();

  if (claimError) {
    throw new Error("Unable to read recommendation retry state");
  }

  if (!claim) return false;

  const parsedAttempt = attemptSchema.safeParse(claim.attempt_count);

  if (!parsedAttempt.success) {
    throw new Error("Invalid recommendation attempt count");
  }

  const retrySeconds = Math.min(
    MAX_RETRY_SECONDS,
    BASE_RETRY_SECONDS * 2 ** (parsedAttempt.data - 1),
  );

  const { data: released, error: releaseError } = await service.rpc(
    "fail_recommendation_refresh",
    {
      p_claim_token: claimToken,
      p_failure_code: failureCode,
      p_retry_seconds: retrySeconds,
    },
  );

  if (releaseError || typeof released !== "boolean") {
    throw new Error("Unable to record recommendation refresh failure");
  }

  return released;
}