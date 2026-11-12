import { beforeEach, describe, expect, it, vi } from "vitest";
import { JevError, type JevScoreAnswer } from "@/lib/ai/jev";
import type { AskJev } from "./job-fit";
import type { JobForMatching, ShortlistedJob } from "./job-shortlist";
import type { SeekerState } from "./seeker-state";
import { AI_WEIGHT, blendScore, buildRecommendations, getRecommendations } from "./recommend";

const { mockGetInputs } = vi.hoisted(() => ({ mockGetInputs: vi.fn() }));

vi.mock("./recommendation-inputs", () => ({ getRecommendationInputs: mockGetInputs }));

const seeker: SeekerState = {
  skills: [{ name: "React", proficiency: "advanced" }],
  education: [],
  experience: [],
  total_years_of_experience: 1,
  location: "Montreal",
  preferences: { desired_role: "Frontend Developer", desired_position: null, desired_salary: null, work_mode: null },
};

function shortlisted(id: string, score: number, created = "2026-11-01T00:00:00Z"): ShortlistedJob {
  const job: JobForMatching = {
    id,
    title: `Job ${id}`,
    firm_name: "Globex",
    location: "Montreal",
    work_mode: "Remote",
    employment_type: "Full-time",
    required_skills: "React",
    salary: null,
    experience: null,
    description: null,
    status: "open",
    created_at: created,
  };
  return { job, score, skill_match: { percent: 100, matched: ["React"], missing: [] }, reasons: [`reason ${id}`] };
}

/** An ask() that returns the same level for every question, chosen per posting title. */
function askByTitle(levels: Record<string, number>, confidence = 0.9): AskJev {
  return async (state) => {
    const title = (state.job as { title: string }).title;
    const level = levels[title];
    if (level === undefined) throw new JevError("http_error", "Jev returned HTTP 500.", 500);
    const answer: JevScoreAnswer = { score: level, confidence };
    return { skills: answer, level: answer, interest: answer };
  };
}

const okSummary = (ids: string[]) =>
  JSON.stringify({ summaries: ids.map((id) => ({ job_id: id, summary: `Summary for ${id}.` })) });

describe("blendScore", () => {
  it("uses the code score alone when there is no AI rating", () => {
    expect(blendScore(70, null)).toBe(70);
  });

  it("blends the AI fit and the code score", () => {
    const fit = { score: 100, minConfidence: 0.9, lowConfidence: false, levels: { skills: 3, level: 3, interest: 3 } };

    expect(blendScore(50, fit)).toBe(Math.round(AI_WEIGHT * 100 + (1 - AI_WEIGHT) * 50));
    expect(blendScore(50, fit)).toBe(80);
  });
});

