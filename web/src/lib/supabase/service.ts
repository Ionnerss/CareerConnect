import { createClient } from "@supabase/supabase-js";

/**
 * Privileged database client. Import only from server-side code.
 * Never pass this key to a browser or use a NEXT_PUBLIC_ variable for it.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Recommendation persistence is not configured");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}