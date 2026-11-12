// Asks Jev how well each shortlisted posting fits one job seeker, then turns Jev's answers
// into a number in code. This is the "AI ranking" half of task #200.
//
// Jev only rates. It answers three score questions per posting (skills, level, interest)
// and everything after that (the weighted score, the low-confidence flag, the order)
// happens here, so it can be tested without a network. Same approach as the recruiter
// candidate comparison, just turned around: one seeker against several postings.
//
// SERVER ONLY (it uses the server-only Jev client and its API key).

import {
  askJevScores,
  JevError,
  type JevErrorCode,
  type JevScoreAnswer,
  type JevScoreQuestion,
} from "@/lib/ai/jev";
import { mapWithConcurrency } from "@/lib/recruiter/candidate-comparison";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/recruiter/candidate-scoring";
import { parseRequiredSkills } from "@/lib/recruiter/skill-match";
import type { ShortlistedJob } from "./job-shortlist";
import type { SeekerState } from "./seeker-state";

export type AskJev = (
  state: Record<string, unknown>,
  questions: Record<string, JevScoreQuestion>,
) => Promise<Record<string, JevScoreAnswer>>;

const defaultAsk: AskJev = (state, questions) => askJevScores(state, questions);

export const FIT_CONCURRENCY = 3;
export const MAX_JOB_DESCRIPTION_LENGTH = 600;

/** Highest level a fit question can return (the rubrics below have 4 levels: 0 to 3). */
export const MAX_FIT_LEVEL = 3;

export const FIT_QUESTION_KEYS = ["skills", "level", "interest"] as const;
export type FitQuestionKey = (typeof FIT_QUESTION_KEYS)[number];

/** How much each question counts toward the fit score. */
export const FIT_WEIGHTS: Record<FitQuestionKey, number> = {
  skills: 3,
  level: 1,
  interest: 2,
};

export const FIT_QUESTIONS: Record<FitQuestionKey, JevScoreQuestion> = {
  skills: {
    type: "score",
    instructions:
      "How well do the seeker's skills and work history cover what this job requires? Judge only from what the data explicitly states.",
    criteria: [
      "Almost none of what the job requires",
      "Some of what the job requires",
      "Most of what the job requires",
      "All or nearly all of what the job requires",
    ],
  },
  level: {
    type: "score",
    instructions:
      "Does the seeker's experience level fit the seniority this job asks for? Use the years of experience given in the data; do not work them out yourself.",
    criteria: [
      "Far below or far above what the job asks",
      "Somewhat below or above what the job asks",
      "Close to what the job asks",
      "A very good match for what the job asks",
    ],
  },
  interest: {
    type: "score",
    instructions:
      "Is this the kind of work the seeker is looking for, judging from their desired role and their background?",
    criteria: [
      "Unrelated to what they are looking for",
      "Only loosely related",
      "Related to what they are looking for",
      "Exactly the kind of role they are looking for",
    ],
  },
};

export type JobFit = {
  /** 0 to 100, rounded. */
  score: number;
  /** Lowest confidence across the three questions. */
  minConfidence: number;
  /** True when the model was unsure. The page can show a softer label for these. */
  lowConfidence: boolean;
  levels: Record<FitQuestionKey, number>;
};

export type RatedJob = ShortlistedJob & {
  /** Null when the model call for this posting failed; the code score is used instead. */
  fit: JobFit | null;
  fit_error: JevErrorCode | "unexpected" | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** What Jev sees about one posting. No company name, no recruiter details, no links. */
export function buildJobState(job: ShortlistedJob["job"]) {
  const description = job.description?.trim() ?? "";
  return {
    title: job.title,
    location: job.location,
    work_mode: job.work_mode,
    employment_type: job.employment_type,
    years_of_experience_asked: job.experience,
    required_skills: parseRequiredSkills(job.required_skills),
    description:
      description.length > MAX_JOB_DESCRIPTION_LENGTH
        ? `${description.slice(0, MAX_JOB_DESCRIPTION_LENGTH)}…`
        : description || null,
  };
}

/**
 * Weighted fit score: 100 x sum(weight x level / max level) / sum(weight).
 * A question with no answer counts as level 0 and confidence 0, so the posting is flagged
 * instead of silently scoring well.
 */
export function computeFit(answers: Partial<Record<FitQuestionKey, JevScoreAnswer>>): JobFit {
  let weighted = 0;
  let totalWeight = 0;
  let minConfidence = 1;
  const levels = { skills: 0, level: 0, interest: 0 } as Record<FitQuestionKey, number>;

  for (const key of FIT_QUESTION_KEYS) {
    const answer = answers[key];
    const level = answer ? clamp(answer.score, 0, MAX_FIT_LEVEL) : 0;
    const confidence = answer ? clamp(answer.confidence, 0, 1) : 0;

    levels[key] = level;
    weighted += FIT_WEIGHTS[key] * (level / MAX_FIT_LEVEL);
    totalWeight += FIT_WEIGHTS[key];
    minConfidence = Math.min(minConfidence, confidence);
  }

  return {
    score: Math.round((100 * weighted) / totalWeight),
    minConfidence,
    lowConfidence: minConfidence < LOW_CONFIDENCE_THRESHOLD,
    levels,
  };
}

/** Ask Jev about one posting. Throws JevError if the model call fails. */
export async function rateJob(
  seeker: SeekerState,
  job: ShortlistedJob["job"],
  ask: AskJev = defaultAsk,
): Promise<JobFit> {
  const answers = await ask({ seeker, job: buildJobState(job) }, FIT_QUESTIONS);
  return computeFit(answers);
}

/**
 * Rate every shortlisted posting. One posting failing does not stop the others: it keeps
 * `fit: null` and its code score. A missing API key is a server setup problem, not a
 * posting problem, so it is thrown for the caller to handle.
 */
export async function rateJobs(
  seeker: SeekerState,
  shortlist: ShortlistedJob[],
  options: { ask?: AskJev; concurrency?: number } = {},
): Promise<RatedJob[]> {
  const ask = options.ask ?? defaultAsk;

  return mapWithConcurrency(
    shortlist,
    options.concurrency ?? FIT_CONCURRENCY,
    async (item): Promise<RatedJob> => {
      try {
        const fit = await rateJob(seeker, item.job, ask);
        return { ...item, fit, fit_error: null };
      } catch (error) {
        if (error instanceof JevError) {
          if (error.code === "missing_key") throw error;
          return { ...item, fit: null, fit_error: error.code };
        }
        return { ...item, fit: null, fit_error: "unexpected" };
      }
    },
  );
}
