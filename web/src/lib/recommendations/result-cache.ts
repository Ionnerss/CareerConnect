import { createServiceClient } from "@/lib/supabase/service";

/**
 * A true result means the database reused and published the run.
 * A false result means generation is still required.
 */
export async function reuseRecommendationRun(
  runId: string,
  summaryCount: number,
): Promise<boolean> {
  const { data, error } = await createServiceClient().rpc(
    "reuse_recommendation_run",
    {
      p_run_id: runId,
      p_summary_count: summaryCount,
      p_max_age_seconds: 900,
    },
  );

  if (error || typeof data !== "boolean") {
    throw new Error("Unable to reuse recommendation results");
  }

  return data;
}