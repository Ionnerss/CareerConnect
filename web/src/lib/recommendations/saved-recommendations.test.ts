import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSavedRecommendations,
} from "./saved-recommendations";

type QueryResult = {
  data: unknown;
  error: unknown;
};

const {
  mockGetUser,
  mockMfa,
  mockFrom,
  calls,
  results,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockMfa: vi.fn(),
  mockFrom: vi.fn(),
  calls: [] as {
    table: string;
    method: string;
    args: unknown[];
  }[],
  results: {} as Record<string, QueryResult[]>,
}));

function fakeQuery(table: string) {
  const next = () =>
    Promise.resolve(
      results[table]?.shift() ?? { data: null, error: null },
    );

  const builder: Record<string, unknown> = {
    then: (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) => next().then(resolve, reject),
  };

  for (const method of [
    "select",
    "eq",
    "in",
    "order",
    "limit",
  ]) {
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

vi.mock("@/lib/auth/require-mfa", () => ({
  checkMfaForClient: mockMfa,
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";

const run = {
  id: RUN_ID,
  created_at: "2026-11-15T10:00:00Z",
  completed_at: "2026-11-15T10:01:00Z",
  result_count: 1,
  summary_count: 0,
  ranking_mode: "code_only",
};

const openJob = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "Java Intern",
  firm_name: "Example Company",
  location: "Montréal",
  work_mode: "Hybrid",
  employment_type: "Internship",
  required_skills: "Java",
  salary: "50000",
  experience: 1,
  description: "Build Java services.",
  status: "open",
  created_at: "2026-11-14T10:00:00Z",
};

const savedResult = {
  job_id: openJob.id,
  rank: 1,
  score: 75,
  match_score: 75,
  fit: null,
  fit_error: "timeout",
  fit_generated_at: null,
  skill_match: null,
  reasons: ["You have relevant Java skills"],
  summary: null,
};

function queue(overrides: Record<string, QueryResult[]> = {}) {
  results.profiles = [
    { data: { role: "job_seeker" }, error: null },
  ];
  results.recommendation_runs = [
    { data: run, error: null },
  ];
  results.recommendation_results = [
    { data: [savedResult], error: null },
  ];
  results.job = [
    { data: [openJob], error: null },
  ];
  Object.assign(results, overrides);
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];

  mockFrom.mockImplementation((table: string) => fakeQuery(table));
  mockGetUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });
  mockMfa.mockResolvedValue(null);
  queue();
});

describe("getSavedRecommendations", () => {
  it("distinguishes no successful run from an empty successful run", async () => {
    queue({
      recommendation_runs: [{ data: null, error: null }],
    });

    expect(await getSavedRecommendations()).toEqual({
      success: true,
      run: null,
      recommendations: [],
    });
    expect(mockFrom).not.toHaveBeenCalledWith(
      "recommendation_results",
    );
  });

  it("returns a successful empty run without using an older one", async () => {
    queue({
      recommendation_runs: [
        {
          data: {
            ...run,
            result_count: 0,
            ranking_mode: null,
          },
          error: null,
        },
      ],
      recommendation_results: [
        { data: [], error: null },
      ],
    });

    const response = await getSavedRecommendations();

    expect(response).toMatchObject({
      success: true,
      run: { id: RUN_ID, result_count: 0 },
      recommendations: [],
    });
    expect(mockFrom).not.toHaveBeenCalledWith("job");
    expect(
      calls.filter(
        (call) =>
          call.table === "recommendation_runs" &&
          call.method === "limit",
      ),
    ).toEqual([
      {
        table: "recommendation_runs",
        method: "limit",
        args: [1],
      },
    ]);
  });

  it("selects successful runs, so pending or failed refreshes do not hide the previous success", async () => {
    const response = await getSavedRecommendations();

    expect(response.success).toBe(true);
    if (!response.success) return;

    expect(response.run?.id).toBe(RUN_ID);
    expect(response.recommendations).toHaveLength(1);
    expect(response.recommendations[0].job.salary).toBe(50000);
    expect(
      calls.find(
        (call) =>
          call.table === "recommendation_runs" &&
          call.method === "eq" &&
          call.args[0] === "status",
      )?.args,
    ).toEqual(["status", "succeeded"]);
    expect(
      calls.find(
        (call) =>
          call.table === "recommendation_runs" &&
          call.method === "eq" &&
          call.args[0] === "user_id",
      )?.args,
    ).toEqual(["user_id", USER_ID]);
  });

  it("does not display a job closed after publication", async () => {
    queue({
      job: [{ data: [], error: null }],
    });

    const response = await getSavedRecommendations();

    expect(response).toMatchObject({
      success: true,
      run: { id: RUN_ID, result_count: 1 },
      recommendations: [],
    });
    expect(
      calls.find(
        (call) =>
          call.table === "job" &&
          call.method === "eq",
      )?.args,
    ).toEqual(["status", "open"]);
  });

  it("refuses to read before MFA is completed", async () => {
    mockMfa.mockResolvedValue("MFA_REQUIRED");

    expect(await getSavedRecommendations()).toMatchObject({
      success: false,
      code: "MFA_REQUIRED",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("does not read another person's data when signed out", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    expect(await getSavedRecommendations()).toMatchObject({
      success: false,
      code: "UNAUTHENTICATED",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});