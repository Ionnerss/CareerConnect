import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import {
  loadRecommendationInputsForUser,
  type RecommendationInputsOptions,
  type RecommendationInputsResponse,
} from "./recommendation-inputs";

type ServiceClient = ReturnType<typeof createServiceClient>;

type ValidInputs = Extract<
  RecommendationInputsResponse,
  { success: true }
>;

// Keep revisions as strings so bigint values are compared exactly.
// Reject numeric values whose precision may already have been lost.
const revisionSchema = z
  .union([
    z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    z.string().regex(/^(0|[1-9]\d*)$/),
  ])
  .transform(String);

const claimSchema = z.object({
  user_id: z.uuid(),
  claim_token: z.uuid(),
  requested_revision: revisionSchema,
  claimed_revision: revisionSchema,
  claimed_posting_revision: revisionSchema,
  lease_expires_at: z.string(),
});

const postingSchema = z.object({
  revision: revisionSchema,
});

export type WorkerClaimSnapshot = {
  user_id: string;
  claim_token: string;
  seeker_revision: string;
  posting_revision: string;
};

export type WorkerInputsResponse =
  | {
      success: true;
      claim: WorkerClaimSnapshot;
      inputs: ValidInputs;
    }
  | {
      success: false;
      code: "CLAIM_UNAVAILABLE" | "LOAD_FAILED";
    };

async function readCurrentClaim(
  service: ServiceClient,
  token: string,
): Promise<WorkerClaimSnapshot | null> {
  const { data: claimRow, error: claimError } = await service
    .from("recommendation_refresh_state")
    .select(
      "user_id, claim_token, requested_revision, claimed_revision, " +
        "claimed_posting_revision, lease_expires_at",
    )
    .eq("claim_token", token)
    .maybeSingle();

  if (claimError) {
    throw new Error("Unable to read recommendation claim");
  }

  if (!claimRow) return null;

  const parsedClaim = claimSchema.safeParse(claimRow);
  if (!parsedClaim.success) return null;

  const claim = parsedClaim.data;
  const expiry = Date.parse(claim.lease_expires_at);

  if (
    claim.claim_token !== token ||
    !Number.isFinite(expiry) ||
    expiry <= Date.now() ||
    claim.claimed_revision !== claim.requested_revision
  ) {
    return null;
  }

  const { data: postingRow, error: postingError } = await service
    .from("recommendation_posting_state")
    .select("revision")
    .eq("singleton", true)
    .maybeSingle();

  if (postingError) {
    throw new Error("Unable to read recommendation posting revision");
  }

  const parsedPosting = postingSchema.safeParse(postingRow);
  if (!parsedPosting.success) {
    throw new Error("Recommendation posting state is unavailable");
  }

  if (claim.claimed_posting_revision !== parsedPosting.data.revision) {
    return null;
  }

  return {
    user_id: claim.user_id,
    claim_token: claim.claim_token,
    seeker_revision: claim.claimed_revision,
    posting_revision: claim.claimed_posting_revision,
  };
}

/**
 * Trusted server entry point.
 *
 * The owner comes from the stored claim. This function must only be
 * called by the worker after it claims work, never directly from a
 * browser-supplied token or user ID.
 */
export async function getWorkerRecommendationInputs(
  claimToken: string,
  options: RecommendationInputsOptions = {},
): Promise<WorkerInputsResponse> {
  if (!z.uuid().safeParse(claimToken).success) {
    return { success: false, code: "CLAIM_UNAVAILABLE" };
  }

  try {
    const service = createServiceClient();
    const before = await readCurrentClaim(service, claimToken);

    if (!before) {
      return { success: false, code: "CLAIM_UNAVAILABLE" };
    }

    const inputs = await loadRecommendationInputsForUser(
      service,
      before.user_id,
      options,
    );

    if (!inputs.success) {
      return {
        success: false,
        code:
          inputs.code === "NOT_JOB_SEEKER"
            ? "CLAIM_UNAVAILABLE"
            : "LOAD_FAILED",
      };
    }

    const after = await readCurrentClaim(service, claimToken);

    if (
      !after ||
      after.user_id !== before.user_id ||
      after.seeker_revision !== before.seeker_revision ||
      after.posting_revision !== before.posting_revision ||
      inputs.user_id !== before.user_id
    ) {
      return { success: false, code: "CLAIM_UNAVAILABLE" };
    }

    return {
      success: true,
      claim: after,
      inputs,
    };
  } catch {
    return { success: false, code: "LOAD_FAILED" };
  }
}