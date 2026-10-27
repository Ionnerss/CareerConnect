// Loads the extra numbers the dashboard needs (name, resume count).
// Applications come from getUserApplications() so the dashboard and the status page stay in sync.
import { createClient } from "@/lib/supabase/server";

export type DashboardProfileSummary = {
  fullName: string | null;
  resumeCount: number;
};

/**
 * Reads the signed-in user's name and how many resumes they uploaded.
 * Row-level security already limits both queries to the user's own rows.
 * Errors are not fatal: the dashboard still renders with safe defaults.
 */
export async function getDashboardProfileSummary(
  userId: string
): Promise<DashboardProfileSummary> {
  const supabase = await createClient();

  const [profileResult, resumeResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase
      .from("resumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  return {
    fullName: profileResult.error ? null : (profileResult.data?.full_name ?? null),
    resumeCount: resumeResult.error ? 0 : (resumeResult.count ?? 0),
  };
}
