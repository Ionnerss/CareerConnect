import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSeekerState } from "./seeker-state";
import { getWorkerRecommendationInputs } from "./worker-inputs";

const { mockService, mockFrom, mockLoad, results, filters } = vi.hoisted(
  () => ({
    mockService: vi.fn(),
    mockFrom: vi.fn(),
    mockLoad: vi.fn(),
    results: {} as Record<
      string,
      { data: unknown; error: unknown }[]
    >,
    filters: [] as {
      table: string;
      column: string;
      value: unknown;
    }[],
  }),
);

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockService,
}));

vi.mock("./recommendation-inputs", () => ({
  loadRecommendationInputsForUser: mockLoad,
}));

const USER_ID = "ef100000-0000-4000-8000-000000000001";
const TOKEN = "ef200000-0000-4000-8000-000000000001";

const service = { from: mockFrom };

function claim(overrides: Record<string, unknown> = {}) {
  return {
    user_id: USER_ID,
    claim_token: TOKEN,
    requested_revision: 3,
    claimed_revision: 3,
    claimed_posting_revision: 7,
    lease_expires_at: new Date(Date.now() + 300_000).toISOString(),
    ...overrides,
  };
}

function queueClaims(
  first: Record<string, unknown> | null = claim(),
  second: Record<string, unknown> | null = claim(),
) {
  results.recommendation_refresh_state = [
    { data: first, error: null },
    { data: second, error: null },
  ];

  results.recommendation_posting_state = [
    { data: { revision: 7 }, error: null },
    { data: { revision: 7 }, error: null },
  ];
}

function emptyInputs() {
  return {
    success: true as const,
    user_id: USER_ID,
    empty_profile: true,
    considered_jobs: 0,
    shortlist: [],
    seeker_state: buildSeekerState({
      skills: [],
      education: [],
      experience: [],
      preferences: null,
      location: null,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  filters.length = 0;

  for (const key of Object.keys(results)) {
    delete results[key];
  }

  mockService.mockReturnValue(service);

  mockFrom.mockImplementation((table: string) => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => {
        return results[table]?.shift() ?? {
          data: null,
          error: null,
        };
      }),
    };

    builder.select.mockReturnValue(builder);
    builder.eq.mockImplementation(
      (column: string, value: unknown) => {
        filters.push({ table, column, value });
        return builder;
      },
    );

    return builder;
  });

  queueClaims();
  mockLoad.mockResolvedValue(emptyInputs());
});

describe("getWorkerRecommendationInputs", () => {
  it("derives the owner from the claim and uses the shared loader", async () => {
    const result = await getWorkerRecommendationInputs(TOKEN, {
      limit: 5,
    });

    expect(mockLoad).toHaveBeenCalledWith(service, USER_ID, {
      limit: 5,
    });

    expect(result).toMatchObject({
      success: true,
      claim: {
        user_id: USER_ID,
        claim_token: TOKEN,
        seeker_revision: "3",
        posting_revision: "7",
      },
      inputs: {
        empty_profile: true,
        shortlist: [],
      },
    });

    expect(
      filters.filter(
        (filter) =>
          filter.table === "recommendation_refresh_state",
      ),
    ).toEqual([
      {
        table: "recommendation_refresh_state",
        column: "claim_token",
        value: TOKEN,
      },
      {
        table: "recommendation_refresh_state",
        column: "claim_token",
        value: TOKEN,
      },
    ]);
  });

  it("rejects malformed tokens before creating a service client", async () => {
    expect(
      await getWorkerRecommendationInputs("invalid"),
    ).toEqual({
      success: false,
      code: "CLAIM_UNAVAILABLE",
    });

    expect(mockService).not.toHaveBeenCalled();
  });

  it("stops before profile loading when the claim is missing", async () => {
    queueClaims(null);

    expect(await getWorkerRecommendationInputs(TOKEN)).toEqual({
      success: false,
      code: "CLAIM_UNAVAILABLE",
    });

    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("rejects an expired lease before profile loading", async () => {
    queueClaims(
      claim({
        lease_expires_at: new Date(
          Date.now() - 1000,
        ).toISOString(),
      }),
    );

    expect(await getWorkerRecommendationInputs(TOKEN)).toEqual({
      success: false,
      code: "CLAIM_UNAVAILABLE",
    });

    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("rejects a seeker revision already outdated before loading", async () => {
    queueClaims(claim({ requested_revision: 4 }));

    expect(await getWorkerRecommendationInputs(TOKEN)).toEqual({
      success: false,
      code: "CLAIM_UNAVAILABLE",
    });

    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("rejects a posting revision already outdated before loading", async () => {
    results.recommendation_posting_state = [
      { data: { revision: 8 }, error: null },
    ];

    expect(await getWorkerRecommendationInputs(TOKEN)).toEqual({
      success: false,
      code: "CLAIM_UNAVAILABLE",
    });

    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("rejects a profile change that happens during loading", async () => {
    queueClaims(
      claim(),
      claim({ requested_revision: 4 }),
    );

    expect(await getWorkerRecommendationInputs(TOKEN)).toEqual({
      success: false,
      code: "CLAIM_UNAVAILABLE",
    });

    expect(mockLoad).toHaveBeenCalledOnce();
  });

  it("rejects a posting change that happens during loading", async () => {
    results.recommendation_posting_state = [
      { data: { revision: 7 }, error: null },
      { data: { revision: 8 }, error: null },
    ];

    expect(await getWorkerRecommendationInputs(TOKEN)).toEqual({
      success: false,
      code: "CLAIM_UNAVAILABLE",
    });
  });

  it("rejects a claim replaced during loading", async () => {
    queueClaims(claim(), null);

    expect(await getWorkerRecommendationInputs(TOKEN)).toEqual({
      success: false,
      code: "CLAIM_UNAVAILABLE",
    });
  });

  it("stops when the owner is no longer an eligible job seeker", async () => {
    mockLoad.mockResolvedValue({
      success: false,
      code: "NOT_JOB_SEEKER",
      error: "Only job seekers can get job recommendations.",
    });

    expect(await getWorkerRecommendationInputs(TOKEN)).toEqual({
      success: false,
      code: "CLAIM_UNAVAILABLE",
    });
  });

  it("returns a safe failure when the claim query fails", async () => {
    results.recommendation_refresh_state = [
      {
        data: null,
        error: { message: "Internal database details" },
      },
    ];

    expect(await getWorkerRecommendationInputs(TOKEN)).toEqual({
      success: false,
      code: "LOAD_FAILED",
    });

    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("returns a safe failure when input loading fails", async () => {
    mockLoad.mockResolvedValue({
      success: false,
      code: "LOAD_FAILED",
      error: "Internal database details",
    });

    expect(await getWorkerRecommendationInputs(TOKEN)).toEqual({
      success: false,
      code: "LOAD_FAILED",
    });
  });

  it("handles bigint revisions returned as strings", async () => {
    queueClaims(
      claim({
        requested_revision: "3",
        claimed_revision: "3",
        claimed_posting_revision: "7",
      }),
      claim({
        requested_revision: "3",
        claimed_revision: "3",
        claimed_posting_revision: "7",
      }),
    );

    expect(await getWorkerRecommendationInputs(TOKEN)).toMatchObject({
      success: true,
      claim: {
        seeker_revision: "3",
        posting_revision: "7",
      },
    });
  });
});