describe("buildRecommendations", () => {
  it("does nothing for an empty shortlist", async () => {
    const ask = vi.fn<AskJev>();
    const complete = vi.fn();

    expect(await buildRecommendations(seeker, [], { ask, complete })).toEqual({
      recommendations: [],
      ai_ranked: false,
      summary_status: "skipped",
    });
    expect(ask).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("lets the AI reorder postings that are close in code score", async () => {
    const list = [shortlisted("a", 80), shortlisted("b", 75)];
    const ask = askByTitle({ "Job a": 0, "Job b": 3 });

    const result = await buildRecommendations(seeker, list, { ask, complete: vi.fn().mockResolvedValue(okSummary(["a", "b"])) });

    expect(result.recommendations.map((item) => item.job.id)).toEqual(["b", "a"]);
    expect(result.recommendations[0]).toMatchObject({ score: 90, match_score: 75 });
    expect(result.ai_ranked).toBe(true);
  });

  it("keeps a posting's code score when its AI call fails", async () => {
    const list = [shortlisted("a", 90), shortlisted("b", 60)];
    const ask = askByTitle({ "Job b": 3 });

    const result = await buildRecommendations(seeker, list, { ask, complete: vi.fn().mockResolvedValue("{}") });

    const byId = Object.fromEntries(result.recommendations.map((item) => [item.job.id, item]));
    expect(byId.a).toMatchObject({ fit: null, score: 90 });
    expect(byId.b.fit?.score).toBe(100);
    expect(result.ai_ranked).toBe(true);
  });

  it("says the order is by code score when every AI call fails", async () => {
    const result = await buildRecommendations(seeker, [shortlisted("a", 90), shortlisted("b", 60)], {
      ask: askByTitle({}),
      complete: vi.fn().mockResolvedValue("{}"),
    });

    expect(result.ai_ranked).toBe(false);
    expect(result.recommendations.map((item) => item.job.id)).toEqual(["a", "b"]);
  });

  it("breaks ties by code score, then newest posting, then id", async () => {
    const list = [
      shortlisted("b", 70, "2026-11-01T00:00:00Z"),
      shortlisted("a", 70, "2026-11-01T00:00:00Z"),
      shortlisted("new", 70, "2026-11-05T00:00:00Z"),
    ];
    const ask = askByTitle({ "Job a": 2, "Job b": 2, "Job new": 2 });

    const result = await buildRecommendations(seeker, list, { ask, complete: vi.fn().mockResolvedValue("{}") });

    expect(result.recommendations.map((item) => item.job.id)).toEqual(["new", "a", "b"]);
  });

  it("writes summaries for only the top few, and falls back to the reasons for the rest", async () => {
    const list = ["a", "b", "c", "d"].map((id, index) => shortlisted(id, 90 - index * 10));
    const ask = askByTitle({ "Job a": 3, "Job b": 3, "Job c": 3, "Job d": 3 });
    const complete = vi.fn().mockResolvedValue(okSummary(["a", "b"]));

    const result = await buildRecommendations(seeker, list, { ask, complete, summaryCount: 2 });

    const payload = JSON.parse(complete.mock.calls[0][0][1].content);
    expect(payload.jobs.map((entry: { job_id: string }) => entry.job_id)).toEqual(["a", "b"]);
    expect(result.summary_status).toBe("ok");
    expect(result.recommendations.map((item) => item.summary)).toEqual(["Summary for a.", "Summary for b.", null, null]);
    expect(result.recommendations[3].reasons).toEqual(["reason d"]);
  });

  it("still returns the ranking when the text model is not set up or fails", async () => {
    const ask = askByTitle({ "Job a": 3 });

    const failed = await buildRecommendations(seeker, [shortlisted("a", 80)], {
      ask,
      complete: vi.fn().mockRejectedValue(new Error("boom")),
    });

    expect(failed.summary_status).toBe("failed");
    expect(failed.recommendations).toHaveLength(1);
    expect(failed.recommendations[0].summary).toBeNull();
  });

  it("throws when the server has no Jev key", async () => {
    const ask = vi.fn<AskJev>().mockRejectedValue(new JevError("missing_key", "AI_GATEWAY_API_KEY is not set on the server."));

    await expect(buildRecommendations(seeker, [shortlisted("a", 80)], { ask })).rejects.toMatchObject({
      code: "missing_key",
    });
  });
});

describe("getRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes sign-in, MFA and role failures straight through without any AI call", async () => {
    const failure = { success: false, code: "MFA_REQUIRED", error: "Complete two-factor authentication to continue." };
    mockGetInputs.mockResolvedValue(failure);
    const ask = vi.fn<AskJev>();
    const complete = vi.fn();

    expect(await getRecommendations({ ask, complete })).toEqual(failure);
    expect(ask).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("returns early for an empty profile without any AI call", async () => {
    mockGetInputs.mockResolvedValue({ success: true, empty_profile: true, seeker_state: seeker, shortlist: [], considered_jobs: 0 });
    const ask = vi.fn<AskJev>();
    const complete = vi.fn();

    expect(await getRecommendations({ ask, complete })).toEqual({
      success: true,
      empty_profile: true,
      considered_jobs: 0,
      recommendations: [],
      ai_ranked: false,
      summary_status: "skipped",
    });
    expect(ask).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("ranks and summarizes the shortlist for a seeker with a profile", async () => {
    mockGetInputs.mockResolvedValue({
      success: true,
      empty_profile: false,
      seeker_state: seeker,
      shortlist: [shortlisted("a", 80), shortlisted("b", 70)],
      considered_jobs: 12,
    });
    const ask = askByTitle({ "Job a": 3, "Job b": 1 });
    const complete = vi.fn().mockResolvedValue(okSummary(["a", "b"]));

    const result = await getRecommendations({ ask, complete, limit: 2 });

    expect(mockGetInputs).toHaveBeenCalledWith({ limit: 2, now: undefined });
    expect(result).toMatchObject({ success: true, empty_profile: false, considered_jobs: 12, ai_ranked: true, summary_status: "ok" });
    if (!result.success) return;
    expect(result.recommendations.map((item) => item.job.id)).toEqual(["a", "b"]);
    expect(result.recommendations[0].summary).toBe("Summary for a.");
  });
});
