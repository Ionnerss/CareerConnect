// What the recommendations endpoint (POST /api/recommendations) sends back, and how its
// error codes map to HTTP status codes. Kept out of route.ts because Next.js only allows
// route files to export request handlers.

import type { GetRecommendationsResponse } from "./recommend";
import type { RecommendationInputsErrorCode } from "./recommendation-inputs";

export type RecommendationsApiErrorCode =
  | RecommendationInputsErrorCode
  | "AI_NOT_CONFIGURED"
  | "BACKEND_ERROR";

export type RecommendationsApiFailure = {
  success: false;
  code: RecommendationsApiErrorCode;
  error: string;
};

/** The JSON body of every response from the endpoint. */
export type RecommendationsApiResponse =
  | Extract<GetRecommendationsResponse, { success: true }>
  | RecommendationsApiFailure;

export const RECOMMENDATIONS_ERROR_STATUS: Record<RecommendationsApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  MFA_REQUIRED: 403,
  NOT_JOB_SEEKER: 403,
  AUTH_UNAVAILABLE: 503,
  AI_NOT_CONFIGURED: 503,
  LOAD_FAILED: 500,
  BACKEND_ERROR: 500,
};

export const AI_NOT_CONFIGURED_ERROR = "AI recommendations are not set up on the server yet.";
export const BACKEND_ERROR = "Unable to load your recommendations. Please try again.";
