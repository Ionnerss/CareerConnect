import { describe, expect, it, vi } from "vitest";
import { JevError, type JevScoreAnswer } from "@/lib/ai/jev";
import type { Requirement } from "./candidate-scoring";
import {
  compareCandidates,
  evaluateCandidate,
  hashRequirements,
  rankComparison,
  type AskJev,
} from "./candidate-comparison";
import type { CandidateState } from "./candidate-state";

const requirements: Requirement[] = [
  { id: "react", text: "2+ years of React", kind: "core", weight: 3 },
  { id: "ts", text: "TypeScript experience", kind: "core", weight: 3 },
  { id: "node", text: "Node.js backend experience", kind: "nice", weight: 1 },
];

function state(label: string): CandidateState {
  return {
    skills: [{ name: label, proficiency: "Advanced" }],
    education: [],
    experience: [],
    total_years_of_experience: 0,
  };
}

/** A fake model that gives every question the same answer. */
function constantAsk(score: number, confidence: number): AskJev {
  return vi.fn(async (_state, questions) =>
    Object.fromEntries(
      Object.keys(questions).map((key): [string, JevScoreAnswer] => [key, { score, confidence }]),
    ),
  );
}

describe("hashRequirements", () => {
  it("is the same for the same requirements in any order", () => {
    expect(hashRequirements(requirements)).toBe(hashRequirements([...requirements].reverse()));
  });

  it.each([
    ["text", { text: "3+ years of React" }],
    ["kind", { kind: "nice" as const }],
    ["weight", { weight: 2 }],
  ])("changes when a requirement's %s changes", (_label, change) => {
    const changed = requirements.map((r, i) => (i === 0 ? { ...r, ...change } : r));
    expect(hashRequirements(changed)).not.toBe(hashRequirements(requirements));
  });

  it("changes when a requirement is added", () => {
    expect(hashRequirements([...requirements, { id: "sql", text: "SQL", kind: "nice", weight: 1 }])).not.toBe(
      hashRequirements(requirements),
    );
  });
});

describe("evaluateCandidate", () => {
  it("asks one score question per requirement and scores the answers", async () => {
    const ask = constantAsk(3, 0.9);

    const result = await evaluateCandidate(requirements, state("a"), ask);

    expect(ask).toHaveBeenCalledTimes(1);
    const [sentState, sentQuestions] = (ask as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sentState).toEqual(state("a"));
    expect(Object.keys(sentQuestions)).toEqual(["r1", "r2", "r3"]);
    expect(result.score).toBe(100);
    expect(result.needsHumanReview).toBe(false);
    expect(result.results.map((r) => r.requirementId)).toEqual(["react", "ts", "node"]);
  });

  it("flags low confidence for human review", async () => {
    const result = await evaluateCandidate(requirements, state("a"), constantAsk(2, 0.4));
    expect(result.needsHumanReview).toBe(true);
    expect(result.minConfidence).toBe(0.4);
  });

  it("lets a model failure through as a JevError", async () => {
    const ask: AskJev = async () => {
      throw new JevError("timeout", "slow");
    };
    await expect(evaluateCandidate(requirements, state("a"), ask)).rejects.toBeInstanceOf(JevError);
  });
});

describe("compareCandidates", () => {
  it("returns one entry per candidate in input order", async () => {
    const compared = await compareCandidates(
      requirements,
      [
        { applicationId: "app-1", state: state("one") },
        { applicationId: "app-2", state: state("two") },
      ],
      { ask: constantAsk(3, 0.9) },
    );

    expect(compared.map((c) => c.applicationId)).toEqual(["app-1", "app-2"]);
    expect(compared.every((c) => c.status === "ok")).toBe(true);
  });

  it("returns an empty list for no candidates without calling the model", async () => {
    const ask = constantAsk(3, 0.9);
    expect(await compareCandidates(requirements, [], { ask })).toEqual([]);
    expect(ask).not.toHaveBeenCalled();
  });

  it("keeps going when one candidate fails", async () => {
    const ask: AskJev = async (candidateState, questions) => {
      if ((candidateState as CandidateState).skills[0].name === "bad") {
        throw new JevError("http_error", "Jev returned HTTP 500.", 500);
      }
      return Object.fromEntries(Object.keys(questions).map((key) => [key, { score: 3, confidence: 0.9 }]));
    };

    const compared = await compareCandidates(
      requirements,
      [
        { applicationId: "good", state: state("good") },
        { applicationId: "broken", state: state("bad") },
      ],
      { ask },
    );

    expect(compared[0]).toMatchObject({ applicationId: "good", status: "ok", score: 100 });
    expect(compared[1]).toMatchObject({ applicationId: "broken", status: "error", code: "http_error" });
  });

  it("reports unexpected errors without leaking their details", async () => {
    const ask: AskJev = async () => {
      throw new Error("secret internal detail");
    };

    const [only] = await compareCandidates(requirements, [{ applicationId: "a", state: state("a") }], { ask });

    expect(only).toMatchObject({ status: "error", code: "unexpected" });
    expect(JSON.stringify(only)).not.toContain("secret internal detail");
  });

  it("throws on a missing key instead of failing every candidate one by one", async () => {
    const ask: AskJev = async () => {
      throw new JevError("missing_key", "AI_GATEWAY_API_KEY is not set on the server.");
    };

    await expect(
      compareCandidates(requirements, [{ applicationId: "a", state: state("a") }], { ask }),
    ).rejects.toMatchObject({ code: "missing_key" });
  });

  it("never runs more model calls at once than the concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const ask: AskJev = async (_state, questions) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return Object.fromEntries(Object.keys(questions).map((key) => [key, { score: 1, confidence: 0.9 }]));
    };

    await compareCandidates(
      requirements,
      Array.from({ length: 8 }, (_, i) => ({ applicationId: `app-${i}`, state: state(`c${i}`) })),
      { ask, concurrency: 2 },
    );

    expect(maxInFlight).toBe(2);
  });
});

describe("rankComparison", () => {
  it("ranks successes best first and separates failures", async () => {
    const askBySkill: AskJev = async (candidateState, questions) => {
      const name = (candidateState as CandidateState).skills[0].name;
      if (name === "broken") throw new JevError("network", "down");
      const score = name === "strong" ? 3 : 1;
      return Object.fromEntries(Object.keys(questions).map((key) => [key, { score, confidence: 0.9 }]));
    };

    const compared = await compareCandidates(
      requirements,
      [
        { applicationId: "weak", state: state("weak") },
        { applicationId: "broken", state: state("broken") },
        { applicationId: "strong", state: state("strong") },
      ],
      { ask: askBySkill },
    );
    const { ranked, failed } = rankComparison(compared);

    expect(ranked.map((c) => c.applicationId)).toEqual(["strong", "weak"]);
    expect(failed.map((c) => c.applicationId)).toEqual(["broken"]);
  });
});
