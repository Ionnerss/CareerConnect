// Server-side metadata for recommendation persistence and rating reuse.

import { createHash } from "node:crypto";
import { JEV_MODEL } from "@/lib/ai/jev";
import { buildJobState, FIT_QUESTIONS } from "./job-fit";
import type { JobForMatching } from "./job-shortlist";
import type { SeekerState } from "./seeker-state";
import {
  DEFAULT_SUMMARY_MODEL,
  SYSTEM_PROMPT,
} from "./summaries";

/**
 * Change this whenever shortlist selection, code scoring, fit weighting,
 * or final score blending changes.
 */
export const SCORING_VERSION = "recommendation-scoring-v1";

/**
 * Change this when the shape of the user message built by
 * buildSummaryMessages() changes.
 */
export const SUMMARY_INPUT_VERSION = "recommendation-summary-input-v1";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      throw new Error("Cannot hash an undefined input");
    }
    return encoded;
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

export function hashRecommendationInput(value: unknown): string {
  return createHash("sha256")
    .update(canonicalJson(value))
    .digest("hex");
}

/** Hash the normalized seeker state used by Jev and summary generation. */
export function hashSeekerInput(seeker: SeekerState): string {
  return hashRecommendationInput(seeker);
}

/**
 * Hash precisely the job state passed to Jev.
 * Fields excluded by buildJobState(), such as created_at and salary,
 * do not invalidate a reusable Jev rating.
 */
export function hashJobRatingInput(job: JobForMatching): string {
  return hashRecommendationInput(buildJobState(job));
}

export type RecommendationVersions = {
  scoring_version: string;
  jev_model_version: string;
  jev_prompt_version: string;
  summary_model_version: string;
  summary_prompt_version: string;
};

export function getRecommendationVersions(): RecommendationVersions {
  const configuredSummaryModel =
    process.env.RECOMMENDATION_SUMMARY_MODEL?.trim();

  return {
    scoring_version: SCORING_VERSION,
    jev_model_version: JEV_MODEL,
    jev_prompt_version: hashRecommendationInput(FIT_QUESTIONS),
    summary_model_version:
      configuredSummaryModel || DEFAULT_SUMMARY_MODEL,
    summary_prompt_version: hashRecommendationInput({
      system_prompt: SYSTEM_PROMPT,
      input_version: SUMMARY_INPUT_VERSION,
    }),
  };
}