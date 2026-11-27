import {
  getRecommendationVersions,
  hashRecommendationInput,
  type RecommendationVersions,
} from "./persistence-metadata";
import type { RecommendationInputsResponse } from "./recommendation-inputs";
import { SUMMARY_COUNT } from "./summaries";

type ValidInputs = Extract<
  RecommendationInputsResponse,
  { success: true }
>;

export type RecommendationFingerprintOptions = {
  summaryCount?: number;
};

// Bump this when the fingerprint structure or interpretation changes.
export const RECOMMENDATION_CACHE_INPUT_VERSION =
  "recommendation-cache-input-v1";

/**
 * Identifies the content and configuration used for a complete run.
 *
 * Preserve shortlist order because ordering affects ranking tie
 * handling and which jobs receive summaries.
 */
export function createRecommendationFingerprint(
  inputs: ValidInputs,
  options: RecommendationFingerprintOptions = {},
  versions: RecommendationVersions = getRecommendationVersions(),
): string {
  const requestedSummaryCount = options.summaryCount ?? SUMMARY_COUNT;

  if (
    !Number.isSafeInteger(requestedSummaryCount) ||
    requestedSummaryCount < 0
  ) {
    throw new Error("Summary count must be a nonnegative safe integer");
  }

  const effectiveSummaryCount = inputs.empty_profile
    ? 0
    : Math.min(requestedSummaryCount, inputs.shortlist.length);

  return hashRecommendationInput({
    cache_input_version: RECOMMENDATION_CACHE_INPUT_VERSION,
    user_id: inputs.user_id,
    empty_profile: inputs.empty_profile,
    considered_jobs: inputs.considered_jobs,
    seeker_state: inputs.seeker_state,
    shortlist: inputs.shortlist,
    summary_count: effectiveSummaryCount,
    versions,
  });
}