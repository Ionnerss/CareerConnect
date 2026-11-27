import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSeekerState } from "./seeker-state";
import { shortlistJobs } from "./job-shortlist";
import { processRecommendationClaim } from "./worker";

const {
  mockInputs,
  mockReserve,
  mockBuild,
  mockPublish,
  mockFail,
} = vi.hoisted(() => ({
  mockInputs: vi.fn(),
  mockReserve: vi.fn(),
  mockBuild: vi.fn(),
  mockPublish: vi.fn(),
  mockFail: vi.fn(),
}));

const { mockFingerprint, mockReuse } = vi.hoisted(() => ({
  mockFingerprint: vi.fn(),
  mockReuse: vi.fn(),
}));

const { mockBudgetedProviders, mockAssertBudget } = vi.hoisted(
  () => ({
    mockBudgetedProviders: vi.fn(),
    mockAssertBudget: vi.fn(),
  }),
);

vi.mock("./provider-budget", () => ({
  createBudgetedRecommendationProviders: mockBudgetedProviders,
}));

vi.mock("./cache-fingerprint", () => ({
  createRecommendationFingerprint: mockFingerprint,
}));

vi.mock("./result-cache", () => ({
  reuseRecommendationRun: mockReuse,
}));

vi.mock("./worker-inputs", () => ({
  getWorkerRecommendationInputs: mockInputs,
}));

vi.mock("./persistence", () => ({
  reserveRecommendationRun: mockReserve,
  publishRecommendationRun: mockPublish,
}));

vi.mock("./worker-retry", () => ({
  failRecommendationRefresh: mockFail,
}));

vi.mock("./recommend", () => ({
  buildRecommendations: mockBuild,
}));

const USER_ID = "f0100000-0000-4000-8000-000000000001";
const TOKEN = "f0200000-0000-4000-8000-000000000001";
const RUN_ID = "f0300000-0000-4000-8000-000000000001";

const snapshot = {
  skills: [{ name: "Java", proficiency: "Advanced" }],
  education: [],
  experience: [],
  preferences: null,
  location: "Montreal",
};

const job = {
  id: "f0400000-0000-4000-8000-000000000001",
  title: "Java Developer",
  firm_name: "Test Company",
  location: "Montreal",
  work_mode: "Remote",
  employment_type: "Full-time",
  required_skills: "Java",
  salary: 60000,
  experience: null,
  description: "Build Java services.",
  status: "open",
  created_at: "2026-11-01T00:00:00Z",
};

const shortlist = shortlistJobs(snapshot, [job]);
const seeker = buildSeekerState(snapshot);

const claim = {
  user_id: USER_ID,
  claim_token: TOKEN,
  seeker_revision: "3",
  posting_revision: "7",
};

const inputs = {
  success: true as const,
  user_id: USER_ID,
  empty_profile: false,
  considered_jobs: 1,
  seeker_state: seeker,
  shortlist,
};

const recommendations = [
  {
    job,
    score: shortlist[0].score,
    match_score: shortlist[0].score,
    fit: null,
    skill_match: shortlist[0].skill_match,
    reasons: shortlist[0].reasons,
    summary: null,
    fit_error: null,
    fit_generated_at: null,
  },
];

beforeEach(() => {
  vi.resetAllMocks();

  mockBudgetedProviders.mockImplementation(
    (_userId, options) => ({
      options,
      assertAvailable: mockAssertBudget,
    }),
  );

  mockFingerprint.mockReturnValue("a".repeat(64));
  mockReuse.mockResolvedValue(false);

  mockInputs.mockResolvedValue({
    success: true,
    claim,
    inputs,
  });

  mockReserve.mockResolvedValue(RUN_ID);

  mockBuild.mockResolvedValue({
    recommendations,
    ai_ranked: false,
    summary_status: "skipped",
  });

  mockPublish.mockResolvedValue(undefined);
  mockFail.mockResolvedValue(true);
});

