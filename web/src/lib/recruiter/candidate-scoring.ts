// Pure scoring logic for the recruiter candidate comparison (no network, no database).
// Jev only answers per-requirement questions; everything that turns those answers into
// a number, a flag or a ranking happens here, in code, so it can be tested.

import type { JevScoreAnswer, JevScoreQuestion } from "@/lib/ai/jev";

/** Rubric levels sent to Jev. Level index = score, so the top level is 3. */
export const SCORE_LEVELS = [
  "No evidence",
  "Weak or indirect evidence",
  "Clear evidence",
  "Strong, explicit evidence",
] as const;
export const MAX_SCORE_LEVEL = SCORE_LEVELS.length - 1;

/** A candidate whose lowest confidence is under this needs a human to look. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

export type RequirementKind = "core" | "nice";

export type Requirement = {
  id: string;
  text: string;
  kind: RequirementKind;
  /** Positive number. Core requirements normally get a higher weight. */
  weight: number;
};

export type RequirementResult = {
  requirementId: string;
  /** 0 to MAX_SCORE_LEVEL */
  score: number;
  /** 0 to 1 */
  confidence: number;
};

export type CandidateScore = {
  /** 0 to 100, rounded. */
  score: number;
  /** Lowest confidence across all requirements. */
  minConfidence: number;
  needsHumanReview: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Weighted score: 100 x sum(weight x score / max) / sum(weight).
 * A requirement with no result counts as score 0 and confidence 0, so the candidate is
 * flagged for review instead of silently scoring well.
 */
export function computeCandidateScore(
  requirements: Requirement[],
  results: RequirementResult[],
): CandidateScore {
  if (requirements.length === 0) {
    throw new RangeError("At least one requirement is needed to score a candidate.");
  }
  for (const requirement of requirements) {
    if (!Number.isFinite(requirement.weight) || requirement.weight <= 0) {
      throw new RangeError(`Requirement "${requirement.id}" needs a weight above 0.`);
    }
  }

  const byRequirement = new Map(results.map((result) => [result.requirementId, result]));

  let weighted = 0;
  let totalWeight = 0;
  let minConfidence = 1;

  for (const requirement of requirements) {
    const result = byRequirement.get(requirement.id);
    const score = result ? clamp(result.score, 0, MAX_SCORE_LEVEL) : 0;
    const confidence = result ? clamp(result.confidence, 0, 1) : 0;

    weighted += requirement.weight * (score / MAX_SCORE_LEVEL);
    totalWeight += requirement.weight;
    minConfidence = Math.min(minConfidence, confidence);
  }

  return {
    score: Math.round((100 * weighted) / totalWeight),
    minConfidence,
    needsHumanReview: minConfidence < LOW_CONFIDENCE_THRESHOLD,
  };
}

/** Best score first. Ties keep their original order (the sort is stable). */
export function rankCandidates<T extends { score: number }>(candidates: T[]): T[] {
  return [...candidates].sort((a, b) => b.score - a.score);
}

/**
 * Build the Jev questions for a list of requirements, one score question each.
 * Question ids are r1, r2, ... (not the database ids) and `idByKey` maps them back.
 */
export function buildRequirementQuestions(requirements: Requirement[]): {
  questions: Record<string, JevScoreQuestion>;
  idByKey: Record<string, string>;
} {
  const questions: Record<string, JevScoreQuestion> = {};
  const idByKey: Record<string, string> = {};

  requirements.forEach((requirement, index) => {
    const key = `r${index + 1}`;
    idByKey[key] = requirement.id;
    questions[key] = {
      type: "score",
      instructions: `Rate how well the candidate data shows this requirement: "${requirement.text}". Judge only from what the data explicitly states.`,
      criteria: [...SCORE_LEVELS],
    };
  });

  return { questions, idByKey };
}

/** Turn Jev's answers (keyed r1, r2, ...) back into results keyed by requirement id. */
export function resultsFromAnswers(
  answers: Record<string, JevScoreAnswer>,
  idByKey: Record<string, string>,
): RequirementResult[] {
  return Object.entries(idByKey).flatMap(([key, requirementId]) => {
    const answer = answers[key];
    return answer
      ? [{ requirementId, score: answer.score, confidence: answer.confidence }]
      : [];
  });
}

const MAX_PLAUSIBLE_YEARS = 60;

/**
 * Years of experience stated in free text, found with a regex (not by the model).
 * Only sentences that mention "experience" count. For "3-5 years" it returns the lower
 * number. With several mentions it returns the largest. Returns null if none is found.
 */
export function extractYearsOfExperience(text: string | null | undefined): number | null {
  if (!text) return null;

  const rangePattern =
    /(\d{1,2}(?:\.\d+)?)\s*(?:-|–|to)\s*(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/gi;
  const singlePattern = /(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/gi;

  let best: number | null = null;
  const consider = (value: number) => {
    if (Number.isFinite(value) && value >= 0 && value <= MAX_PLAUSIBLE_YEARS) {
      best = best === null ? value : Math.max(best, value);
    }
  };

  // Split on . ! ? followed by whitespace (so "4.5" stays whole) and on line breaks.
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (!/experience/i.test(sentence)) continue;

    for (const match of sentence.matchAll(rangePattern)) {
      consider(Math.min(Number(match[1]), Number(match[2])));
    }
    const withoutRanges = sentence.replace(rangePattern, " ");
    for (const match of withoutRanges.matchAll(singlePattern)) {
      consider(Number(match[1]));
    }
  }

  return best;
}
