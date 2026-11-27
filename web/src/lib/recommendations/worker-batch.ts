import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { processRecommendationClaim } from "./worker";
import {
  failRecommendationRefresh,
  type WorkerFailureCode,
} from "./worker-retry";

const optionsSchema = z.object({
  maxUsers: z.number().int().min(1).max(25).default(5),
  leaseSeconds: z.number().int().min(1).max(3600).default(300),
  recoveryLimit: z.number().int().min(1).max(100).default(25),
});

const candidateSchema = z.object({
  user_id: z.uuid(),
});

const claimedWorkSchema = z.object({
  claim_token: z.uuid(),
});

export type RecommendationBatchOptions = {
  maxUsers?: number;
  leaseSeconds?: number;
  recoveryLimit?: number;
};

export type RecommendationBatchStats = {
  recovered: number;
  selected: number;
  claimed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  claim_errors: number;
  cleanup_errors: number;
};

export type RecommendationBatchResult =
  | {
      success: true;
      stats: RecommendationBatchStats;
    }
  | {
      success: false;
      code:
        | "INVALID_OPTIONS"
        | "SETUP_FAILED"
        | "RECOVERY_FAILED"
        | "SELECTION_FAILED";
      stats: RecommendationBatchStats;
    };

/**
 * Trusted server entry point for one bounded batch.
 *
 * A successful batch can contain individual failed attempts.
 * Inspect the returned statistics when reporting its outcome.
 */
export async function processRecommendationBatch(
  options: RecommendationBatchOptions = {},
): Promise<RecommendationBatchResult> {
  const stats: RecommendationBatchStats = {
    recovered: 0,
    selected: 0,
    claimed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    claim_errors: 0,
    cleanup_errors: 0,
  };

  const parsedOptions = optionsSchema.safeParse(options);

  if (!parsedOptions.success) {
    return {
      success: false,
      code: "INVALID_OPTIONS",
      stats,
    };
  }

  const { maxUsers, leaseSeconds, recoveryLimit } = parsedOptions.data;

  let service: ReturnType<typeof createServiceClient>;

  try {
    service = createServiceClient();
  } catch {
    return { success: false, code: "SETUP_FAILED", stats };
  }

  try {
    const { data, error } = await service.rpc(
      "recover_recommendation_refreshes",
      {
        p_limit: recoveryLimit,
        p_retry_seconds: 60,
      },
    );

    const recovered = z
      .number()
      .int()
      .min(0)
      .max(recoveryLimit)
      .safeParse(data);

    if (error || !recovered.success) {
      return { success: false, code: "RECOVERY_FAILED", stats };
    }

    stats.recovered = recovered.data;
  } catch {
    return { success: false, code: "RECOVERY_FAILED", stats };
  }

  let candidates: z.infer<typeof candidateSchema>[];

  try {
    const { data, error } = await service.rpc(
      "list_due_recommendation_refreshes",
      { p_limit: maxUsers },
    );

    const parsedCandidates = z
      .array(candidateSchema)
      .max(maxUsers)
      .safeParse(data);

    if (error || !parsedCandidates.success) {
      return { success: false, code: "SELECTION_FAILED", stats };
    }

    // Defensive deduplication before issuing claims.
    candidates = [
      ...new Map(
        parsedCandidates.data.map((candidate) => [
          candidate.user_id,
          candidate,
        ]),
      ).values(),
    ];

    stats.selected = candidates.length;
  } catch {
    return { success: false, code: "SELECTION_FAILED", stats };
  }

  async function releaseFailedClaim(
    token: string,
    failureCode: WorkerFailureCode,
  ): Promise<void> {
    try {
      await failRecommendationRefresh(token, failureCode);
    } catch {
      stats.cleanup_errors += 1;
    }
  }

  for (const candidate of candidates) {
    let token: string;

    try {
      const { data, error } = await service.rpc(
        "claim_recommendation_refresh",
        {
          p_user_id: candidate.user_id,
          p_lease_seconds: leaseSeconds,
        },
      );

      const parsedClaim = z
        .array(claimedWorkSchema)
        .max(1)
        .safeParse(data);

      if (error || !parsedClaim.success) {
        stats.claim_errors += 1;
        continue;
      }

      if (parsedClaim.data.length === 0) {
        stats.skipped += 1;
        continue;
      }

      token = parsedClaim.data[0].claim_token;
      stats.claimed += 1;
    } catch {
      stats.claim_errors += 1;
      continue;
    }

    try {
      const result = await processRecommendationClaim(token);

      if (result.success) {
        stats.succeeded += 1;
        continue;
      }

      if (result.code === "RESERVATION_FAILED") {
        // Another invocation may already own the reserved run.
        stats.skipped += 1;
        continue;
      }

      if (result.code === "CLAIM_UNAVAILABLE") {
        stats.skipped += 1;
        await releaseFailedClaim(token, "load_failed");
        continue;
      }

      stats.failed += 1;

      if (result.code === "LOAD_FAILED") {
        await releaseFailedClaim(token, "load_failed");
        } else if (
        "cleanup_failed" in result &&
        result.cleanup_failed
        ) {
        stats.cleanup_errors += 1;
        }
    } catch {
      stats.failed += 1;
      await releaseFailedClaim(token, "generation_failed");
    }
  }

  return { success: true, stats };
}