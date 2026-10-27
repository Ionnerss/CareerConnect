import { z } from "zod";

export const MAX_JOB_SEARCH_LENGTH = 100;

/**
 * Cleans the job search text.
 * - Missing or non-text values become "" (show all jobs).
 * - Characters that would break the Supabase filter (, ( ) % * \) are replaced by spaces.
 * - Extra spaces are collapsed and the result is limited to 100 characters.
 */
export const jobSearchQuerySchema = z.preprocess(
  (val) => (typeof val === "string" ? val : ""),
  z
    .string()
    .transform((val) =>
      val
        .replace(/[,()%*\\]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_JOB_SEARCH_LENGTH)
        .trim()
    )
);

export function normalizeJobSearchQuery(input: unknown): string {
  return jobSearchQuerySchema.parse(input);
}
