import { z } from "zod";

/** Work modes the `job` table accepts (job_work_mode_check). */
export const JOB_WORK_MODES = ["On-site", "Remote", "Hybrid"] as const;


/** Employment arrangements accepted by the job table. */
export const JOB_EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
] as const;

/**
 * Statuses the `job` table accepts (job_status_check), with the words the form shows.
 * "Published" is stored as "open".
 */
export const JOB_STATUS_OPTIONS = [
  { value: "open", label: "Published" },
  { value: "closed", label: "Closed" },
] as const;

export const MAX_JOB_SKILLS = 20;
export const MAX_JOB_SKILL_LENGTH = 50;
export const MAX_JOB_DESCRIPTION_LENGTH = 5000;
export const MAX_JOB_EXPERIENCE_YEARS = 50;

const blankToNull = (value: unknown) => {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : value;
  }

  return value;
};

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

/**
 * Splits "React, typescript,  SQL, react" into ["React", "typescript", "SQL"]:
 * trims each skill, squeezes spaces, drops empty ones and repeats (ignoring case).
 * The applicants page reads required_skills back with the same comma rule.
 */
export function parseSkillList(value: string): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];

  for (const raw of value.split(",")) {
    const skill = raw.replace(/\s+/g, " ").trim();
    const key = skill.toLowerCase();

    if (skill && !seen.has(key)) {
      seen.add(key);
      skills.push(skill);
    }
  }

  return skills;
}

/** What a recruiter fills in to post a job. Status defaults to open (Published). */
export const jobPostingSchema = z.object({
  title: requiredText("Job title", 150),
  firm_name: requiredText("Company name", 150),
  location: requiredText("Location", 150),

  work_mode: z.enum(JOB_WORK_MODES, { error: "Choose a work mode." }),

  employment_type: z.enum(JOB_EMPLOYMENT_TYPES, {
    error: "Choose an employment type.",
  }),

  required_skills: z
    .string({ error: "Add at least one required skill." })
    .transform(parseSkillList)
    .pipe(
      z
        .array(
          z
            .string()
            .max(
              MAX_JOB_SKILL_LENGTH,
              `Each skill must be ${MAX_JOB_SKILL_LENGTH} characters or fewer.`,
            ),
        )
        .min(1, "Add at least one required skill.")
        .max(MAX_JOB_SKILLS, `List at most ${MAX_JOB_SKILLS} skills.`),
    )
    .transform((skills) => skills.join(", ")),

  salary: z.preprocess(
    blankToNull,
    z
      .string()
      .regex(
        /^\d{1,10}(?:\.\d{1,2})?$/,
        "Enter a salary as a number, with at most two decimals (e.g. 65000).",
      )
      .refine((value) => Number(value) > 0, "Salary must be greater than zero.")
      .transform(Number)
      .nullable(),
  ),

  experience: z.preprocess(
    blankToNull,
    z
      .string()
      .regex(/^\d+$/, "Enter years of experience as a whole number.")
      .transform(Number)
      .refine(
        (value) => value <= MAX_JOB_EXPERIENCE_YEARS,
        `Years of experience must be ${MAX_JOB_EXPERIENCE_YEARS} or fewer.`,
      )
      .nullable(),
  ),

  description: requiredText("Description", MAX_JOB_DESCRIPTION_LENGTH),

  status: z.enum(["open", "closed"], { error: "Choose a status." }).default("open"),
});

export type JobPostingInput = z.input<typeof jobPostingSchema>;
export type JobPosting = z.output<typeof jobPostingSchema>;
