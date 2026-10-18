import { z } from "zod";

export const MAX_REQUIREMENTS = 20;
export const MAX_REQUIREMENT_TEXT_LENGTH = 300;
export const MIN_REQUIREMENT_WEIGHT = 1;
export const MAX_REQUIREMENT_WEIGHT = 10;

/**
 * One requirement a recruiter sets on a posting. Matches the database checks on
 * job_requirements: text 1-300 characters, kind core or nice, weight 1-10.
 * Kind defaults to core and weight to 1, like the table defaults.
 */
export const requirementInputSchema = z.object({
  text: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, "Requirement text is required.")
        .max(
          MAX_REQUIREMENT_TEXT_LENGTH,
          `Requirement text must be ${MAX_REQUIREMENT_TEXT_LENGTH} characters or fewer.`,
        ),
    ),
  kind: z.enum(["core", "nice"]).default("core"),
  weight: z.coerce
    .number()
    .int("Weight must be a whole number.")
    .min(MIN_REQUIREMENT_WEIGHT, `Weight must be at least ${MIN_REQUIREMENT_WEIGHT}.`)
    .max(MAX_REQUIREMENT_WEIGHT, `Weight must be at most ${MAX_REQUIREMENT_WEIGHT}.`)
    .default(MIN_REQUIREMENT_WEIGHT),
});

export const requirementsInputSchema = z
  .array(requirementInputSchema)
  .min(1, "Add at least one requirement.")
  .max(MAX_REQUIREMENTS, `A posting can have at most ${MAX_REQUIREMENTS} requirements.`);

export type RequirementInput = z.infer<typeof requirementInputSchema>;
