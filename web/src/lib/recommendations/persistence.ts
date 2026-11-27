import { createServiceClient } from "@/lib/supabase/service";
import {
  getRecommendationVersions,
  hashJobRatingInput,
  hashSeekerInput,
} from "./persistence-metadata";
import type { RecommendationInputsResponse } from "./recommendation-inputs";
import type { Recommendation } from "./recommend";
import type { SeekerState } from "./seeker-state";
import type { WorkerClaimSnapshot } from "./worker-inputs";

type ValidInputs = Extract<RecommendationInputsResponse, { success: true }>;

export async function reserveRecommendationRun(
  inputs: ValidInputs,
  claim?: WorkerClaimSnapshot,
  inputFingerprint?: string,
): Promise<string> {
  if (claim && claim.user_id !== inputs.user_id) {
    throw new Error("Recommendation claim owner does not match inputs");
  }

  const service = createServiceClient();
  const versions = getRecommendationVersions();

  const { data, error } = await service
    .from("recommendation_runs")
    .insert({
      user_id: inputs.user_id,
      status: "running",
      started_at: new Date().toISOString(),
      considered_jobs: inputs.considered_jobs,
      seeker_input_hash: hashSeekerInput(inputs.seeker_state),
      ...versions,
      ...(claim
        ? {
            refresh_claim_token: claim.claim_token,
            refresh_revision: claim.seeker_revision,
          }
        : {}),
      ...(inputFingerprint
        ? { input_fingerprint: inputFingerprint }
        : {}),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error("Unable to reserve recommendation run");
  }

  return data.id;
}

/**
 * Publish the entire result set through one database function call.
 * The function validates and saves the rows in one transaction.
 */
export async function publishRecommendationRun(
  runId: string,
  seeker: SeekerState,
  recommendations: Recommendation[],
  inputCheckedAt: string,
): Promise<void> {
  const seekerHash = hashSeekerInput(seeker);

  const results = recommendations.map((item, index) => ({
    job_id: item.job.id,
    rank: index + 1,
    score: item.score,
    match_score: item.match_score,
    fit: item.fit,
    fit_error: item.fit_error,
    fit_generated_at: item.fit_generated_at,
    skill_match: item.skill_match,
    reasons: item.reasons,
    summary: item.summary,
    seeker_input_hash: seekerHash,
    job_input_hash: hashJobRatingInput(item.job),
    job_input_checked_at: inputCheckedAt,
  }));

  const { data, error } = await createServiceClient().rpc(
    "publish_recommendation_run",
    {
      p_run_id: runId,
      p_results: results,
    },
  );

  if (error || data !== runId) {
    throw new Error("Unable to publish recommendation run");
  }
}

export type RecommendationFailureCode =
  | "generation_failed"
  | "publication_failed";

/** Failed attempts never alter the previous successful run. */
export async function failRecommendationRun(
  runId: string,
  code: RecommendationFailureCode,
): Promise<void> {
  const { data, error } = await createServiceClient()
    .from("recommendation_runs")
    .update({
      status: "failed",
      failure_code: code,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("status", "running")
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error("Unable to mark recommendation run failed");
  }
}