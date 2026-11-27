import { z } from "zod";

export const recommendationRefreshStatusSchema = z.object({
  status: z.enum([
    "never_requested",
    "disabled",
    "idle",
    "queued",
    "running",
    "retry_wait",
    "failed",
  ]),
  stale: z.boolean().nullable(),
  background_enabled: z.boolean(),
  manual_pending: z.boolean(),
  attempt_count: z.number().int().nonnegative(),
  max_attempts: z.number().int().min(1).max(10),
  next_attempt_at: z.string().nullable(),
  last_failure_code: z
    .enum([
      "generation_failed",
      "publication_failed",
      "load_failed",
    ])
    .nullable(),
  generated_at: z.string().nullable(),
  checked_at: z.string().nullable(),
});

export type RecommendationRefreshStatus = z.infer<
  typeof recommendationRefreshStatusSchema
>;

export type RecommendationRefreshStatusSuccess = {
  success: true;
  processing_enabled: boolean;
} & RecommendationRefreshStatus;