import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  failRecommendationRun,
  publishRecommendationRun,
  reserveRecommendationRun,
} from "./persistence";
import type { Recommendation } from "./recommend";
import type { SeekerState } from "./seeker-state";

type DbResult = { data: unknown; error: unknown };

const { mockCreateServiceClient, mockFrom, mockRpc, calls } = vi.hoisted(
  () => ({
    mockCreateServiceClient: vi.fn(),
    mockFrom: vi.fn(),
    mockRpc: vi.fn(),
    calls: [] as { method: string; args: unknown[] }[],
  }),
);

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockCreateServiceClient,
}));

/** A fake query builder: records each call and resolves to `result`. */
function fakeQuery(result: DbResult) {
  const builder: Record<string, unknown> = {};

  for (const method of ["insert", "update", "select", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }

  builder.single = () => Promise.resolve(result);
  builder.maybeSingle = () => Promise.resolve(result);
  return builder;
}

const RUN_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHECKED_AT = "2026-11-25T12:00:00.000Z";

const seeker = {
  skills: ["Java", "SQL"],
  desired_role: "Backend Developer",
} as unknown as SeekerState;

function makeJob(id: string) {
  return {
    id,
    title: "Java Intern",
    firm_name: "Example Company",
    location: "Montréal",
    work_mode: "Hybrid",
    employment_type: "Internship",
    required_skills: "Java",
    salary: 50000,
    experience: 1,
    description: "Build Java services.",
    status: "open",
    created_at: "2026-11-14T10:00:00Z",
  };
}

function makeRecommendation(
  id: string,
  overrides: Partial<Recommendation> = {},
): Recommendation {
  return {
    job: makeJob(id),
    score: 80,
    match_score: 75,
    fit: null,
    skill_match: null,
    reasons: ["You have relevant Java skills"],
    summary: null,
    fit_error: "timeout",
    fit_generated_at: null,
    ...overrides,
  } as unknown as Recommendation;
}

const validInputs = {
  success: true,
  user_id: USER_ID,
  considered_jobs: 12,
  seeker_state: seeker,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  mockCreateServiceClient.mockReturnValue({ from: mockFrom, rpc: mockRpc });
});

