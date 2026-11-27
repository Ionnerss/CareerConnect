// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  RefreshStatusResult,
  SavedRecommendation,
  SavedRecommendationResults,
} from "@/lib/recommendations/refresh-client";
import RecommendationsPanel, { matchLabel } from "./recommendations-panel";

const fetchMock = vi.fn<typeof fetch>();

const GENERATED_AT = "2026-11-27T12:00:00.000Z";
const CHECKED_AT = "2026-11-27T12:10:00.000Z";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function recommendation(
  index: number,
  overrides: Partial<SavedRecommendation> = {},
): SavedRecommendation {
  const suffix = String(index).padStart(12, "0");

  return {
    job: {
      id: `33333333-3333-4333-8333-${suffix}`,
      title: `Job ${index}`,
      firm_name: `Company ${index}`,
      location: "Montreal",
      work_mode: "Hybrid",
      employment_type: "Full-time",
      required_skills: "React, SQL",
      salary: 85000,
      experience: null,
      description: null,
      status: "open",
      created_at: "2026-11-26T12:00:00.000Z",
    },
    score: 80,
    match_score: 70,
    fit: null,
    fit_error: null,
    fit_generated_at: null,
    skill_match: {
      percent: 50,
      matched: ["React"],
      missing: ["SQL"],
    },
    reasons: ["Matches 1 of 2 required skills"],
    summary: "A solid fit for your React background.",
    ...overrides,
  };
}

function savedResults(
  overrides: Partial<SavedRecommendationResults> = {},
): SavedRecommendationResults {
  return {
    success: true,
    run: {
      id: "22222222-2222-4222-8222-222222222222",
      created_at: GENERATED_AT,
      completed_at: CHECKED_AT,
      result_count: 1,
      summary_count: 1,
      ranking_mode: "ai",
    },
    recommendations: [recommendation(1)],
    ...overrides,
  };
}

function refreshStatus(
  overrides: Partial<RefreshStatusResult> = {},
): RefreshStatusResult {
  return {
    success: true,
    processing_enabled: true,
    status: "idle",
    stale: false,
    background_enabled: true,
    manual_pending: false,
    attempt_count: 1,
    max_attempts: 3,
    next_attempt_at: null,
    last_failure_code: null,
    generated_at: GENERATED_AT,
    checked_at: CHECKED_AT,
    ...overrides,
  };
}

let savedBody: SavedRecommendationResults;
let statusBody: RefreshStatusResult;
let respondToRefresh: () => Promise<Response>;

function pathOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname;
  return input.url;
}

function refreshRequests() {
  return fetchMock.mock.calls.filter(
    ([input]) =>
      pathOf(input) === "/api/recommendations/refresh",
  );
}

async function renderReady() {
  const user = userEvent.setup();

  render(<RecommendationsPanel />);

  await screen.findByRole("button", {
    name: /^(Refresh recommendations|Find my matches|Refresh pending)$/,
  });

  return user;
}

