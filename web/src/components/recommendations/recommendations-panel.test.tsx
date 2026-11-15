// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecommendationsPanel, { matchLabel } from "./recommendations-panel";

type Rec = {
  job: Record<string, unknown>;
  score: number;
  match_score: number;
  fit: { score: number; minConfidence: number; lowConfidence: boolean; levels: Record<string, number> } | null;
  skill_match: { percent: number; matched: string[]; missing: string[] } | null;
  reasons: string[];
  summary: string | null;
};

function rec(id: string, overrides: Partial<Rec> & { job?: Record<string, unknown> } = {}): Rec {
  const { job, ...rest } = overrides;
  return {
    job: {
      id,
      title: `Job ${id}`,
      firm_name: `Firm ${id}`,
      location: "Montreal",
      work_mode: "Hybrid",
      employment_type: "Full-time",
      required_skills: null,
      salary: 85000,
      experience: null,
      description: null,
      status: "open",
      created_at: "2026-11-01T00:00:00Z",
      ...job,
    },
    score: 80,
    match_score: 70,
    fit: { score: 85, minConfidence: 0.9, lowConfidence: false, levels: { skills: 3, level: 2, interest: 2 } },
    skill_match: { percent: 50, matched: ["React"], missing: ["SQL"] },
    reasons: ["Matches 1 of 2 required skills"],
    summary: "A solid fit for your React background.",
    ...rest,
  };
}

function success(recommendations: Rec[], extra: Record<string, unknown> = {}) {
  return {
    success: true,
    empty_profile: false,
    considered_jobs: 12,
    recommendations,
    ai_ranked: true,
    summary_status: "ok",
    ...extra,
  };
}

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("matchLabel", () => {
  it("uses words for each score band", () => {
    expect(matchLabel(95)).toBe("Strong match");
    expect(matchLabel(80)).toBe("Strong match");
    expect(matchLabel(79)).toBe("Good match");
    expect(matchLabel(60)).toBe("Good match");
    expect(matchLabel(59)).toBe("Possible match");
    expect(matchLabel(0)).toBe("Possible match");
  });
});

