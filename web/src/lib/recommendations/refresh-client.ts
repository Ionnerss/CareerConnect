import { z } from "zod";
import { recommendationRefreshStatusSchema } from "./refresh-status";

const serverErrorCodeSchema = z.enum([
  "UNAUTHENTICATED",
  "MFA_REQUIRED",
  "NOT_JOB_SEEKER",
  "AUTH_UNAVAILABLE",
  "AI_NOT_CONFIGURED",
  "LOAD_FAILED",
  "BACKEND_ERROR",
  "RATE_LIMITED",
]);

export type RecommendationRequestErrorCode =
  | z.infer<typeof serverErrorCodeSchema>
  | "NETWORK"
  | "INVALID_RESPONSE";

const ERROR_MESSAGES: Record<
  RecommendationRequestErrorCode,
  string
> = {
  UNAUTHENTICATED: "Sign in to view your recommendations.",
  MFA_REQUIRED: "Complete two-factor authentication to continue.",
  NOT_JOB_SEEKER: "Recommendations are available to job seekers.",
  AUTH_UNAVAILABLE: "Unable to verify your session. Please try again.",
  AI_NOT_CONFIGURED: "Recommendations are not configured yet.",
  LOAD_FAILED: "Unable to load your recommendations. Please try again.",
  BACKEND_ERROR: "Unable to complete the request. Please try again.",
  RATE_LIMITED: "Please wait before requesting another refresh.",
  NETWORK: "Unable to reach the server. Check your connection.",
  INVALID_RESPONSE: "The server returned an unexpected response.",
};

export class RecommendationRequestError extends Error {
  constructor(
    readonly code: RecommendationRequestErrorCode,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = "RecommendationRequestError";
  }
}

const skillMatchSchema = z.object({
  percent: z.number().min(0).max(100),
  matched: z.array(z.string()),
  missing: z.array(z.string()),
});

const fitSchema = z.object({
  score: z.number().min(0).max(100),
  minConfidence: z.number().min(0).max(1),
  lowConfidence: z.boolean(),
  levels: z.object({
    skills: z.number().min(0).max(3),
    level: z.number().min(0).max(3),
    interest: z.number().min(0).max(3),
  }),
});

const recommendationSchema = z.object({
  job: z.object({
    id: z.string(),
    title: z.string().nullable(),
    firm_name: z.string().nullable(),
    location: z.string().nullable(),
    work_mode: z.string().nullable(),
    employment_type: z.string().nullable(),
    required_skills: z.string().nullable(),
    salary: z.number().nullable(),
    experience: z.number().nullable(),
    description: z.string().nullable(),
    status: z.string().nullable(),
    created_at: z.string(),
  }),
  score: z.number().min(0).max(100),
  match_score: z.number().min(0).max(100),
  fit: fitSchema.nullable(),
  skill_match: skillMatchSchema.nullable(),
  reasons: z.array(z.string()),
  summary: z.string().nullable(),
  fit_error: z
    .enum([
      "missing_key",
      "timeout",
      "network",
      "http_error",
      "invalid_response",
      "unexpected",
    ])
    .nullable(),
  fit_generated_at: z.string().nullable(),
});

const savedRecommendationsSchema = z.object({
  success: z.literal(true),
  run: z
    .object({
      id: z.string(),
      created_at: z.string(),
      completed_at: z.string(),
      result_count: z.number().int().nonnegative(),
      summary_count: z.number().int().nonnegative(),
      ranking_mode: z.enum(["ai", "mixed", "code_only"]).nullable(),
    })
    .nullable(),
  recommendations: z.array(recommendationSchema),
});

const refreshStatusResponseSchema =
  recommendationRefreshStatusSchema.extend({
    success: z.literal(true),
    processing_enabled: z.boolean(),
  });

const refreshRequestSchema = z.object({
  success: z.literal(true),
  status: z.enum(["queued", "already_pending"]),
});

const failureSchema = z.object({
  success: z.literal(false),
  code: serverErrorCodeSchema,
});

export type SavedRecommendationResults = z.infer<
  typeof savedRecommendationsSchema
>;

export type SavedRecommendation = z.infer<
  typeof recommendationSchema
>;

export type RefreshStatusResult = z.infer<
  typeof refreshStatusResponseSchema
>;

export type RefreshQueueResult = z.infer<
  typeof refreshRequestSchema
>;

async function requestValidated<T extends z.ZodType>(
  path: string,
  method: "GET" | "POST",
  schema: T,
  signal?: AbortSignal,
): Promise<z.output<T>> {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;

    throw new RecommendationRequestError("NETWORK");
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;

    throw new RecommendationRequestError("INVALID_RESPONSE");
  }

  if (!response.ok) {
    const failure = failureSchema.safeParse(body);

    const retryHeader = response.headers.get("Retry-After");
    const retrySeconds =
      retryHeader !== null && retryHeader.trim() !== ""
        ? Number(retryHeader)
        : Number.NaN;

    const retryAfter =
      Number.isSafeInteger(retrySeconds) && retrySeconds >= 0
        ? retrySeconds
        : null;

    throw new RecommendationRequestError(
      failure.success ? failure.data.code : "BACKEND_ERROR",
      response.status === 429 ? retryAfter : null,
    );
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new RecommendationRequestError("INVALID_RESPONSE");
  }

  return parsed.data;
}

export function fetchSavedRecommendations(
  signal?: AbortSignal,
): Promise<SavedRecommendationResults> {
  return requestValidated(
    "/api/recommendations",
    "GET",
    savedRecommendationsSchema,
    signal,
  );
}

export function fetchRecommendationRefreshStatus(
  signal?: AbortSignal,
): Promise<RefreshStatusResult> {
  return requestValidated(
    "/api/recommendations/status",
    "GET",
    refreshStatusResponseSchema,
    signal,
  );
}

export function enqueueRecommendationRefresh(
  signal?: AbortSignal,
): Promise<RefreshQueueResult> {
  return requestValidated(
    "/api/recommendations/refresh",
    "POST",
    refreshRequestSchema,
    signal,
  );
}