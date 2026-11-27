import { checkMfaForClient } from "@/lib/auth/require-mfa";
import { createClient } from "@/lib/supabase/server";
import {
  AUTH_ERROR,
  AUTH_UNAVAILABLE_ERROR,
  LOAD_FAILED_ERROR,
  MFA_REQUIRED_ERROR,
  NOT_JOB_SEEKER_ERROR,
  type RecommendationInputsErrorCode,
} from "./recommendation-inputs";

type PreferenceFailure = {
  success: false;
  code: RecommendationInputsErrorCode;
  error: string;
};

export type RefreshPreferenceResponse =
  | {
      success: true;
      enabled: boolean;
    }
  | PreferenceFailure;

function failure(
  code: RecommendationInputsErrorCode,
  error: string,
): PreferenceFailure {
  return { success: false, code, error };
}

export async function authorizeRecommendationAccess() {
  const client = await createClient();

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return failure("UNAUTHENTICATED", AUTH_ERROR);
  }

  const mfaError = await checkMfaForClient(client);

  if (mfaError === "MFA_REQUIRED") {
    return failure("MFA_REQUIRED", MFA_REQUIRED_ERROR);
  }

  if (mfaError) {
    return failure("AUTH_UNAVAILABLE", AUTH_UNAVAILABLE_ERROR);
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return failure("LOAD_FAILED", LOAD_FAILED_ERROR);
  }

  if (!profile || profile.role !== "job_seeker") {
    return failure("NOT_JOB_SEEKER", NOT_JOB_SEEKER_ERROR);
  }

  return {
    success: true as const,
    client,
    userId: user.id,
  };
}

export async function getRecommendationRefreshPreference():
  Promise<RefreshPreferenceResponse> {
  const access = await authorizeRecommendationAccess();

  if (!access.success) return access;

  const { data, error } = await access.client
    .from("recommendation_refresh_preferences")
    .select("enabled")
    .eq("user_id", access.userId)
    .maybeSingle();

  if (error) {
    return failure("LOAD_FAILED", LOAD_FAILED_ERROR);
  }

  // No preference row means the seeker has not opted in.
  if (!data) {
    return { success: true, enabled: false };
  }

  if (typeof data.enabled !== "boolean") {
    return failure("LOAD_FAILED", LOAD_FAILED_ERROR);
  }

  return { success: true, enabled: data.enabled };
}

export async function setRecommendationRefreshPreference(
  enabled: boolean,
): Promise<RefreshPreferenceResponse> {
  const access = await authorizeRecommendationAccess();

  if (!access.success) return access;

  // The database function independently derives auth.uid(),
  // enforces MFA, and invalidates claims when disabling.
  const { data, error } = await access.client.rpc(
    "set_recommendation_background_refresh",
    { p_enabled: enabled },
  );

  if (error || data !== enabled) {
    return failure("LOAD_FAILED", LOAD_FAILED_ERROR);
  }

  return { success: true, enabled: data };
}