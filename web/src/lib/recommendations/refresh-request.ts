import { authorizeRecommendationAccess } from "./refresh-preferences";
import {
  LOAD_FAILED_ERROR,
  type RecommendationInputsErrorCode,
} from "./recommendation-inputs";

export type RefreshRequestResponse =
  | {
      success: true;
      status: "queued" | "already_pending";
    }
  | {
      success: false;
      code: RecommendationInputsErrorCode | "RATE_LIMITED";
      error: string;
    };

export async function requestRecommendationRefresh():
  Promise<RefreshRequestResponse> {
  const access = await authorizeRecommendationAccess();

  if (!access.success) return access;

  // The database function independently derives auth.uid().
  // No caller-selected user ID is passed.
  const { data, error } = await access.client.rpc(
    "request_recommendation_refresh",
  );

  if (error) {
    return {
      success: false,
      code: "LOAD_FAILED",
      error: LOAD_FAILED_ERROR,
    };
  }

  if (data === "queued" || data === "already_pending") {
    return {
      success: true,
      status: data,
    };
  }

  if (data === "rate_limited") {
    return {
      success: false,
      code: "RATE_LIMITED",
      error: "Please wait before requesting another refresh.",
    };
  }

  return {
    success: false,
    code: "LOAD_FAILED",
    error: LOAD_FAILED_ERROR,
  };
}