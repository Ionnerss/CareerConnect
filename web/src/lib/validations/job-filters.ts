import { z } from "zod";
import { JOB_EMPLOYMENT_TYPES } from "./job-posting";

export const JOB_EXPERIENCE_LEVELS = [
  "Entry Level",
  "Mid Level",
  "Senior Level",
] as const;

function emptyToUndefined(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  return value;
}

const optionalSalary = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(
      /^\d{1,10}(?:\.\d{1,2})?$/,
      "Salary must be a non-negative number with at most two decimals."
    )
    .transform(Number)
    .optional()
);

export const jobFiltersSchema = z
  .object({
    location: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .max(150)
        // Prevent user-supplied SQL LIKE wildcards.
        .regex(/^[^%_\\]+$/, "Invalid location.")
        .optional()
    ),

    minSalary: optionalSalary,
    maxSalary: optionalSalary,

    experienceLevel: z.preprocess(
      emptyToUndefined,
      z.enum(JOB_EXPERIENCE_LEVELS).optional()
    ),

    jobType: z.preprocess(
      emptyToUndefined,
      z.enum(JOB_EMPLOYMENT_TYPES).optional()
    ),
  })
  .superRefine((filters, ctx) => {
    if (
      filters.minSalary !== undefined &&
      filters.maxSalary !== undefined &&
      filters.minSalary > filters.maxSalary
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxSalary"],
        message: "Minimum salary cannot exceed maximum salary.",
      });
    }
  });

export type JobFilters = z.infer<typeof jobFiltersSchema>;
