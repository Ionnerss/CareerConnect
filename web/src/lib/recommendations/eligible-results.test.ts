import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Recommendation } from "./recommend";
import { filterEligibleResults } from "./eligible-results";

type QueryResult = {
  data: unknown;
  error: unknown;
};

const { mockGetUser, mockFrom, calls, results } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  calls: [] as {
    table: string;
    method: string;
    args: unknown[];
  }[],
  results: {} as Record<string, QueryResult>,
}));

function fakeQuery(table: string) {
  const builder: Record<string, unknown> = {
    then: (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) =>
      Promise.resolve(
        results[table] ?? { data: null, error: null },
      ).then(resolve, reject),
  };

  for (const method of ["select", "in", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return builder;
    };
  }

  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FIRST_JOB_ID = "22222222-2222-4222-8222-222222222222";
const SECOND_JOB_ID = "33333333-3333-4333-8333-333333333333";

function recommendation(id: string): Recommendation {
  return {
    job: {
      id,
      title: `Job ${id}`,
      firm_name: "Example Company",
      location: "Montréal",
      work_mode: "Hybrid",
      employment_type: "Internship",
      required_skills: "Java",
      salary: null,
      experience: null,
      description: null,
      status: "open",
      created_at: "2026-11-15T10:00:00Z",
    },
    score: 75,
    match_score: 75,
    fit: null,
    fit_error: null,
    fit_generated_at: null,
    skill_match: null,
    reasons: ["Relevant skills"],
    summary: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;

  for (const table of Object.keys(results)) {
    delete results[table];
  }

  mockFrom.mockImplementation((table: string) => fakeQuery(table));
  mockGetUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });

  results.job = {
    data: [{ id: FIRST_JOB_ID }, { id: SECOND_JOB_ID }],
    error: null,
  };
  results.applications = {
    data: [],
    error: null,
  };
});

describe("filterEligibleResults", () => {
  it("excludes the seeker's applied job while preserving the other result", async () => {
    const first = recommendation(FIRST_JOB_ID);
    const second = recommendation(SECOND_JOB_ID);

    results.applications = {
      data: [{ job_id: FIRST_JOB_ID }],
      error: null,
    };

    const filtered = await filterEligibleResults(USER_ID, [first, second]);

    expect(filtered).toEqual([second]);

    expect(
      calls.find(
        (call) =>
          call.table === "applications" &&
          call.method === "eq",
      )?.args,
    ).toEqual(["applicant_id", USER_ID]);

    expect(
      calls.find(
        (call) =>
          call.table === "applications" &&
          call.method === "in",
      )?.args,
    ).toEqual(["job_id", [FIRST_JOB_ID, SECOND_JOB_ID]]);

    expect(
      calls.find(
        (call) =>
          call.table === "job" &&
          call.method === "eq",
      )?.args,
    ).toEqual(["status", "open"]);
  });

  it.each(["job", "applications"] as const)(
    "fails when the %s eligibility query fails",
    async (table) => {
      results[table] = {
        data: null,
        error: { message: "Database unavailable" },
      };

      await expect(
        filterEligibleResults(USER_ID, [
          recommendation(FIRST_JOB_ID),
        ]),
      ).rejects.toThrow(
        "Unable to recheck recommendation eligibility",
      );
    },
  );

  it("rejects a different authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "44444444-4444-4444-8444-444444444444",
        },
      },
      error: null,
    });

    await expect(
      filterEligibleResults(USER_ID, [
        recommendation(FIRST_JOB_ID),
      ]),
    ).rejects.toThrow("Unable to verify recommendation owner");

    expect(mockFrom).not.toHaveBeenCalled();
  });
});