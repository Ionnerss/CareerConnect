// Pure helpers for the recruiter "Compare top candidates" screen. No React, no network.
// Kept separate so the table model and the form rules can be tested without rendering.

import { requirementsInputSchema } from "@/lib/validations/job-requirements";
import { LOW_CONFIDENCE_THRESHOLD, MAX_SCORE_LEVEL } from "./candidate-scoring";
import type { ComparisonCandidate, SavedRequirement } from "./candidate-comparison-service";

export type RequirementKind = "core" | "nice";

/** Starting weights when a recruiter adds a requirement (1 = minor, 5 = important, 10 = must-have). */
export const DEFAULT_CORE_WEIGHT = 8;
export const DEFAULT_NICE_WEIGHT = 3;

/** A requirement row in the editor. `id` is set once the row has been saved. */
export type RequirementDraft = {
  key: string;
  id?: string;
  text: string;
  kind: RequirementKind;
  weight: number;
};

export function defaultWeight(kind: RequirementKind): number {
  return kind === "core" ? DEFAULT_CORE_WEIGHT : DEFAULT_NICE_WEIGHT;
}

export function draftsFromSaved(saved: SavedRequirement[]): RequirementDraft[] {
  return saved.map((requirement) => ({
    key: requirement.id,
    id: requirement.id,
    text: requirement.text,
    kind: requirement.kind,
    weight: requirement.weight,
  }));
}

/** The body sent to the server: blank rows are dropped, text is tidied. */
export function draftsToPayload(
  drafts: RequirementDraft[],
): { text: string; kind: RequirementKind; weight: number }[] {
  return drafts
    .map((draft) => ({
      text: draft.text.replace(/\s+/g, " ").trim(),
      kind: draft.kind,
      weight: draft.weight,
    }))
    .filter((requirement) => requirement.text !== "");
}

/** The first problem with the requirements, in plain words, or null when they are fine. */
export function validateDrafts(drafts: RequirementDraft[]): string | null {
  if (drafts.some((draft) => draft.text.trim() !== "" && !Number.isFinite(draft.weight))) {
    return "Enter a weight from 1 to 10 for every requirement.";
  }
  const parsed = requirementsInputSchema.safeParse(draftsToPayload(drafts));
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Invalid requirements.");
}

/** True when the editor differs from what is saved (ignoring blank rows). */
export function hasUnsavedChanges(drafts: RequirementDraft[], saved: SavedRequirement[]): boolean {
  const current = draftsToPayload(drafts);
  if (current.length !== saved.length) return true;
  return current.some((requirement, index) => {
    const other = saved[index];
    return (
      requirement.text !== other.text ||
      requirement.kind !== other.kind ||
      requirement.weight !== other.weight
    );
  });
}

const LEVEL_LABELS = ["None", "Weak", "Clear", "Strong"] as const;

/** Words for a 0 to 3 score from the model (it can be fractional). */
export function levelLabel(score: number): (typeof LEVEL_LABELS)[number] {
  const level = Math.min(MAX_SCORE_LEVEL, Math.max(0, Math.round(score)));
  return LEVEL_LABELS[level];
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(Math.min(1, Math.max(0, confidence)) * 100)}%`;
}

export function isLowConfidence(confidence: number): boolean {
  return confidence < LOW_CONFIDENCE_THRESHOLD;
}

export type ComparisonCell = {
  applicationId: string;
  /** Null when the model gave no answer for this requirement. */
  level: (typeof LEVEL_LABELS)[number] | null;
  confidence: number | null;
  lowConfidence: boolean;
};

export type ComparisonRow = {
  requirement: SavedRequirement;
  cells: ComparisonCell[];
};

/** Requirements as rows, candidates (best first) as columns. */
export function buildComparisonRows(
  requirements: SavedRequirement[],
  ranked: ComparisonCandidate[],
): ComparisonRow[] {
  return requirements.map((requirement) => ({
    requirement,
    cells: ranked.map((candidate) => {
      const result = candidate.results.find((item) => item.requirement_id === requirement.id);
      return {
        applicationId: candidate.application_id,
        level: result ? levelLabel(result.score) : null,
        confidence: result ? result.confidence : null,
        lowConfidence: result ? isLowConfidence(result.confidence) : false,
      };
    }),
  }));
}
