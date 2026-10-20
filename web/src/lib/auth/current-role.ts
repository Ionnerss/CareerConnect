import type { createClient } from "@/lib/supabase/server";
import { normalizeRole, type LoginRole } from "@/lib/auth/roles";

/** Reads `profiles.role` for a signed-in user. A missing profile or an error means job seeker. */
export async function getProfileRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<LoginRole> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return normalizeRole(error ? null : data?.role);
}
