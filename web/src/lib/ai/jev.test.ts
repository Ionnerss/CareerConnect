import { afterEach, describe, expect, it, vi } from "vitest";
import {
  askJevScores,
  JEV_ENDPOINT,
  JEV_MODEL,
  JevError,
  type JevScoreQuestion,
} from "./jev";

const KEY = "test-key-123";

const questions: Record<string, JevScoreQuestion> = {
  r1: { type: "score", instructions: "Rate React experience.", criteria: ["None", "Some", "Strong"] },
  r2: { type: "score", instructions: "Rate TypeScript experience.", criteria: ["None", "Some", "Strong"] },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function okFetch(answers: unknown) {
  return vi.fn(async () => jsonResponse({ model: JEV_MODEL, answers, usage: {} }));
}

async function catchJevError(promise: Promise<unknown>): Promise<JevError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(JevError);
    return error as JevError;
  }
  throw new Error("Expected askJevScores to throw");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("askJevScores", () => {
  it("returns score and confidence for every question", async () => {
    const fetchImpl = okFetch({
      r1: { score: 2, confidence: 0.9, extra: "ignored" },
      r2: { score: 0.5, confidence: 0.4 },
    });

    const result = await askJevScores({ profile: "text" }, questions, { apiKey: KEY, fetchImpl });

    expect(result).toEqual({
      r1: { score: 2, confidence: 0.9 },
      r2: { score: 0.5, confidence: 0.4 },
    });
  });

  it("sends the model, state and questions with a bearer key", async () => {
    const fetchImpl = okFetch({
      r1: { score: 1, confidence: 0.8 },
      r2: { score: 1, confidence: 0.8 },
    });

    await askJevScores({ profile: "text" }, questions, { apiKey: KEY, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(JEV_ENDPOINT);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(init.body as string)).toEqual({
      model: JEV_MODEL,
      state: { profile: "text" },
      questions,
    });
  });

  it("reads the key from AI_GATEWAY_API_KEY when none is passed", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "env-key");
    const fetchImpl = okFetch({
      r1: { score: 1, confidence: 0.8 },
      r2: { score: 1, confidence: 0.8 },
    });

    await askJevScores({}, questions, { fetchImpl });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer env-key");
  });

  it("fails with missing_key and never calls the network when there is no key", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    const fetchImpl = vi.fn();

    const error = await catchJevError(askJevScores({}, questions, { fetchImpl }));

    expect(error.code).toBe("missing_key");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an empty question set without calling the network", async () => {
    const fetchImpl = vi.fn();

    const error = await catchJevError(askJevScores({}, {}, { apiKey: KEY, fetchImpl }));

    expect(error.code).toBe("invalid_response");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([401, 429, 500])("turns HTTP %i into an http_error with the status", async (status) => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "nope" }, status));

    const error = await catchJevError(askJevScores({}, questions, { apiKey: KEY, fetchImpl }));

    expect(error.code).toBe("http_error");
    expect(error.status).toBe(status);
  });

  it("maps a timeout to a timeout error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    });

    const error = await catchJevError(askJevScores({}, questions, { apiKey: KEY, fetchImpl }));

    expect(error.code).toBe("timeout");
  });

  it("maps any other fetch failure to a network error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const error = await catchJevError(askJevScores({}, questions, { apiKey: KEY, fetchImpl }));

    expect(error.code).toBe("network");
  });

  it("rejects a response that is not JSON", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>oops</html>", { status: 200 }));

    const error = await catchJevError(askJevScores({}, questions, { apiKey: KEY, fetchImpl }));

    expect(error.code).toBe("invalid_response");
  });

  it.each([
    ["no answers field", { model: JEV_MODEL }],
    ["answers is not an object", { answers: [] }],
  ])("rejects a response with %s", async (_label, body) => {
    const fetchImpl = vi.fn(async () => jsonResponse(body));

    const error = await catchJevError(askJevScores({}, questions, { apiKey: KEY, fetchImpl }));

    expect(error.code).toBe("invalid_response");
  });

  it.each([
    ["a question is missing", { r1: { score: 1, confidence: 0.8 } }],
    ["a score is not a number", { r1: { score: "high", confidence: 0.8 }, r2: { score: 1, confidence: 0.8 } }],
    ["a confidence is missing", { r1: { score: 1 }, r2: { score: 1, confidence: 0.8 } }],
    ["a value is not finite", { r1: { score: null, confidence: 0.8 }, r2: { score: 1, confidence: 0.8 } }],
  ])("rejects an answer set where %s", async (_label, answers) => {
    const error = await catchJevError(
      askJevScores({}, questions, { apiKey: KEY, fetchImpl: okFetch(answers) }),
    );

    expect(error.code).toBe("invalid_response");
  });

  it("never puts the API key in an error message", async () => {
    const failures = [
      vi.fn(async () => jsonResponse({}, 500)),
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
      vi.fn(async () => jsonResponse({ answers: {} })),
    ];

    for (const fetchImpl of failures) {
      const error = await catchJevError(askJevScores({}, questions, { apiKey: KEY, fetchImpl }));
      expect(error.message).not.toContain(KEY);
    }
  });
});
