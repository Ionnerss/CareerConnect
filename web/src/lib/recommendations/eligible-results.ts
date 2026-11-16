import { createClient } from "@/lib/supabase/server";
import type { Recommendation } from "./recommend";

/**
 * Recheck jobs after AI work, since their status or the seeker's
 * applications may have changed while recommendations were generated.
 */
export async function filterEligibleResults(
  userId: string,
  recommendations: Recommendation[],
): Promise<Recommendation[]> {
  if (recommendations.length === 0) return [];

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || user?.id !== userId) {
    throw new Error("Unable to verify recommendation owner");
  }

  const jobIds = recommendations.map(({ job }) => job.id);

  const [jobs, applications] = await Promise.all([
    supabase
      .from("job")
      .select("id")
      .in("id", jobIds)
      .eq("status", "open"),
    supabase
      .from("applications")
      .select("job_id")
      .eq("applicant_id", userId)
      .in("job_id", jobIds),
  ]);

  if (jobs.error || applications.error) {
    throw new Error("Unable to recheck recommendation eligibility");
  }

  const openJobIds = new Set((jobs.data ?? []).map(({ id }) => id));
  const appliedJobIds = new Set(
    (applications.data ?? []).map(({ job_id }) => job_id),
  );

  return recommendations.filter(
    ({ job }) => openJobIds.has(job.id) && !appliedJobIds.has(job.id),
  );
}