describe("RecommendationsPanel", () => {
  it("shows a loading state, then asks the endpoint once with POST", async () => {
    let resolve: (value: unknown) => void = () => {};
    const fn = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    vi.stubGlobal("fetch", fn);

    render(<RecommendationsPanel />);
    expect(screen.getByText(/finding your best matches/i)).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");

    resolve({ ok: true, status: 200, json: async () => success([rec("a")]) });
    await screen.findByText("Job a");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("/api/recommendations", { method: "POST" });
  });

  it("renders the cards in the order returned, with rank, score and company", async () => {
    mockFetch(success([rec("a", { score: 91 }), rec("b", { score: 62 }), rec("c", { score: 40 })]));
    render(<RecommendationsPanel />);

    const list = await screen.findByRole("list", { name: /recommended jobs/i });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("Job a")).toBeTruthy();
    expect(within(items[0]).getByText("91%")).toBeTruthy();
    expect(within(items[0]).getByText("Strong match")).toBeTruthy();
    expect(within(items[0]).getByText("Firm a")).toBeTruthy();
    expect(within(items[1]).getByText("Good match")).toBeTruthy();
    expect(within(items[2]).getByText("Possible match")).toBeTruthy();
    expect(screen.getByText(/your top 3 matches/i)).toBeTruthy();
  });

  it("shows job details and the salary", async () => {
    mockFetch(success([rec("a")]));
    render(<RecommendationsPanel />);
    await screen.findByText("Job a");
    expect(screen.getByText("Montreal")).toBeTruthy();
    expect(screen.getByText("Hybrid")).toBeTruthy();
    expect(screen.getByText("Full-time")).toBeTruthy();
    expect(screen.getByText("$85,000")).toBeTruthy();
  });

  it("falls back for missing job fields", async () => {
    mockFetch(
      success([
        rec("a", {
          job: { title: null, firm_name: null, location: null, work_mode: null, employment_type: null, salary: null },
        }),
      ]),
    );
    render(<RecommendationsPanel />);
    await screen.findByText("Untitled position");
    expect(screen.getByText("Company not listed")).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it("shows the AI summary when there is one", async () => {
    mockFetch(success([rec("a")]));
    render(<RecommendationsPanel />);
    await screen.findByText("A solid fit for your React background.");
    expect(screen.getByText("AI summary")).toBeTruthy();
    expect(screen.queryByText("Why it fits")).toBeNull();
  });

  it("falls back to the code-written reasons when there is no summary", async () => {
    mockFetch(success([rec("a", { summary: null, reasons: ["Matches 1 of 2 required skills", "Same work mode"] })]));
    render(<RecommendationsPanel />);
    await screen.findByText("Why it fits");
    expect(screen.getByText("Same work mode")).toBeTruthy();
    expect(screen.queryByText("AI summary")).toBeNull();
  });

  it("lists skills you have and skills to build with text labels", async () => {
    mockFetch(success([rec("a", { skill_match: { percent: 50, matched: ["React", "Git"], missing: ["SQL"] } })]));
    render(<RecommendationsPanel />);
    await screen.findByText("Skills you have:");
    expect(screen.getByText("Skills to build:")).toBeTruthy();
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getByText("Git")).toBeTruthy();
    expect(screen.getByText("SQL")).toBeTruthy();
  });

  it("hides the skill rows when the job lists no skills", async () => {
    mockFetch(success([rec("a", { skill_match: null })]));
    render(<RecommendationsPanel />);
    await screen.findByText("Job a");
    expect(screen.queryByText("Skills you have:")).toBeNull();
    expect(screen.queryByText("Skills to build:")).toBeNull();
  });

  it("warns when the AI was unsure about a job", async () => {
    const lowFit = { score: 50, minConfidence: 0.3, lowConfidence: true, levels: { skills: 1, level: 1, interest: 1 } };
    mockFetch(success([rec("a", { fit: lowFit }), rec("b")]));
    render(<RecommendationsPanel />);
    await screen.findByText("Job a");
    expect(screen.getAllByText(/less sure about this one/i)).toHaveLength(1);
  });

  it("links each card to the normal apply page, encoding the id", async () => {
    mockFetch(success([rec("a b/c")]));
    render(<RecommendationsPanel />);
    await screen.findByText("Job a b/c");
    const link = screen.getByRole("link", { name: /view and apply/i });
    expect(link.textContent).toContain("Job a b/c");
    expect(link.getAttribute("href")).toBe("/jobs/a%20b%2Fc/apply");
  });

  it("shows the AI-unavailable notice when ranking fell back to code scores", async () => {
    mockFetch(success([rec("a", { fit: null })], { ai_ranked: false }));
    render(<RecommendationsPanel />);
    await screen.findByText("Job a");
    expect(screen.getByText(/ai ranking is unavailable/i)).toBeTruthy();
  });

  it("does not show that notice when AI ranking worked", async () => {
    mockFetch(success([rec("a")]));
    render(<RecommendationsPanel />);
    await screen.findByText("Job a");
    expect(screen.queryByText(/ai ranking is unavailable/i)).toBeNull();
  });

  it("explains privacy and that the seeker decides", async () => {
    mockFetch(success([rec("a")], { considered_jobs: 1 }));
    render(<RecommendationsPanel />);
    await screen.findByText("Job a");
    expect(screen.getByText(/you decide where to apply/i)).toBeTruthy();
    expect(screen.getByText(/never sent to the AI/i)).toBeTruthy();
    expect(screen.getByText(/your top 1 match$/i)).toBeTruthy();
    expect(screen.getByText(/picked from 1 open job\./i)).toBeTruthy();
  });

  it("shows the empty-profile state with a link to the profile", async () => {
    mockFetch(success([], { empty_profile: true, considered_jobs: 0 }));
    render(<RecommendationsPanel />);
    await screen.findByText(/complete your profile/i);
    expect(screen.getByRole("link", { name: /go to my profile/i }).getAttribute("href")).toBe("/profile");
  });

  it("shows the no-jobs state with a link to browse jobs", async () => {
    mockFetch(success([]));
    render(<RecommendationsPanel />);
    await screen.findByText(/no open jobs to recommend/i);
    expect(screen.getByRole("link", { name: /browse all jobs/i }).getAttribute("href")).toBe("/jobs");
  });

  it("sends a seeker who needs two-factor to the verify page", async () => {
    mockFetch({ success: false, code: "MFA_REQUIRED", error: "Two-factor authentication is required." }, 403);
    render(<RecommendationsPanel />);
    await screen.findByRole("alert");
    expect(screen.getByText("Two-factor authentication is required.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /verify with your authenticator/i }).getAttribute("href")).toBe("/auth/mfa");
  });

  it("sends a signed-out visitor to sign in", async () => {
    mockFetch({ success: false, code: "UNAUTHENTICATED", error: "Please sign in." }, 401);
    render(<RecommendationsPanel />);
    await screen.findByRole("alert");
    expect(screen.getByRole("link", { name: /sign in/i }).getAttribute("href")).toBe("/auth/login");
  });

  it("shows a message with no action for a non-job-seeker", async () => {
    mockFetch({ success: false, code: "NOT_JOB_SEEKER", error: "Only job seekers get recommendations." }, 403);
    render(<RecommendationsPanel />);
    await screen.findByText("Only job seekers get recommendations.");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows a friendly message when AI is not configured, with retry", async () => {
    mockFetch({ success: false, code: "AI_NOT_CONFIGURED", error: "AI recommendations are not set up on the server yet." }, 503);
    render(<RecommendationsPanel />);
    await screen.findByText(/not set up on the server yet/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("shows a retry for other server errors and reloads on click", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ success: false, code: "BACKEND_ERROR", error: "Unable to load your recommendations. Please try again." }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => success([rec("a")]) });
    vi.stubGlobal("fetch", fn);

    render(<RecommendationsPanel />);
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    await screen.findByText("Job a");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("handles a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<RecommendationsPanel />);
    await screen.findByText(/could not reach the server/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("handles a response that is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      }),
    );
    render(<RecommendationsPanel />);
    await screen.findByText(/unable to load your recommendations/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("handles JSON of the wrong shape", async () => {
    mockFetch({ hello: "world" });
    render(<RecommendationsPanel />);
    await screen.findByText(/unable to load your recommendations/i);
  });

  it("reloads when Refresh is pressed", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => success([rec("a")]) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => success([rec("b")]) });
    vi.stubGlobal("fetch", fn);

    render(<RecommendationsPanel />);
    await screen.findByText("Job a");
    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => expect(screen.getByText("Job b")).toBeTruthy());
    expect(screen.queryByText("Job a")).toBeNull();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
