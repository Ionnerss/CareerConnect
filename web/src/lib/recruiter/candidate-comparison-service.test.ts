import { beforeEach, describe, expect, it, vi } from "vitest";
import { JevError } from "@/lib/ai/jev";
import { hashRequirements, type AskJev } from "./candidate-comparison";
import {
  AI_NOT_CONFIGURED_ERROR,
  AUTH_ERROR,
  JOB_NOT_FOUND_ERROR,
  NOT_RECRUITER_ERROR,
  NO_REQUIREMENTS_ERROR,
  compareJobCandidates,
  getJobRequirements,
  saveJobRequirements,
} from "./candidate-comparison-service";

type Result = { data: unknown; error: unknown };

const { mockGetUser, mockFrom, calls, results } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  calls: [] as { table: string; method: string; args: unknown[] }[],
  results: {} as Record<string, Result[]>,
}));

/** A fake query builder: every method records its call and returns itself; awaiting it returns the next queued result. */
function fakeQuery(table: string) {
  const next = () => Promise.resolve(results[table]?.shift() ?? { data: null, error: null });
  const builder: Record<string, unknown> = {
    then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      next().then(resolve, reject),
  };
  for (const method of ["select", "eq", "order", "in", "insert", "delete", "upsert"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return builder;
    };
  }
  builder.maybeSingle = () => next();
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

const RECRUITER_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const APP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date("2026-10-18T12:00:00Z");

const requirementRows = [
  { id: "req-1", text: "2+ years of React", kind: "core", weight: 8 },
  { id: "req-2", text: "TypeScript experience", kind: "nice", weight: 3 },
];
const requirementsHash = hashRequirements(requirementRows as never);

function signedInAs(role: string | null, ownsJob = true) {
  mockGetUser.mockResolvedValueOnce({ data: { user: { id: RECRUITER_ID } }, error: null });
  results.profiles = [{ data: role ? { role } : null, error: null }];
  results.job = [{ data: ownsJob ? { id: JOB_ID } : null, error: null }];
}

function applicationRows() {
  return [
    {
      id: APP_A,
      applicant_id: "applicant-a",
      created_at: "2026-10-01",
      profiles: { full_name: "Alice Applicant", contact_email: "alice@example.com" },
    },
    {
      id: APP_B,
      applicant_id: "applicant-b",
      created_at: "2026-10-02",
      profiles: [{ full_name: "Bob Builder", contact_email: "bob@example.com" }],
    },
  ];
}

/** Queue everything a normal comparison of two applicants reads. */
function queueComparisonData() {
  results.job_requirements = [{ data: requirementRows, error: null }];
  results.applications = [{ data: applicationRows(), error: null }];
  results.candidate_evaluations = [{ data: [], error: null }];
  results.profile_skills = [
    {
      data: [
        { profile_id: "applicant-a", name: "React", proficiency: "Advanced" },
        { profile_id: "applicant-b", name: "Go", proficiency: "Beginner" },
      ],
      error: null,
    },
  ];
  results.profile_education = [
    {
      data: [
        {
          profile_id: "applicant-a",
          school: "Concordia University",
          degree: "BEng",
          field_of_study: "Software Engineering",
          start_date: "2022-09-01",
          end_date: null,
          description: null,
        },
      ],
      error: null,
    },
  ];
  results.profile_experience = [
    {
      data: [
        {
          profile_id: "applicant-a",
          company_name: "Acme Corp",
          job_role: "Frontend Developer",
          start_date: "2023-01-01",
          end_date: "2025-01-01",
          description: null,
        },
      ],
      error: null,
    },
  ];
  results.candidate_evaluations.push({ data: null, error: null }); // result of the upsert
}

/** Alice (React) looks strong, everyone else weak. */
function fakeAsk() {
  return vi.fn<AskJev>(async (state) => {
    const skills = (state as { skills: { name: string }[] }).skills;
    const strong = skills[0]?.name === "React";
    return {
      r1: { score: strong ? 3 : 1, confidence: 0.9 },
      r2: { score: strong ? 3 : 1, confidence: 0.8 },
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  mockFrom.mockImplementation((table: string) => fakeQuery(table));
});

describe("compareJobCandidates - access", () => {
  it("asks the user to sign in when there is no session", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    expect(await compareJobCandidates(JOB_ID)).toEqual({
      success: false,
      code: "UNAUTHENTICATED",
      error: AUTH_ERROR,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("blocks users who are not recruiters", async () => {
    signedInAs("job_seeker");

    expect(await compareJobCandidates(JOB_ID)).toEqual({
      success: false,
      code: "FORBIDDEN",
      error: NOT_RECRUITER_ERROR,
    });
    expect(mockFrom).not.toHaveBeenCalledWith("job");
    expect(mockFrom).not.toHaveBeenCalledWith("applications");
  });

  it("does not let a recruiter compare someone else's posting", async () => {
    signedInAs("recruiter", false);

    expect(await compareJobCandidates(JOB_ID)).toEqual({
      success: false,
      code: "JOB_NOT_FOUND",
      error: JOB_NOT_FOUND_ERROR,
    });
    expect(
      calls.some(
        (c) => c.table === "job" && c.method === "eq" && c.args[0] === "recruiter_id" && c.args[1] === RECRUITER_ID,
      ),
    ).toBe(true);
    expect(mockFrom).not.toHaveBeenCalledWith("applications");
    expect(mockFrom).not.toHaveBeenCalledWith("candidate_evaluations");
  });

  it("treats an id that is not a uuid as a missing posting without touching the database", async () => {
    expect(await compareJobCandidates("not-a-uuid")).toMatchObject({
      success: false,
      code: "JOB_NOT_FOUND",
    });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("rejects options that are out of range", async () => {
    expect(await compareJobCandidates(JOB_ID, { limit: 500 })).toMatchObject({
      success: false,
      code: "INVALID_INPUT",
    });
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});

describe("compareJobCandidates - comparison", () => {
  it("asks for requirements first when none are saved", async () => {
    signedInAs("recruiter");
    results.job_requirements = [{ data: [], error: null }];

    expect(await compareJobCandidates(JOB_ID)).toEqual({
      success: false,
      code: "NO_REQUIREMENTS",
      error: NO_REQUIREMENTS_ERROR,
    });
    expect(mockFrom).not.toHaveBeenCalledWith("applications");
  });

  it("returns an empty comparison when nobody has applied", async () => {
    signedInAs("recruiter");
    results.job_requirements = [{ data: requirementRows, error: null }];
    results.applications = [{ data: [], error: null }];
    const ask = fakeAsk();

    expect(await compareJobCandidates(JOB_ID, {}, { ask })).toMatchObject({
      success: true,
      ranked: [],
      failed: [],
      total_applicants: 0,
    });
    expect(ask).not.toHaveBeenCalled();
  });

  it("ranks the best candidate first, shows names to the recruiter and saves the results", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    // Put the weaker applicant first to prove ranking, not application order, decides.
    results.applications = [{ data: applicationRows().reverse(), error: null }];
    const ask = fakeAsk();

    const response = await compareJobCandidates(JOB_ID, {}, { ask, now: NOW });

    expect(response).toMatchObject({ success: true, total_applicants: 2, compared_count: 2, saved: true });
    if (!response.success) throw new Error("expected success");

    expect(response.ranked.map((c) => c.full_name)).toEqual(["Alice Applicant", "Bob Builder"]);
    expect(response.ranked[0]).toMatchObject({
      application_id: APP_A,
      score: 100,
      needs_human_review: false,
      cached: false,
    });
    expect(response.ranked[0].results).toEqual([
      { requirement_id: "req-1", score: 3, confidence: 0.9 },
      { requirement_id: "req-2", score: 3, confidence: 0.8 },
    ]);
    expect(response.ranked[1].score).toBe(33);
    expect(response.failed).toEqual([]);

    const upsert = calls.find((c) => c.method === "upsert");
    expect(upsert?.table).toBe("candidate_evaluations");
    expect(upsert?.args[1]).toEqual({ onConflict: "application_id" });
    const rows = upsert?.args[0] as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ requirements_hash: requirementsHash, needs_review: false });
  });

  it("never sends names or emails to the model", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    const ask = fakeAsk();

    await compareJobCandidates(JOB_ID, {}, { ask, now: NOW });

    expect(ask).toHaveBeenCalledTimes(2);
    const sent = JSON.stringify(ask.mock.calls);
    for (const secret of ["Alice", "Bob", "alice@example.com", "bob@example.com"]) {
      expect(sent).not.toContain(secret);
    }
    // Company and school names are included by default.
    expect(sent).toContain("Acme Corp");
    expect(sent).toContain("Concordia University");
  });

  it("can leave company and school names out for blind screening", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    const ask = fakeAsk();

    await compareJobCandidates(JOB_ID, { includeOrganizations: false }, { ask, now: NOW });

    const sent = JSON.stringify(ask.mock.calls);
    expect(sent).not.toContain("Acme Corp");
    expect(sent).not.toContain("Concordia University");
    expect(sent).toContain("Frontend Developer");
  });

  it("flags low-confidence candidates for human review", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    const ask = vi.fn<AskJev>(async () => ({
      r1: { score: 2, confidence: 0.37 },
      r2: { score: 2, confidence: 0.9 },
    }));

    const response = await compareJobCandidates(JOB_ID, {}, { ask, now: NOW });

    if (!response.success) throw new Error("expected success");
    expect(response.ranked.every((c) => c.needs_human_review && c.min_confidence === 0.37)).toBe(true);
  });

  it("only looks at the oldest applications up to the limit", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    const ask = fakeAsk();

    const response = await compareJobCandidates(JOB_ID, { limit: 1 }, { ask, now: NOW });

    if (!response.success) throw new Error("expected success");
    expect(response).toMatchObject({ total_applicants: 2, compared_count: 1 });
    expect(response.ranked.map((c) => c.application_id)).toEqual([APP_A]);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("keeps going when one candidate fails", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    const ask = vi.fn<AskJev>(async (state) => {
      const skills = (state as { skills: { name: string }[] }).skills;
      if (skills[0]?.name === "Go") throw new JevError("http_error", "Jev returned HTTP 500.", 500);
      return { r1: { score: 3, confidence: 0.9 }, r2: { score: 3, confidence: 0.9 } };
    });

    const response = await compareJobCandidates(JOB_ID, {}, { ask, now: NOW });

    if (!response.success) throw new Error("expected success");
    expect(response.ranked.map((c) => c.application_id)).toEqual([APP_A]);
    expect(response.failed).toEqual([
      { application_id: APP_B, full_name: "Bob Builder", code: "http_error", message: "Jev returned HTTP 500." },
    ]);
    // Only the candidate that succeeded is saved.
    const rows = calls.find((c) => c.method === "upsert")?.args[0] as unknown[];
    expect(rows).toHaveLength(1);
  });

  it("reports a missing API key as a setup problem without saving anything", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    const ask = vi.fn<AskJev>(async () => {
      throw new JevError("missing_key", "AI_GATEWAY_API_KEY is not set.");
    });

    const response = await compareJobCandidates(JOB_ID, {}, { ask, now: NOW });

    expect(response).toEqual({
      success: false,
      code: "AI_NOT_CONFIGURED",
      error: AI_NOT_CONFIGURED_ERROR,
    });
    expect(JSON.stringify(response)).not.toContain("AI_GATEWAY_API_KEY");
    expect(calls.some((c) => c.method === "upsert")).toBe(false);
  });

  it("still returns the results when saving them fails", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    results.candidate_evaluations[1] = { data: null, error: { message: "boom" } };

    const response = await compareJobCandidates(JOB_ID, {}, { ask: fakeAsk(), now: NOW });

    expect(response).toMatchObject({ success: true, saved: false });
    if (response.success) expect(response.ranked).toHaveLength(2);
  });
});

describe("compareJobCandidates - stored results", () => {
  function storedRow(applicationId: string, hash: string, score = 77) {
    return {
      application_id: applicationId,
      answers: [
        { requirementId: "req-1", score: 2, confidence: 0.7 },
        { requirementId: "req-2", score: 1, confidence: 0.6 },
      ],
      score,
      confidence: "0.6",
      needs_review: false,
      requirements_hash: hash,
    };
  }

  it("reuses a stored result while the requirements are unchanged", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    results.candidate_evaluations = [{ data: [storedRow(APP_A, requirementsHash), storedRow(APP_B, requirementsHash, 55)], error: null }];
    const ask = fakeAsk();

    const response = await compareJobCandidates(JOB_ID, {}, { ask, now: NOW });

    if (!response.success) throw new Error("expected success");
    expect(ask).not.toHaveBeenCalled();
    expect(response.ranked.map((c) => [c.application_id, c.score, c.cached])).toEqual([
      [APP_A, 77, true],
      [APP_B, 55, true],
    ]);
    expect(response.ranked[0].min_confidence).toBe(0.6);
    expect(mockFrom).not.toHaveBeenCalledWith("profile_skills");
    expect(calls.some((c) => c.method === "upsert")).toBe(false);
  });

  it("scores again when the requirements changed since the result was saved", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    results.candidate_evaluations = [
      { data: [storedRow(APP_A, "an-older-hash"), storedRow(APP_B, requirementsHash, 55)], error: null },
      { data: null, error: null },
    ];
    const ask = fakeAsk();

    const response = await compareJobCandidates(JOB_ID, {}, { ask, now: NOW });

    if (!response.success) throw new Error("expected success");
    expect(ask).toHaveBeenCalledTimes(1); // only Alice
    expect(response.ranked.find((c) => c.application_id === APP_A)).toMatchObject({ score: 100, cached: false });
    expect(response.ranked.find((c) => c.application_id === APP_B)).toMatchObject({ score: 55, cached: true });
  });

  it("ignores a stored result with a damaged answers column", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    results.candidate_evaluations = [
      { data: [{ ...storedRow(APP_A, requirementsHash), answers: { oops: true } }], error: null },
      { data: null, error: null },
    ];
    const ask = fakeAsk();

    await compareJobCandidates(JOB_ID, {}, { ask, now: NOW });

    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("asks the model again for everyone when refresh is set", async () => {
    signedInAs("recruiter");
    queueComparisonData();
    results.candidate_evaluations = [{ data: null, error: null }]; // the upsert only
    const ask = fakeAsk();

    await compareJobCandidates(JOB_ID, { refresh: true }, { ask, now: NOW });

    expect(ask).toHaveBeenCalledTimes(2);
    expect(calls.some((c) => c.table === "candidate_evaluations" && c.method === "select")).toBe(false);
  });
});

describe("requirements", () => {
  it("lists the requirements of the recruiter's own posting", async () => {
    signedInAs("recruiter");
    results.job_requirements = [{ data: requirementRows, error: null }];

    expect(await getJobRequirements(JOB_ID)).toEqual({ success: true, requirements: requirementRows });
  });

  it("rejects invalid requirements before touching the database", async () => {
    expect(await saveJobRequirements(JOB_ID, [])).toMatchObject({ success: false, code: "INVALID_INPUT" });
    expect(await saveJobRequirements(JOB_ID, [{ text: "   ", weight: 5 }])).toMatchObject({ code: "INVALID_INPUT" });
    expect(await saveJobRequirements(JOB_ID, [{ text: "React", weight: 11 }])).toMatchObject({ code: "INVALID_INPUT" });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("does not save for someone else's posting", async () => {
    signedInAs("recruiter", false);

    expect(await saveJobRequirements(JOB_ID, [{ text: "React", weight: 5 }])).toMatchObject({
      success: false,
      code: "JOB_NOT_FOUND",
    });
    expect(calls.some((c) => c.method === "insert")).toBe(false);
  });

  it("adds the new requirements first, then removes the old ones", async () => {
    signedInAs("recruiter");
    results.job_requirements = [
      { data: [{ id: "old-1" }, { id: "old-2" }], error: null },
      { data: [{ id: "new-1", text: "React", kind: "core", weight: 8 }], error: null },
      { data: null, error: null },
    ];

    const response = await saveJobRequirements(JOB_ID, [{ text: "  React  ", kind: "core", weight: 8 }]);

    expect(response).toEqual({
      success: true,
      requirements: [{ id: "new-1", text: "React", kind: "core", weight: 8 }],
    });
    const methods = calls.filter((c) => c.table === "job_requirements").map((c) => c.method);
    expect(methods.indexOf("insert")).toBeLessThan(methods.indexOf("delete"));
    expect(calls.find((c) => c.method === "insert")?.args[0]).toEqual([
      { posting_id: JOB_ID, text: "React", kind: "core", weight: 8 },
    ]);
    expect(calls.find((c) => c.method === "in" && c.args[0] === "id")?.args[1]).toEqual(["old-1", "old-2"]);
  });

  it("keeps the old requirements when adding the new ones fails", async () => {
    signedInAs("recruiter");
    results.job_requirements = [
      { data: [{ id: "old-1" }], error: null },
      { data: null, error: { message: "boom" } },
    ];

    expect(await saveJobRequirements(JOB_ID, [{ text: "React", weight: 8 }])).toMatchObject({
      success: false,
      code: "BACKEND_ERROR",
    });
    expect(calls.some((c) => c.method === "delete")).toBe(false);
  });
});