beforeEach(() => {
  fetchMock.mockReset();

  savedBody = savedResults();
  statusBody = refreshStatus();

  respondToRefresh = async () => {
    statusBody = refreshStatus({
      status: "queued",
      stale: true,
      manual_pending: true,
    });

    return jsonResponse(
      {
        success: true,
        status: "queued",
      },
      202,
    );
  };

  fetchMock.mockImplementation(async (input) => {
    const path = pathOf(input);

    if (path === "/api/recommendations/status") {
      return jsonResponse(statusBody);
    }

    if (path === "/api/recommendations") {
      return jsonResponse(savedBody);
    }

    if (path === "/api/recommendations/refresh") {
      return respondToRefresh();
    }

    throw new Error(`Unexpected request: ${path}`);
  });

  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("matchLabel", () => {
  it("uses text labels at the score boundaries", () => {
    expect(matchLabel(95)).toBe("Strong match");
    expect(matchLabel(80)).toBe("Strong match");
    expect(matchLabel(79)).toBe("Good match");
    expect(matchLabel(60)).toBe("Good match");
    expect(matchLabel(59)).toBe("Possible match");
    expect(matchLabel(0)).toBe("Possible match");
  });
});

describe("RecommendationsPanel", () => {
  it("reads saved recommendations on mount without queuing work", async () => {
    await renderReady();

    expect(
      screen.getByRole("list", {
        name: "Recommended jobs",
      }),
    ).toBeDefined();

    expect(
      fetchMock.mock.calls.map(([input]) => pathOf(input)),
    ).toEqual([
      "/api/recommendations/status",
      "/api/recommendations",
    ]);

    for (const [, options] of fetchMock.mock.calls) {
      expect(options?.method ?? "GET").toBe("GET");
    }

    expect(refreshRequests()).toHaveLength(0);
  });

  it("describes initial loading as a saved read", () => {
    fetchMock.mockImplementation(
      () => new Promise<Response>(() => {}),
    );

    render(<RecommendationsPanel />);

    expect(
      screen.getByText("Loading your saved recommendations…"),
    ).toBeDefined();

    expect(
      screen.queryByText(/Finding your best matches/i),
    ).toBeNull();

    expect(refreshRequests()).toHaveLength(0);
  });

  it("renders all saved cards in order with score labels", async () => {
    savedBody = savedResults({
      recommendations: [
        recommendation(1, { score: 91 }),
        recommendation(2, { score: 62 }),
        recommendation(3, { score: 40 }),
      ],
    });

    await renderReady();

    const list = screen.getByRole("list", {
      name: "Recommended jobs",
    });
    const cards = within(list).getAllByRole("listitem");

    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain("Job 1");
    expect(cards[0].textContent).toContain("Company 1");
    expect(cards[0].textContent).toContain("91%");
    expect(cards[0].textContent).toContain("Strong match");
    expect(cards[1].textContent).toContain("Good match");
    expect(cards[2].textContent).toContain("Possible match");

    expect(
      screen.getByRole("heading", {
        name: "Your top 3 matches",
      }),
    ).toBeDefined();
  });

  it("preserves job details and salary", async () => {
    await renderReady();

    expect(screen.getByText("Montreal")).toBeDefined();
    expect(screen.getByText("Hybrid")).toBeDefined();
    expect(screen.getByText("Full-time")).toBeDefined();
    expect(screen.getByText("$85,000")).toBeDefined();
  });

  it("preserves a salary of zero", async () => {
    const item = recommendation(1);

    savedBody = savedResults({
      recommendations: [
        {
          ...item,
          job: {
            ...item.job,
            salary: 0,
          },
        },
      ],
    });

    await renderReady();

    expect(screen.getByText("$0")).toBeDefined();
  });

  it("uses fallbacks for missing job details", async () => {
    const item = recommendation(1);

    savedBody = savedResults({
      recommendations: [
        {
          ...item,
          job: {
            ...item.job,
            title: null,
            firm_name: null,
            location: null,
            work_mode: null,
            employment_type: null,
            salary: null,
          },
        },
      ],
    });

    await renderReady();

    expect(screen.getByText("Untitled position")).toBeDefined();
    expect(screen.getByText("Company not listed")).toBeDefined();
    expect(screen.queryByText("$85,000")).toBeNull();
  });

  it("shows the saved summary when present", async () => {
    await renderReady();

    expect(screen.getByText("AI summary")).toBeDefined();
    expect(
      screen.getByText("A solid fit for your React background."),
    ).toBeDefined();

    expect(screen.queryByText("Why it fits")).toBeNull();
  });

  it("shows reasons when a summary is unavailable", async () => {
    savedBody = savedResults({
      recommendations: [
        recommendation(1, {
          summary: null,
          reasons: [
            "Matches 1 of 2 required skills",
            "Same work mode",
          ],
        }),
      ],
    });

    await renderReady();

    expect(screen.getByText("Why it fits")).toBeDefined();
    expect(screen.getByText("Same work mode")).toBeDefined();
    expect(screen.queryByText("AI summary")).toBeNull();
  });

  it("preserves matched and missing skill labels", async () => {
    await renderReady();

    expect(screen.getByText("Skills you have:")).toBeDefined();
    expect(screen.getByText("Skills to build:")).toBeDefined();
    expect(screen.getByText("React")).toBeDefined();
    expect(screen.getByText("SQL")).toBeDefined();
  });

  it("hides skill rows when no skill match is saved", async () => {
    savedBody = savedResults({
      recommendations: [
        recommendation(1, {
          skill_match: null,
        }),
      ],
    });

    await renderReady();

    expect(screen.queryByText("Skills you have:")).toBeNull();
    expect(screen.queryByText("Skills to build:")).toBeNull();
  });

  it("preserves the low-confidence warning", async () => {
    savedBody = savedResults({
      recommendations: [
        recommendation(1, {
          fit: {
            score: 50,
            minConfidence: 0.3,
            lowConfidence: true,
            levels: {
              skills: 1,
              level: 1,
              interest: 1,
            },
          },
        }),
      ],
    });

    await renderReady();

    expect(
      screen.getByText(/The AI was less sure about this one/),
    ).toBeDefined();
  });

  it("links each card to its own posting and application form", async () => {
    savedBody = savedResults({
      recommendations: [
        recommendation(1),
        recommendation(2),
      ],
    });

    await renderReady();

    for (const index of [1, 2]) {
      const item = recommendation(index);

      expect(
        screen
          .getByRole("link", {
            name: `View posting for Job ${index}`,
          })
          .getAttribute("href"),
      ).toBe(
        `/jobs?selectedJob=${encodeURIComponent(item.job.id)}`,
      );

      expect(
        screen
          .getByRole("link", {
            name: `Apply for Job ${index}`,
          })
          .getAttribute("href"),
      ).toBe(
        `/jobs/${encodeURIComponent(item.job.id)}/apply`,
      );
    }
  });

  it.each(["code_only", "mixed"] as const)(
    "explains fallback scoring for %s runs",
    async (rankingMode) => {
      const data = savedResults();

      if (!data.run) {
        throw new Error("The test requires a saved run.");
      }

      savedBody = savedResults({
        run: {
          ...data.run,
          ranking_mode: rankingMode,
        },
      });

      await renderReady();

      expect(
        screen.getByText(
          /These saved results include profile-based scoring/,
        ),
      ).toBeDefined();
    },
  );

  it("does not show a fallback notice for an AI-ranked run", async () => {
    await renderReady();

    expect(
      screen.queryByText(
        /These saved results include profile-based scoring/,
      ),
    ).toBeNull();
  });

  it("distinguishes no saved run from an empty successful run", async () => {
    savedBody = savedResults({
      run: null,
      recommendations: [],
    });

    statusBody = refreshStatus({
      status: "never_requested",
      stale: null,
      attempt_count: 0,
      generated_at: null,
      checked_at: null,
    });

    const user = await renderReady();

    expect(
      screen.getByText("No saved recommendations yet."),
    ).toBeDefined();

    expect(
      screen.getByRole("button", {
        name: "Find my matches",
      }),
    ).toBeDefined();

    savedBody = savedResults({
      recommendations: [],
      run: {
        id: "22222222-2222-4222-8222-222222222222",
        created_at: GENERATED_AT,
        completed_at: CHECKED_AT,
        result_count: 0,
        summary_count: 0,
        ranking_mode: null,
      },
    });

    statusBody = refreshStatus();

    await user.click(
      screen.getByRole("button", {
        name: "Check status",
      }),
    );

    await screen.findByText(
      "No saved matches are currently available.",
    );

    expect(
      screen.queryByText("No saved recommendations yet."),
    ).toBeNull();

    expect(
      screen
        .getByRole("link", {
          name: "Browse all jobs",
        })
        .getAttribute("href"),
    ).toBe("/jobs");

    expect(
      screen
        .getByRole("link", {
          name: "Review your profile",
        })
        .getAttribute("href"),
    ).toBe("/profile");

    expect(refreshRequests()).toHaveLength(0);
  });

  it("shows generation time separately from the last input check", async () => {
    await renderReady();

    const generated = screen
      .getByText("Generated:")
      .closest("p")
      ?.querySelector("time");

    const checked = screen
      .getByText("Last checked:")
      .closest("p")
      ?.querySelector("time");

    expect(generated?.getAttribute("datetime")).toBe(
      GENERATED_AT,
    );
    expect(checked?.getAttribute("datetime")).toBe(
      CHECKED_AT,
    );
  });

  it("queues a refresh and retains saved cards until replacement results arrive", async () => {
    const user = await renderReady();

    await user.click(
      screen.getByRole("button", {
        name: "Refresh recommendations",
      }),
    );

    await screen.findByText(
      "Refresh queued. Your saved recommendations remain available.",
    );

    expect(screen.getByText("Job 1")).toBeDefined();
    expect(refreshRequests()).toHaveLength(1);
    expect(refreshRequests()[0][1]?.method).toBe("POST");

    expect(
      screen.getByRole("button", {
        name: "Refresh pending",
      }).hasAttribute("disabled"),
    ).toBe(true);

    savedBody = savedResults({
      recommendations: [recommendation(2)],
    });
    statusBody = refreshStatus();

    await user.click(
      screen.getByRole("button", {
        name: "Check status",
      }),
    );

    await screen.findByText("Job 2");

    expect(screen.queryByText("Job 1")).toBeNull();
    expect(refreshRequests()).toHaveLength(1);

    const posts = fetchMock.mock.calls.filter(
      ([, options]) => options?.method === "POST",
    );

    expect(
      posts.map(([input]) => pathOf(input)),
    ).toEqual(["/api/recommendations/refresh"]);
  });

  it("prevents duplicate submissions while a refresh request is running", async () => {
    respondToRefresh = () =>
      new Promise<Response>(() => {});

    const user = await renderReady();

    await user.click(
      screen.getByRole("button", {
        name: "Refresh recommendations",
      }),
    );

    const button = screen.getByRole("button", {
      name: "Requesting refresh…",
    });

    expect(button.hasAttribute("disabled")).toBe(true);

    await user.click(button);

    expect(refreshRequests()).toHaveLength(1);
    expect(screen.getByText("Job 1")).toBeDefined();
  });

  it("keeps saved cards when the refresh request is rate limited", async () => {
    respondToRefresh = async () =>
      jsonResponse(
        {
          success: false,
          code: "RATE_LIMITED",
          error: "Please wait before requesting another refresh.",
        },
        429,
        {
          "Retry-After": "60",
        },
      );

    const user = await renderReady();

    await user.click(
      screen.getByRole("button", {
        name: "Refresh recommendations",
      }),
    );

    await screen.findByRole("alert");

    expect(screen.getByText("Job 1")).toBeDefined();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Refresh recommendations",
        }).hasAttribute("disabled"),
      ).toBe(false);
    });

    expect(refreshRequests()).toHaveLength(1);
  });

  it("keeps saved cards when a later status read fails", async () => {
    const user = await renderReady();

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          code: "LOAD_FAILED",
          error: "Unable to load recommendations.",
        },
        500,
      ),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Check status",
      }),
    );

    await screen.findByRole("alert");

    expect(screen.getByText("Job 1")).toBeDefined();
    expect(refreshRequests()).toHaveLength(0);
  });

  it.each([
    {
      status: "queued" as const,
      processingEnabled: false,
      message:
        "Refresh queued. Recommendation processing is currently paused.",
    },
    {
      status: "running" as const,
      processingEnabled: true,
      message:
        "Refreshing your recommendations. Your saved results remain available.",
    },
    {
      status: "retry_wait" as const,
      processingEnabled: true,
      message:
        "The last attempt did not finish. Another attempt is scheduled.",
    },
    {
      status: "failed" as const,
      processingEnabled: true,
      message:
        "The last refresh failed. You can request another refresh.",
    },
  ])(
    "explains $status while keeping saved cards",
    async ({ status, processingEnabled, message }) => {
      statusBody = refreshStatus({
        status,
        processing_enabled: processingEnabled,
        stale: true,
      });

      await renderReady();

      expect(screen.getByText(message)).toBeDefined();
      expect(screen.getByText("Job 1")).toBeDefined();
      expect(
        screen.getByText(
          "Your saved recommendations may be out of date.",
        ),
      ).toBeDefined();
    },
  );

  it("retries an initial read failure without queuing generation", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          code: "LOAD_FAILED",
          error: "Unable to load recommendations.",
        },
        500,
      ),
    );

    const user = userEvent.setup();
    render(<RecommendationsPanel />);

    await screen.findByRole("alert");

    await user.click(
      screen.getByRole("button", {
        name: "Try again",
      }),
    );

    await screen.findByText("Job 1");

    expect(refreshRequests()).toHaveLength(0);
  });

  it.each([
    {
      code: "MFA_REQUIRED",
      status: 403,
      label: "Verify with your authenticator",
      href: "/auth/mfa",
    },
    {
      code: "UNAUTHENTICATED",
      status: 401,
      label: "Sign in",
      href: "/auth/login",
    },
  ])(
    "provides the correct action for $code",
    async ({ code, status, label, href }) => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            code,
            error: "Account verification is required.",
          },
          status,
        ),
      );

      render(<RecommendationsPanel />);

      expect(
        (
          await screen.findByRole("link", {
            name: label,
          })
        ).getAttribute("href"),
      ).toBe(href);

      expect(
        screen.queryByRole("button", {
          name: "Try again",
        }),
      ).toBeNull();

      expect(refreshRequests()).toHaveLength(0);
    },
  );

  it("does not offer refresh actions to a non-seeker", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          code: "NOT_JOB_SEEKER",
          error: "Recommendations are available to job seekers.",
        },
        403,
      ),
    );

    render(<RecommendationsPanel />);

    await screen.findByRole("alert");

    expect(screen.queryByRole("button")).toBeNull();
    expect(refreshRequests()).toHaveLength(0);
  });

  it("handles a network failure with a read retry", async () => {
    fetchMock.mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );

    render(<RecommendationsPanel />);

    await screen.findByRole("alert");

    expect(
      screen.getByRole("button", {
        name: "Try again",
      }),
    ).toBeDefined();

    expect(refreshRequests()).toHaveLength(0);
  });
});