describe("reserveRecommendationRun", () => {
  it("inserts a running run for the user and returns its id", async () => {
    mockFrom.mockReturnValue(
      fakeQuery({ data: { id: RUN_ID }, error: null }),
    );

    expect(await reserveRecommendationRun(validInputs)).toBe(RUN_ID);

    expect(mockFrom).toHaveBeenCalledWith("recommendation_runs");
    const row = calls.find((call) => call.method === "insert")
      ?.args[0] as Record<string, unknown>;
    expect(row).toMatchObject({
      user_id: USER_ID,
      status: "running",
      considered_jobs: 12,
    });
    expect(row.seeker_input_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(Date.parse(row.started_at as string)).not.toBeNaN();
    // Version columns let a later run know which scoring and prompts produced it.
    expect(row).toHaveProperty("scoring_version");
    expect(row).toHaveProperty("jev_model_version");
    expect(row).toHaveProperty("summary_prompt_version");
  });

  it("does not store the seeker's profile text in the run row", async () => {
    mockFrom.mockReturnValue(
      fakeQuery({ data: { id: RUN_ID }, error: null }),
    );

    await reserveRecommendationRun(validInputs);

    const row = calls.find((call) => call.method === "insert")?.args[0];
    expect(JSON.stringify(row)).not.toContain("Backend Developer");
  });

  it("throws when the database returns an error", async () => {
    mockFrom.mockReturnValue(
      fakeQuery({ data: null, error: { message: "boom" } }),
    );

    await expect(reserveRecommendationRun(validInputs)).rejects.toThrow(
      "Unable to reserve recommendation run",
    );
  });

  it("throws when no id comes back", async () => {
    mockFrom.mockReturnValue(fakeQuery({ data: {}, error: null }));

    await expect(reserveRecommendationRun(validInputs)).rejects.toThrow(
      "Unable to reserve recommendation run",
    );
  });

  it("throws when the service client is not configured", async () => {
    mockCreateServiceClient.mockImplementation(() => {
      throw new Error("Recommendation persistence is not configured");
    });

    await expect(reserveRecommendationRun(validInputs)).rejects.toThrow(
      "not configured",
    );
  });
});

describe("publishRecommendationRun", () => {
  it("publishes ranked results in one database function call", async () => {
    mockRpc.mockResolvedValue({ data: RUN_ID, error: null });
    const first = makeRecommendation("job-1", { score: 90, summary: "Good fit." });
    const second = makeRecommendation("job-2", { score: 70 });

    await publishRecommendationRun(
      RUN_ID,
      seeker,
      [first, second],
      CHECKED_AT,
    );

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [name, args] = mockRpc.mock.calls[0];
    expect(name).toBe("publish_recommendation_run");
    expect(args.p_run_id).toBe(RUN_ID);
    expect(args.p_results).toHaveLength(2);
    expect(args.p_results[0]).toMatchObject({
      job_id: "job-1",
      rank: 1,
      score: 90,
      match_score: 75,
      summary: "Good fit.",
      fit_error: "timeout",
      reasons: ["You have relevant Java skills"],
      job_input_checked_at: CHECKED_AT,
    });
    expect(args.p_results[1]).toMatchObject({ job_id: "job-2", rank: 2 });
  });

  it("hashes the seeker and each job so unchanged inputs can be reused", async () => {
    mockRpc.mockResolvedValue({ data: RUN_ID, error: null });

    await publishRecommendationRun(
      RUN_ID,
      seeker,
      [makeRecommendation("job-1"), makeRecommendation("job-2")],
      CHECKED_AT,
    );

    const results = mockRpc.mock.calls[0][1].p_results as {
      seeker_input_hash: string;
      job_input_hash: string;
    }[];
    expect(results[0].seeker_input_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(results[0].job_input_hash).toMatch(/^[0-9a-f]{64}$/);
    // The same seeker gives the same hash on every row.
    expect(results[1].seeker_input_hash).toBe(results[0].seeker_input_hash);
  });

  it("publishes an empty result set", async () => {
    mockRpc.mockResolvedValue({ data: RUN_ID, error: null });

    await expect(
      publishRecommendationRun(RUN_ID, seeker, [], CHECKED_AT),
    ).resolves.toBeUndefined();
    expect(mockRpc.mock.calls[0][1].p_results).toEqual([]);
  });

  it("throws when the database function returns an error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(
      publishRecommendationRun(RUN_ID, seeker, [], CHECKED_AT),
    ).rejects.toThrow("Unable to publish recommendation run");
  });

  it("throws when the function confirms a different run id", async () => {
    mockRpc.mockResolvedValue({
      data: "99999999-9999-4999-8999-999999999999",
      error: null,
    });

    await expect(
      publishRecommendationRun(RUN_ID, seeker, [], CHECKED_AT),
    ).rejects.toThrow("Unable to publish recommendation run");
  });
});

describe("failRecommendationRun", () => {
  it("marks only a running run as failed", async () => {
    mockFrom.mockReturnValue(
      fakeQuery({ data: { id: RUN_ID }, error: null }),
    );

    await failRecommendationRun(RUN_ID, "generation_failed");

    expect(mockFrom).toHaveBeenCalledWith("recommendation_runs");
    const update = calls.find((call) => call.method === "update")
      ?.args[0] as Record<string, unknown>;
    expect(update).toMatchObject({
      status: "failed",
      failure_code: "generation_failed",
    });
    expect(Date.parse(update.completed_at as string)).not.toBeNaN();
    expect(
      calls.filter((call) => call.method === "eq").map((call) => call.args),
    ).toEqual([
      ["id", RUN_ID],
      ["status", "running"],
    ]);
  });

  it("records a publication failure code", async () => {
    mockFrom.mockReturnValue(
      fakeQuery({ data: { id: RUN_ID }, error: null }),
    );

    await failRecommendationRun(RUN_ID, "publication_failed");

    expect(calls.find((call) => call.method === "update")?.args[0]).toMatchObject(
      { failure_code: "publication_failed" },
    );
  });

  it("throws when the run was not running any more", async () => {
    mockFrom.mockReturnValue(fakeQuery({ data: null, error: null }));

    await expect(
      failRecommendationRun(RUN_ID, "generation_failed"),
    ).rejects.toThrow("Unable to mark recommendation run failed");
  });

  it("throws when the database returns an error", async () => {
    mockFrom.mockReturnValue(
      fakeQuery({ data: null, error: { message: "boom" } }),
    );

    await expect(
      failRecommendationRun(RUN_ID, "publication_failed"),
    ).rejects.toThrow("Unable to mark recommendation run failed");
  });
});
