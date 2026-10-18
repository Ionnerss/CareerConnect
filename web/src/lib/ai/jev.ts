// Jev client (TypeSafe "System One" decision model, called through Vercel AI Gateway).
//
// SERVER ONLY: this file reads AI_GATEWAY_API_KEY. Import it only from server code
// (route handlers, server actions, server components). Never import it from a
// "use client" file and never expose the key through a NEXT_PUBLIC_ variable.
//
// Jev cannot write text. It answers typed questions about a piece of state. Here we
// only use `score` questions: a level on a rubric we define, plus a confidence.

export const JEV_MODEL = "typesafe-ai/jev";
export const JEV_ENDPOINT = "https://ai-gateway.vercel.sh/v1/evaluate";
export const JEV_DEFAULT_TIMEOUT_MS = 20_000;

export type JevScoreQuestion = {
  type: "score";
  /** What to judge, in plain words. */
  instructions: string;
  /** Ordered level descriptions, lowest first. Jev allows 2 to 10 levels. */
  criteria: string[];
};

export type JevScoreAnswer = {
  /** A level between 0 and criteria.length - 1 (may be fractional). */
  score: number;
  /** 0 to 1. Low values mean the model is unsure. */
  confidence: number;
};

export type JevErrorCode =
  | "missing_key"
  | "timeout"
  | "network"
  | "http_error"
  | "invalid_response";

export class JevError extends Error {
  readonly code: JevErrorCode;
  readonly status?: number;

  constructor(code: JevErrorCode, message: string, status?: number) {
    super(message);
    this.name = "JevError";
    this.code = code;
    this.status = status;
  }
}

export type AskJevOptions = {
  /** Defaults to process.env.AI_GATEWAY_API_KEY. */
  apiKey?: string;
  timeoutMs?: number;
  /** Swap in a fake in tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Ask Jev a set of score questions about `state` and return one answer per question id.
 * Throws JevError on any failure; the message never contains the API key.
 */
export async function askJevScores(
  state: Record<string, unknown>,
  questions: Record<string, JevScoreQuestion>,
  options: AskJevOptions = {},
): Promise<Record<string, JevScoreAnswer>> {
  const apiKey = (options.apiKey ?? process.env.AI_GATEWAY_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new JevError("missing_key", "AI_GATEWAY_API_KEY is not set on the server.");
  }

  const questionIds = Object.keys(questions);
  if (questionIds.length === 0) {
    throw new JevError("invalid_response", "No questions were provided.");
  }

  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? JEV_DEFAULT_TIMEOUT_MS;

  let response: Response;
  try {
    response = await doFetch(JEV_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new JevError("timeout", `Jev did not answer within ${timeoutMs} ms.`);
    }
    throw new JevError("network", "Could not reach Jev.");
  }

  if (!response.ok) {
    throw new JevError("http_error", `Jev returned HTTP ${response.status}.`, response.status);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new JevError("invalid_response", "Jev returned a response that is not JSON.");
  }

  if (!isRecord(data) || !isRecord(data.answers)) {
    throw new JevError("invalid_response", "Jev response has no answers.");
  }

  const answers: Record<string, JevScoreAnswer> = {};
  for (const id of questionIds) {
    const raw = data.answers[id];
    if (!isRecord(raw) || !isFiniteNumber(raw.score) || !isFiniteNumber(raw.confidence)) {
      throw new JevError("invalid_response", `Jev answer for "${id}" is missing or malformed.`);
    }
    answers[id] = { score: raw.score, confidence: raw.confidence };
  }

  return answers;
}