describe("processRecommendationClaim", () => {
  it("reserves with claim metadata before generating and publishing", async () => {
    expect(await processRecommendationClaim(TOKEN)).toEqual({
      success: true,
      run_id: RUN_ID,
    });

    expect(mockInputs).toHaveBeenCalledWith(TOKEN);
    expect(mockReserve).toHaveBeenCalledWith(
      inputs,
      claim,
      "a".repeat(64),
    );

    expect(mockReuse).toHaveBeenCalledWith(RUN_ID, 1);
    expect(mockBuild).toHaveBeenCalledWith(seeker, shortlist, {});

    expect(mockPublish).toHaveBeenCalledWith(
      RUN_ID,
      seeker,
      recommendations,
      expect.any(String),
    );

    expect(mockReserve.mock.invocationCallOrder[0]).toBeLessThan(
      mockBuild.mock.invocationCallOrder[0],
    );

    expect(mockBuild.mock.invocationCallOrder[0]).toBeLessThan(
      mockPublish.mock.invocationCallOrder[0],
    );

    expect(mockFail).not.toHaveBeenCalled();
  });

  it.each(["CLAIM_UNAVAILABLE", "LOAD_FAILED"] as const)(
    "stops before reservation when loading returns %s",
    async (code) => {
      mockInputs.mockResolvedValue({
        success: false,
        code,
      });

      expect(await processRecommendationClaim(TOKEN)).toEqual({
        success: false,
        code,
      });

      expect(mockReserve).not.toHaveBeenCalled();
      expect(mockBuild).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
      expect(mockFail).not.toHaveBeenCalled();
    },
  );

  it("does not generate or release the claim when reservation fails", async () => {
    mockReserve.mockRejectedValue(new Error("Duplicate claim"));

    expect(await processRecommendationClaim(TOKEN)).toEqual({
      success: false,
      code: "RESERVATION_FAILED",
    });

    expect(mockBuild).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockFail).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "an empty profile",
      overrides: {
        empty_profile: true,
        shortlist: [],
      },
    },
    {
      label: "an empty shortlist",
      overrides: {
        empty_profile: false,
        shortlist: [],
      },
    },
  ])(
    "publishes an empty success for $label",
    async ({ overrides }) => {
      mockInputs.mockResolvedValue({
        success: true,
        claim,
        inputs: {
          ...inputs,
          ...overrides,
        },
      });

      expect(await processRecommendationClaim(TOKEN)).toEqual({
        success: true,
        run_id: RUN_ID,
      });

      expect(mockBuild).not.toHaveBeenCalled();

      expect(mockPublish).toHaveBeenCalledWith(
        RUN_ID,
        seeker,
        [],
        expect.any(String),
      );

      expect(mockFail).not.toHaveBeenCalled();
    },
  );

  it("records generation failures through the retry helper", async () => {
    mockBuild.mockRejectedValue(new Error("Provider failure"));

    expect(await processRecommendationClaim(TOKEN)).toEqual({
      success: false,
      run_id: RUN_ID,
      code: "GENERATION_FAILED",
      cleanup_failed: false,
    });

    expect(mockFail).toHaveBeenCalledWith(
      TOKEN,
      "generation_failed",
    );

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("records publication failures through the retry helper", async () => {
    mockPublish.mockRejectedValue(new Error("Outdated revision"));

    expect(await processRecommendationClaim(TOKEN)).toEqual({
      success: false,
      run_id: RUN_ID,
      code: "PUBLICATION_FAILED",
      cleanup_failed: false,
    });

    expect(mockFail).toHaveBeenCalledWith(
      TOKEN,
      "publication_failed",
    );
  });

  it("reports cleanup failure without exposing internal errors", async () => {
    mockBuild.mockRejectedValue(
      new Error("Private provider details"),
    );

    mockFail.mockRejectedValue(
      new Error("Private database details"),
    );

    expect(await processRecommendationClaim(TOKEN)).toEqual({
      success: false,
      run_id: RUN_ID,
      code: "GENERATION_FAILED",
      cleanup_failed: true,
    });
  });

  it("tolerates cleanup finding that the claim was already replaced", async () => {
    mockBuild.mockRejectedValue(new Error("Generation failed"));
    mockFail.mockResolvedValue(false);

    expect(await processRecommendationClaim(TOKEN)).toEqual({
      success: false,
      run_id: RUN_ID,
      code: "GENERATION_FAILED",
      cleanup_failed: false,
    });

    expect(mockFail).toHaveBeenCalledWith(
      TOKEN,
      "generation_failed",
    );

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("returns a cache hit without generating or publishing again", async () => {
    mockReuse.mockResolvedValue(true);

    expect(await processRecommendationClaim(TOKEN)).toEqual({
      success: true,
      run_id: RUN_ID,
    });

    expect(mockBuild).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockFail).not.toHaveBeenCalled();
    expect(mockBudgetedProviders).not.toHaveBeenCalled();
  });

  it("records a cache publication failure without calling the AI", async () => {
    mockReuse.mockRejectedValue(new Error("Publication rejected"));

    expect(await processRecommendationClaim(TOKEN)).toEqual({
      success: false,
      run_id: RUN_ID,
      code: "PUBLICATION_FAILED",
      cleanup_failed: false,
    });

    expect(mockBuild).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockFail).toHaveBeenCalledWith(
      TOKEN,
      "publication_failed",
    );
  });

  it("bypasses caching when a provider is injected", async () => {
    const ask = vi.fn();

    expect(
      await processRecommendationClaim(TOKEN, { ask }),
    ).toEqual({
      success: true,
      run_id: RUN_ID,
    });

    expect(mockFingerprint).not.toHaveBeenCalled();
    expect(mockReuse).not.toHaveBeenCalled();

    expect(mockReserve).toHaveBeenCalledWith(
      inputs,
      claim,
      undefined,
    );

    expect(mockBuild).toHaveBeenCalledWith(
      seeker,
      shortlist,
      { ask },
    );
  });

  it("does not publish fallback output after a budget denial", async () => {
    mockAssertBudget.mockImplementation(() => {
      throw new Error("Recommendation provider budget is unavailable");
    });

    expect(await processRecommendationClaim(TOKEN)).toEqual({
      success: false,
      run_id: RUN_ID,
      code: "GENERATION_FAILED",
      cleanup_failed: false,
    });

    expect(mockPublish).not.toHaveBeenCalled();

    expect(mockFail).toHaveBeenCalledWith(
      TOKEN,
      "generation_failed",
    );
  });
});