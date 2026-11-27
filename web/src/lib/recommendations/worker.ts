import { createRecommendationFingerprint } from "./cache-fingerprint";
import {
  publishRecommendationRun,
  reserveRecommendationRun,
  type RecommendationFailureCode,
} from "./persistence";
import {
  buildRecommendations,
  type BuildRecommendationsOptions,
} from "./recommend";
import { reuseRecommendationRun } from "./result-cache";
import { SUMMARY_COUNT } from "./summaries";
import { getWorkerRecommendationInputs } from "./worker-inputs";
import { failRecommendationRefresh } from "./worker-retry";
import { createBudgetedRecommendationProviders } from "./provider-budget";

export type RecommendationWorkerResult =
  | {
      success: true;
      run_id: string;
    }
  | {
      success: false;
      code:
        | "CLAIM_UNAVAILABLE"
        | "LOAD_FAILED"
        | "RESERVATION_FAILED";
    }
  | {
      success: false;
      run_id: string;
      code: "GENERATION_FAILED" | "PUBLICATION_FAILED";
      cleanup_failed: boolean;
    };

export async function processRecommendationClaim(
  claimToken: string,
  options: BuildRecommendationsOptions = {},
): Promise<RecommendationWorkerResult> {
  const loaded = await getWorkerRecommendationInputs(claimToken);

  if (!loaded.success) {
    return { success: false, code: loaded.code };
  }

  const { inputs, claim } = loaded;
  const inputsCheckedAt = new Date().toISOString();

  // Injected providers are used for testing or custom generation.
  // Their output must not populate the production cache.
  const useCache = !options.ask && !options.complete;

  let runId: string;

  try {
    const fingerprint = useCache
      ? createRecommendationFingerprint(inputs, {
          summaryCount: options.summaryCount,
        })
      : undefined;

    runId = await reserveRecommendationRun(
      inputs,
      claim,
      fingerprint,
    );
  } catch {
    return { success: false, code: "RESERVATION_FAILED" };
  }

  let failureCode: RecommendationFailureCode = "publication_failed";

  try {
    if (useCache) {
      const summaryCount = inputs.empty_profile
        ? 0
        : Math.min(
            options.summaryCount ?? SUMMARY_COUNT,
            inputs.shortlist.length,
          );

      const reused = await reuseRecommendationRun(
        runId,
        summaryCount,
      );

      if (reused) {
        return { success: true, run_id: runId };
      }
    }

    failureCode = "generation_failed";

    const providers = createBudgetedRecommendationProviders(
      inputs.user_id,
      options,
    );

    const recommendations =
      inputs.empty_profile || inputs.shortlist.length === 0
        ? []
        : (
            await buildRecommendations(
              inputs.seeker_state,
              inputs.shortlist,
              providers.options,
            )
          ).recommendations;

    // Provider helpers may have converted errors into fallback results.
    // A denied budget or failed capacity release must prevent publication.
    providers.assertAvailable();

    failureCode = "publication_failed";

    await publishRecommendationRun(
      runId,
      inputs.seeker_state,
      recommendations,
      inputsCheckedAt,
    );

    return { success: true, run_id: runId };
  } catch {
    let cleanupFailed = false;

    try {
      await failRecommendationRefresh(claimToken, failureCode);
    } catch {
      cleanupFailed = true;
    }

    return {
      success: false,
      run_id: runId,
      code:
        failureCode === "generation_failed"
          ? "GENERATION_FAILED"
          : "PUBLICATION_FAILED",
      cleanup_failed: cleanupFailed,
    };
  }
}