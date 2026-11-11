// Puts the recommendation pieces together:
//   inputs (profile + shortlist)  ->  Jev rates each posting  ->  blend with the code score
//   ->  sort  ->  text model writes summaries for the top few.
//
// The final score blends the AI fit with the code-based match score, so the AI can refine
// the order but cannot override hard facts like work mode or required experience.
// A posting whose AI call failed keeps its code score, so the list is never empty because
// of one bad call. The recruiter-side rule still applies here: the AI only suggests,
// nothing is ever applied to on the seeker's behalf.
//
// SERVER ONLY.

import { rateJobs, type AskJev, type JobFit } from "./job-fit";
import type { ShortlistedJob } from "./job-shortlist";
import { getRecommendationInputs, type RecommendationInputsErrorCode } from "./recommendation-inputs";
import type { SeekerState } from "./seeker-state";
import { generateSummaries, SUMMARY_COUNT, type CompleteText, type SummaryResult } from "./summaries";

/** Share of the final score that comes from the AI fit. The rest is the code match score. */
export const AI_WEIGHT = 0.6;

export type Recommendation = {
  job: ShortlistedJob["job"];
  /** 0 to 100. What the list is sorted by. */
  score: number;
  /** The code-based match score from the shortlist (0 to 100). */
  match_score: number;
  /** Null when the AI call for this posting failed. */
  fit: JobFit | null;
  skill_match: ShortlistedJob["skill_match"];
  /** Code-written reasons. Always present. */
  reasons: string[];
  /** AI-written note, only for the top few and only when the text model answered. */
  summary: string | null;
};

export type RecommendationsResult = {
  empty_profile: boolean;
  considered_jobs: number;
  recommendations: Recommendation[];
  /** False when every AI rating failed, so the order is by code score only. */
  ai_ranked: boolean;
  summary_status: SummaryResult["status"] | "skipped";
};

export function blendScore(matchScore: number, fit: JobFit | null): number {
  return fit ? Math.round(AI_WEIGHT * fit.score + (1 - AI_WEIGHT) * matchScore) : matchScore;
}

export type BuildRecommendationsOptions = {
  ask?: AskJev;
  complete?: CompleteText;
  /** How many of the top recommendations get a written summary. */
  summaryCount?: number;
};

export async function buildRecommendations(
  seeker: SeekerState,
  shortlist: ShortlistedJob[],
  options: BuildRecommendationsOptions = {},
): Promise<Omit<RecommendationsResult, "empty_profile" | "considered_jobs">> {
  if (shortlist.length === 0) {
    return { recommendations: [], ai_ranked: false, summary_status: "skipped" };
  }

  const rated = await rateJobs(seeker, shortlist, { ask: options.ask });

  const scored = rated
    .map((item) => ({ item, score: blendScore(item.score, item.fit) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.item.score - a.item.score ||
        b.item.job.created_at.localeCompare(a.item.job.created_at) ||
        a.item.job.id.localeCompare(b.item.job.id),
    );

  const top = scored.slice(0, options.summaryCount ?? SUMMARY_COUNT).map((entry) => entry.item);
  const summary = await generateSummaries(seeker, top, options.complete);

  return {
    recommendations: scored.map(({ item, score }) => ({
      job: item.job,
      score,
      match_score: item.score,
      fit: item.fit,
      skill_match: item.skill_match,
      reasons: item.reasons,
      summary: summary.summaries[item.job.id] ?? null,
    })),
    ai_ranked: rated.some((item) => item.fit !== null),
    summary_status: summary.status,
  };
}

export type GetRecommendationsResponse =
  | ({ success: true } & RecommendationsResult)
  | { success: false; code: RecommendationInputsErrorCode; error: string };

/**
 * Everything for the recommendations endpoint/page: checks sign-in, MFA and role, loads the
 * seeker and the shortlist, then ranks and summarizes. A profile with nothing to match on
 * returns early and makes no AI call at all.
 * Throws JevError("missing_key") if the server has no Jev key (the caller maps it to 503).
 */
export async function getRecommendations(
  options: BuildRecommendationsOptions & { limit?: number; now?: Date } = {},
): Promise<GetRecommendationsResponse> {
  const inputs = await getRecommendationInputs({ limit: options.limit, now: options.now });
  if (!inputs.success) return inputs;

  if (inputs.empty_profile) {
    return {
      success: true,
      empty_profile: true,
      considered_jobs: 0,
      recommendations: [],
      ai_ranked: false,
      summary_status: "skipped",
    };
  }

  const built = await buildRecommendations(inputs.seeker_state, inputs.shortlist, options);
  return {
    success: true,
    empty_profile: false,
    considered_jobs: inputs.considered_jobs,
    ...built,
  };
}
