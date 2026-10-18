import { describe, expect, it } from "vitest";
import {
  buildRequirementQuestions,
  computeCandidateScore,
  extractYearsOfExperience,
  LOW_CONFIDENCE_THRESHOLD,
  MAX_SCORE_LEVEL,
  rankCandidates,
  resultsFromAnswers,
  type Requirement,
  type RequirementResult,
} from "./candidate-scoring";

// Same shape as the pilot: two core requirements (weight 3), two nice-to-have (weight 1).
const requirements: Requirement[] = [
  { id: "react", text: "2+ years of React experience", kind: "core", weight: 3 },
  { id: "ts", text: "TypeScript experience", kind: "core", weight: 3 },
  { id: "node", text: "Backend experience with Node.js", kind: "nice", weight: 1 },
  { id: "degree", text: "Computer science degree or equivalent", kind: "nice", weight: 1 },
];

function results(scores: number[], confidence: number | number[]): RequirementResult[] {
  return requirements.map((requirement, index) => ({
    requirementId: requirement.id,
    score: scores[index],
    confidence: Array.isArray(confidence) ? confidence[index] : confidence,
  }));
}

describe("computeCandidateScore", () => {
  it("scores 100 when every requirement is at the top level", () => {
    const outcome = computeCandidateScore(requirements, results([3, 3, 3, 3], 0.9));
    expect(outcome.score).toBe(100);
    expect(outcome.needsHumanReview).toBe(false);
  });

  it("scores 0 when there is no evidence for anything", () => {
    expect(computeCandidateScore(requirements, results([0, 0, 0, 0], 1)).score).toBe(0);
  });

  it("weights core requirements more than nice-to-have ones", () => {
    // Only the two core requirements met: (3 + 3) / 8 = 75.
    const coreOnly = computeCandidateScore(requirements, results([3, 3, 0, 0], 0.9));
    // Only the two nice-to-have met: (1 + 1) / 8 = 25.
    const niceOnly = computeCandidateScore(requirements, results([0, 0, 3, 3], 0.9));

    expect(coreOnly.score).toBe(75);
    expect(niceOnly.score).toBe(25);
  });

  it("handles partial scores and rounds to a whole number", () => {
    // Scores 3,0,3,0 with weights 3,3,1,1: (3*1 + 0 + 1*1 + 0) / 8 = 4 / 8 = 50.
    expect(computeCandidateScore(requirements, results([3, 0, 3, 0], 0.9)).score).toBe(50);
    // Scores 2,2,0,0: (3*2/3 + 3*2/3) / 8 = 4 / 8 = 50.
    expect(computeCandidateScore(requirements, results([2, 2, 0, 0], 0.9)).score).toBe(50);
    // Scores 1,0,0,0: (3*1/3) / 8 = 1 / 8 = 12.5, which rounds to 13.
    expect(computeCandidateScore(requirements, results([1, 0, 0, 0], 0.9)).score).toBe(13);
  });

  it("reports the lowest confidence across requirements", () => {
    const outcome = computeCandidateScore(requirements, results([3, 3, 3, 3], [0.9, 0.7, 0.95, 0.8]));
    expect(outcome.minConfidence).toBe(0.7);
  });

  it("flags review when any confidence is under the threshold", () => {
    const outcome = computeCandidateScore(requirements, results([3, 3, 3, 3], [0.9, 0.9, 0.9, 0.49]));
    expect(outcome.needsHumanReview).toBe(true);
  });

  it("does not flag review at exactly the threshold", () => {
    const outcome = computeCandidateScore(
      requirements,
      results([3, 3, 3, 3], LOW_CONFIDENCE_THRESHOLD),
    );
    expect(outcome.needsHumanReview).toBe(false);
  });

  it("flags a keyword-stuffed profile: a middling score with low confidence (modelled on the pilot case)", () => {
    // Illustrative numbers shaped like the pilot's keyword-stuffed resume (score in the 40s,
    // confidence under 0.5). Not real model output.
    const outcome = computeCandidateScore(requirements, results([2, 2.35, 0.7, 0.5], [0.6, 0.37, 0.5, 0.5]));
    expect(outcome.score).toBeGreaterThan(30);
    expect(outcome.needsHumanReview).toBe(true);
  });

  it("does not flag a clearly unrelated candidate when the model is sure (score 0, high confidence)", () => {
    const outcome = computeCandidateScore(requirements, results([0, 0, 0, 0], 1));
    expect(outcome).toEqual({ score: 0, minConfidence: 1, needsHumanReview: false });
  });

  it("treats a missing result as score 0 with confidence 0 and flags review", () => {
    const outcome = computeCandidateScore(requirements, results([3, 3, 3, 3], 0.9).slice(0, 3));
    expect(outcome.minConfidence).toBe(0);
    expect(outcome.needsHumanReview).toBe(true);
    // The missing "degree" requirement (weight 1) contributes nothing: 7 / 8 = 87.5 -> 88.
    expect(outcome.score).toBe(88);
  });

  it("clamps out-of-range scores and confidences from the model", () => {
    const outcome = computeCandidateScore(
      requirements,
      results([99, -5, MAX_SCORE_LEVEL, 0], [5, 0.9, 0.9, -1]),
    );
    // 99 -> 3, -5 -> 0: (3 + 0 + 1 + 0) / 8 = 50. Confidence 5 -> 1, -1 -> 0.
    expect(outcome.score).toBe(50);
    expect(outcome.minConfidence).toBe(0);
  });

  it("throws when there are no requirements", () => {
    expect(() => computeCandidateScore([], [])).toThrow(RangeError);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("throws for a weight of %s", (weight) => {
    expect(() =>
      computeCandidateScore([{ id: "x", text: "X", kind: "core", weight }], []),
    ).toThrow(RangeError);
  });
});

describe("rankCandidates", () => {
  it("orders by score, best first", () => {
    const ranked = rankCandidates([
      { name: "b", score: 40 },
      { name: "a", score: 95 },
      { name: "c", score: 0 },
    ]);
    expect(ranked.map((candidate) => candidate.name)).toEqual(["a", "b", "c"]);
  });

  it("keeps the original order for ties", () => {
    const ranked = rankCandidates([
      { name: "first", score: 50 },
      { name: "second", score: 50 },
      { name: "third", score: 50 },
    ]);
    expect(ranked.map((candidate) => candidate.name)).toEqual(["first", "second", "third"]);
  });

  it("does not change the array it was given", () => {
    const input = [{ score: 1 }, { score: 2 }];
    rankCandidates(input);
    expect(input).toEqual([{ score: 1 }, { score: 2 }]);
  });
});

describe("buildRequirementQuestions and resultsFromAnswers", () => {
  it("builds one score question per requirement with the full rubric", () => {
    const { questions, idByKey } = buildRequirementQuestions(requirements);

    expect(Object.keys(questions)).toEqual(["r1", "r2", "r3", "r4"]);
    expect(idByKey).toEqual({ r1: "react", r2: "ts", r3: "node", r4: "degree" });
    expect(questions.r1.type).toBe("score");
    expect(questions.r1.instructions).toContain("2+ years of React experience");
    expect(questions.r1.criteria).toHaveLength(MAX_SCORE_LEVEL + 1);
  });

  it("maps Jev answers back to requirement ids", () => {
    const { idByKey } = buildRequirementQuestions(requirements);

    const mapped = resultsFromAnswers(
      { r1: { score: 3, confidence: 0.9 }, r3: { score: 1, confidence: 0.6 } },
      idByKey,
    );

    expect(mapped).toEqual([
      { requirementId: "react", score: 3, confidence: 0.9 },
      { requirementId: "node", score: 1, confidence: 0.6 },
    ]);
  });
});

describe("extractYearsOfExperience", () => {
  it.each([
    ["5 years of experience with React", 5],
    ["Over 3+ years experience in backend", 3],
    ["Experience: 2 yrs in QA", 2],
    ["I have 4.5 years of professional experience.", 4.5],
  ])("finds the years in %j", (text, expected) => {
    expect(extractYearsOfExperience(text)).toBe(expected);
  });

  it("uses the lower number of a range", () => {
    expect(extractYearsOfExperience("3-5 years of experience")).toBe(3);
    expect(extractYearsOfExperience("2 to 4 years experience")).toBe(2);
  });

  it("returns the largest figure when several are stated", () => {
    expect(
      extractYearsOfExperience("2 years of experience in QA. 6 years of experience in dev."),
    ).toBe(6);
  });

  it("ignores years in sentences that do not mention experience", () => {
    expect(extractYearsOfExperience("Founded 10 years ago. Studied for 4 years.")).toBeNull();
  });

  it("ignores implausible numbers", () => {
    expect(extractYearsOfExperience("99 years of experience")).toBeNull();
  });

  it.each([[null], [undefined], [""], ["No numbers here, just experience."]])(
    "returns null for %j",
    (text) => {
      expect(extractYearsOfExperience(text)).toBeNull();
    },
  );
});
