// Ties the pieces together for the recruiter candidate comparison:
// build questions -> ask Jev about each candidate -> score in code -> rank.
// No database access here. The model call is passed in so tests can fake it.
//
// SERVER ONLY (it uses node:crypto and, by default, the server-only Jev client).

import { createHash } from "node:crypto";
import {
  askJevScores,
  JevError,
  type JevErrorCode,
  type JevScoreAnswer,
  type JevScoreQuestion,
} from "@/lib/ai/jev";
import {
  buildRequirementQuestions,
  computeCandidateScore,
  rankCandidates,
  resultsFromAnswers,
  type CandidateScore,
  type Requirement,
  type RequirementResult,
} from "./candidate-scoring";
import type { CandidateState } from "./candidate-state";

export type AskJev = (
  state: Record<string, unknown>,
  questions: Record<string, JevScoreQuestion>,
) => Promise<Record<string, JevScoreAnswer>>;

const defaultAsk: AskJev = (state, questions) => askJevScores(state, questions);

export const DEFAULT_CONCURRENCY = 3;

export type CandidateEvaluation = CandidateScore & {
  results: RequirementResult[];
};

export type CandidateInput = {
  applicationId: string;
  state: CandidateState;
};

export type ComparedCandidate =
  | ({ status: "ok"; applicationId: string } & CandidateEvaluation)
  | { status: "error"; applicationId: string; code: JevErrorCode | "unexpected"; message: string };

/**
 * A short fingerprint of the requirements. Saved with each evaluation so a stored result
 * is reused only while the requirements are unchanged.
 */
export function hashRequirements(requirements: Requirement[]): string {
  const normalized = [...requirements]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, text, kind, weight }) => ({ id, text, kind, weight }));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/** Score one candidate against the requirements. Throws JevError if the model call fails. */
export async function evaluateCandidate(
  requirements: Requirement[],
  state: CandidateState,
  ask: AskJev = defaultAsk,
): Promise<CandidateEvaluation> {
  const { questions, idByKey } = buildRequirementQuestions(requirements);
  const answers = await ask(state, questions);
  const results = resultsFromAnswers(answers, idByKey);
  return { ...computeCandidateScore(requirements, results), results };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await task(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker),
  );
  return output;
}

/**
 * Compare several candidates. One candidate failing does not stop the others: it is
 * returned with status "error". A missing API key is a server setup problem, not a
 * candidate problem, so it is thrown for the caller to handle.
 */
export async function compareCandidates(
  requirements: Requirement[],
  candidates: CandidateInput[],
  options: { ask?: AskJev; concurrency?: number } = {},
): Promise<ComparedCandidate[]> {
  const ask = options.ask ?? defaultAsk;

  return mapWithConcurrency(
    candidates,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (candidate): Promise<ComparedCandidate> => {
      try {
        const evaluation = await evaluateCandidate(requirements, candidate.state, ask);
        return { status: "ok", applicationId: candidate.applicationId, ...evaluation };
      } catch (error) {
        if (error instanceof JevError) {
          if (error.code === "missing_key") throw error;
          return {
            status: "error",
            applicationId: candidate.applicationId,
            code: error.code,
            message: error.message,
          };
        }
        return {
          status: "error",
          applicationId: candidate.applicationId,
          code: "unexpected",
          message: "Something went wrong while scoring this candidate.",
        };
      }
    },
  );
}

/** Split a comparison into ranked successes (best first) and failures. */
export function rankComparison(compared: ComparedCandidate[]): {
  ranked: Extract<ComparedCandidate, { status: "ok" }>[];
  failed: Extract<ComparedCandidate, { status: "error" }>[];
} {
  const ok = compared.filter(
    (candidate): candidate is Extract<ComparedCandidate, { status: "ok" }> =>
      candidate.status === "ok",
  );
  const failed = compared.filter(
    (candidate): candidate is Extract<ComparedCandidate, { status: "error" }> =>
      candidate.status === "error",
  );
  return { ranked: rankCandidates(ok), failed };
}
