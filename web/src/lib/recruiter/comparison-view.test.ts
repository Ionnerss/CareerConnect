import { describe, expect, it } from "vitest";
import {
  DEFAULT_CORE_WEIGHT,
  DEFAULT_NICE_WEIGHT,
  buildComparisonRows,
  defaultWeight,
  draftsFromSaved,
  draftsToPayload,
  formatConfidence,
  hasUnsavedChanges,
  levelLabel,
  validateDrafts,
  type RequirementDraft,
} from "./comparison-view";
import type { ComparisonCandidate, SavedRequirement } from "./candidate-comparison-service";

const saved: SavedRequirement[] = [
  { id: "r-1", text: "2+ years of React", kind: "core", weight: 8 },
  { id: "r-2", text: "TypeScript", kind: "nice", weight: 3 },
];

function draft(overrides: Partial<RequirementDraft> = {}): RequirementDraft {
  return { key: "k", text: "React", kind: "core", weight: 8, ...overrides };
}

describe("defaults", () => {
  it("uses a high weight for core and a low weight for nice-to-have", () => {
    expect(defaultWeight("core")).toBe(DEFAULT_CORE_WEIGHT);
    expect(defaultWeight("nice")).toBe(DEFAULT_NICE_WEIGHT);
    expect(DEFAULT_CORE_WEIGHT).toBeGreaterThan(DEFAULT_NICE_WEIGHT);
  });
});

describe("drafts", () => {
  it("turns saved requirements into editor rows keyed by their id", () => {
    expect(draftsFromSaved(saved)).toEqual([
      { key: "r-1", id: "r-1", text: "2+ years of React", kind: "core", weight: 8 },
      { key: "r-2", id: "r-2", text: "TypeScript", kind: "nice", weight: 3 },
    ]);
  });

  it("drops blank rows and tidies spaces when building the payload", () => {
    const payload = draftsToPayload([draft({ text: "  React   hooks  " }), draft({ text: "   " })]);
    expect(payload).toEqual([{ text: "React hooks", kind: "core", weight: 8 }]);
  });

  it("explains the first problem in plain words", () => {
    expect(validateDrafts([draft({ text: "   " })])).toBe("Add at least one requirement.");
    expect(validateDrafts([draft({ weight: 11 })])).toBe("Weight must be at most 10.");
    expect(validateDrafts([draft({ weight: 0 })])).toBe("Weight must be at least 1.");
    expect(validateDrafts([draft({ weight: 2.5 })])).toBe("Weight must be a whole number.");
    expect(validateDrafts([draft({ text: "x".repeat(301) })])).toMatch(/300 characters/);
    expect(validateDrafts([draft({ weight: Number.NaN })])).toBe("Enter a weight from 1 to 10 for every requirement.");
    expect(validateDrafts([draft({ text: "", weight: Number.NaN }), draft()])).toBeNull(); // blank row ignored
    expect(validateDrafts([draft()])).toBeNull();
  });

  it("detects unsaved changes", () => {
    const unchanged = draftsFromSaved(saved);
    expect(hasUnsavedChanges(unchanged, saved)).toBe(false);
    expect(hasUnsavedChanges([...unchanged, draft({ text: "   " })], saved)).toBe(false); // blank row ignored
    expect(hasUnsavedChanges([...unchanged, draft({ text: "SQL" })], saved)).toBe(true);
    expect(hasUnsavedChanges([{ ...unchanged[0], weight: 9 }, unchanged[1]], saved)).toBe(true);
    expect(hasUnsavedChanges([{ ...unchanged[0], kind: "nice" }, unchanged[1]], saved)).toBe(true);
    expect(hasUnsavedChanges([{ ...unchanged[0], text: "React" }, unchanged[1]], saved)).toBe(true);
    expect(hasUnsavedChanges([unchanged[0]], saved)).toBe(true);
  });
});

describe("levelLabel and formatConfidence", () => {
  it("rounds the model's score to the nearest level and stays in range", () => {
    expect(levelLabel(0)).toBe("None");
    expect(levelLabel(0.4)).toBe("None");
    expect(levelLabel(0.6)).toBe("Weak");
    expect(levelLabel(2)).toBe("Clear");
    expect(levelLabel(2.7)).toBe("Strong");
    expect(levelLabel(3)).toBe("Strong");
    expect(levelLabel(7)).toBe("Strong");
    expect(levelLabel(-2)).toBe("None");
  });

  it("shows confidence as a percentage", () => {
    expect(formatConfidence(0.374)).toBe("37%");
    expect(formatConfidence(1)).toBe("100%");
    expect(formatConfidence(2)).toBe("100%");
  });
});

describe("buildComparisonRows", () => {
  const ranked: ComparisonCandidate[] = [
    {
      application_id: "a-1",
      full_name: "Alice",
      score: 90,
      min_confidence: 0.8,
      needs_human_review: false,
      cached: false,
      results: [
        { requirement_id: "r-1", score: 3, confidence: 0.9 },
        { requirement_id: "r-2", score: 2.2, confidence: 0.8 },
      ],
    },
    {
      application_id: "a-2",
      full_name: null,
      score: 40,
      min_confidence: 0.3,
      needs_human_review: true,
      cached: true,
      results: [{ requirement_id: "r-1", score: 1, confidence: 0.3 }],
    },
  ];

  it("has one row per requirement and one cell per candidate, best candidate first", () => {
    const rows = buildComparisonRows(saved, ranked);

    expect(rows.map((row) => row.requirement.id)).toEqual(["r-1", "r-2"]);
    expect(rows[0].cells.map((cell) => cell.applicationId)).toEqual(["a-1", "a-2"]);
    expect(rows[0].cells[0]).toMatchObject({ level: "Strong", confidence: 0.9, lowConfidence: false });
    expect(rows[0].cells[1]).toMatchObject({ level: "Weak", confidence: 0.3, lowConfidence: true });
  });

  it("leaves a cell empty when the model gave no answer for that requirement", () => {
    const rows = buildComparisonRows(saved, ranked);

    expect(rows[1].cells[1]).toEqual({
      applicationId: "a-2",
      level: null,
      confidence: null,
      lowConfidence: false,
    });
  });
});
