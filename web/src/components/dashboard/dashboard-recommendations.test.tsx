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
  SavedRecommendationResults,
} from "@/lib/recommendations/refresh-client";
import DashboardRecommendations from "./dashboard-recommendations";

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

function recommendation(index: number, score: number) {
  const suffix = String(index).padStart(12, "0");

  return {
    job: {
      id: `33333333-3333-4333-8333-${suffix}`,
      title: `Job ${index}`,
      firm_name: `Company ${index}`,
      location: "Montreal",
      work_mode: "hybrid",
      employment_type: "full_time",
      required_skills: "React",
      salary: null,
      experience: null,
      description: null,
      status: "open",
      created_at: "2026-11-26T12:00:00.000Z",
    },
    score,
    match_score: score,
    fit: null,
    fit_error: null,
    fit_generated_at: null,
    skill_match: null,
    reasons: [],
    summary: null,
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
      result_count: 7,
      summary_count: 0,
      ranking_mode: "ai",
    },
    recommendations: [92, 85, 74, 66, 58, 51, 40].map(
      (score, index) => recommendation(index + 1, score),
    ),
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

  render(<DashboardRecommendations />);

  await screen.findByRole("button", {
    name: /^(Refresh matches|Find my matches|Refresh pending)$/,
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

describe("DashboardRecommendations", () => {
  it("loads saved matches on mount using reads only", async () => {
    await renderReady();

    expect(
      screen.getByRole("heading", {
        name: "Recommended for you",
      }),
    ).toBeDefined();

    expect(
      screen
        .getByRole("link", {
          name: "See all recommendations",
        })
        .getAttribute("href"),
    ).toBe("/jobs/recommendations");

    expect(
      screen.getByRole("list", {
        name: "Your top job matches",
      }),
    ).toBeDefined();

    expect(refreshRequests()).toHaveLength(0);

    for (const [, options] of fetchMock.mock.calls) {
      expect(options?.method ?? "GET").toBe("GET");
    }

    expect(
      fetchMock.mock.calls.map(([input]) => pathOf(input)),
    ).toEqual([
      "/api/recommendations/status",
      "/api/recommendations",
    ]);
  });

  it("describes initial loading as reading saved recommendations", () => {
    fetchMock.mockImplementation(
      () => new Promise<Response>(() => {}),
    );

    render(<DashboardRecommendations />);

    expect(screen.getByRole("status").textContent).toContain(
      "Loading your saved recommendations",
    );

    expect(
      screen.queryByText(/Finding your best matches/),
    ).toBeNull();

    expect(refreshRequests()).toHaveLength(0);
  });

  it("shows at most five jobs in saved order with posting and apply links", async () => {
    await renderReady();

    const list = screen.getByRole("list", {
      name: "Your top job matches",
    });
    const rows = within(list).getAllByRole("listitem");

    expect(rows).toHaveLength(5);
    expect(rows[0].textContent).toContain("Job 1");
    expect(rows[0].textContent).toContain("Company 1 · Montreal");
    expect(rows[0].textContent).toContain("92% · Strong match");
    expect(rows[2].textContent).toContain("74% · Good match");
    expect(rows[4].textContent).toContain("58% · Possible match");

    expect(screen.queryByText("Job 6")).toBeNull();
    expect(screen.queryByText("Job 7")).toBeNull();

    for (let index = 0; index < rows.length; index += 1) {
      const number = index + 1;
      const item = recommendation(number, 70);

      expect(
        within(rows[index])
          .getByRole("link", {
            name: `View posting for Job ${number}`,
          })
          .getAttribute("href"),
      ).toBe(
        `/jobs?selectedJob=${encodeURIComponent(item.job.id)}`,
      );

      expect(
        within(rows[index])
          .getByRole("link", {
            name: `Apply for Job ${number}`,
          })
          .getAttribute("href"),
      ).toBe(
        `/jobs/${encodeURIComponent(item.job.id)}/apply`,
      );
    }
  });

  it("fills in missing job details", async () => {
    const base = recommendation(1, 70);

    savedBody = savedResults({
      recommendations: [
        {
          ...base,
          job: {
            ...base.job,
            title: "  ",
            firm_name: null,
            location: null,
          },
        },
      ],
    });

    await renderReady();

    const row = within(
      screen.getByRole("list", {
        name: "Your top job matches",
      }),
    ).getByRole("listitem");

    expect(row.textContent).toContain("Untitled position");
    expect(row.textContent).toContain("Company not listed");
  });

  it("offers the first refresh when there is no saved run", async () => {
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
      screen
        .getByRole("link", {
          name: "Review your profile",
        })
        .getAttribute("href"),
    ).toBe("/profile");

    expect(refreshRequests()).toHaveLength(0);

    await user.click(
      screen.getByRole("button", {
        name: "Find my matches",
      }),
    );

    await screen.findByText(
      "Refresh queued. Your saved matches remain available.",
    );

    expect(refreshRequests()).toHaveLength(1);
  });

  it("handles an empty saved result without diagnosing an empty profile", async () => {
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

    await renderReady();

    expect(
      screen.getByText(
        "No saved matches are currently available.",
      ),
    ).toBeDefined();

    expect(
      screen
        .getByRole("link", {
          name: "Browse jobs",
        })
        .getAttribute("href"),
    ).toBe("/jobs");

    expect(
      screen.queryByText(/Complete your profile to get/),
    ).toBeNull();

    expect(
      screen.getByRole("button", {
        name: "Refresh matches",
      }),
    ).toBeDefined();
  });

  it.each(["code_only", "mixed"] as const)(
    "explains saved fallback scoring for %s runs",
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

  it("shows original generation time separately from the last check", async () => {
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

  it("queues a refresh while keeping saved matches visible", async () => {
    const user = await renderReady();

    await user.click(
      screen.getByRole("button", {
        name: "Refresh matches",
      }),
    );

    await screen.findByText(
      "Refresh queued. Your saved matches remain available.",
    );

    expect(refreshRequests()).toHaveLength(1);
    expect(refreshRequests()[0][1]?.method).toBe("POST");

    expect(
      screen.getByRole("list", {
        name: "Your top job matches",
      }),
    ).toBeDefined();

    expect(
      screen.getByRole("button", {
        name: "Refresh pending",
      }).hasAttribute("disabled"),
    ).toBe(true);

    const posts = fetchMock.mock.calls.filter(
      ([, options]) => options?.method === "POST",
    );

    expect(
      posts.map(([input]) => pathOf(input)),
    ).toEqual(["/api/recommendations/refresh"]);
  });

  it("explains that queued processing is paused", async () => {
    statusBody = refreshStatus({
      status: "queued",
      stale: true,
      manual_pending: true,
      processing_enabled: false,
    });

    await renderReady();

    expect(
      screen.getByText(
        "Refresh queued. Recommendation processing is currently paused.",
      ),
    ).toBeDefined();

    expect(
      screen.getByRole("list", {
        name: "Your top job matches",
      }),
    ).toBeDefined();

    expect(
      screen.getByRole("button", {
        name: "Check status",
      }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("keeps saved matches when a refresh request is rate limited", async () => {
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
        name: "Refresh matches",
      }),
    );

    expect(await screen.findByRole("alert")).toBeDefined();

    expect(
      screen.getByRole("list", {
        name: "Your top job matches",
      }),
    ).toBeDefined();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Refresh matches",
        }).hasAttribute("disabled"),
      ).toBe(false);
    });

    expect(refreshRequests()).toHaveLength(1);
  });

  it("disables duplicate refresh submissions while the request is running", async () => {
    respondToRefresh = () =>
      new Promise<Response>(() => {});

    const user = await renderReady();
    const button = screen.getByRole("button", {
      name: "Refresh matches",
    });

    await user.click(button);

    const requesting = screen.getByRole("button", {
      name: "Requesting refresh…",
    });

    expect(requesting.hasAttribute("disabled")).toBe(true);

    await user.click(requesting);

    expect(refreshRequests()).toHaveLength(1);

    expect(
      screen.getByRole("list", {
        name: "Your top job matches",
      }),
    ).toBeDefined();
  });

  it("checks status without queuing another refresh", async () => {
    const user = await renderReady();

    fetchMock.mockClear();

    await user.click(
      screen.getByRole("button", {
        name: "Check status",
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(
      fetchMock.mock.calls.map(([input]) => pathOf(input)),
    ).toEqual([
      "/api/recommendations/status",
      "/api/recommendations",
    ]);

    expect(refreshRequests()).toHaveLength(0);

    for (const [, options] of fetchMock.mock.calls) {
      expect(options?.method ?? "GET").toBe("GET");
    }
  });

  it("retries an initial read failure without requesting generation", async () => {
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
    render(<DashboardRecommendations />);

    await screen.findByRole("alert");

    await user.click(
      screen.getByRole("button", {
        name: "Try again",
      }),
    );

    expect(
      await screen.findByRole("list", {
        name: "Your top job matches",
      }),
    ).toBeDefined();

    expect(refreshRequests()).toHaveLength(0);
  });

  it.each([
    {
      code: "MFA_REQUIRED",
      status: 403,
      label: "Verify your account",
      href: "/auth/mfa",
    },
    {
      code: "UNAUTHENTICATED",
      status: 401,
      label: "Log in again",
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

      render(<DashboardRecommendations />);

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

  it("does not offer a refresh to a non-seeker", async () => {
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

    render(<DashboardRecommendations />);

    await screen.findByRole("alert");

    expect(
      screen.queryByRole("button", {
        name: /Refresh matches|Find my matches|Try again/,
      }),
    ).toBeNull();

    expect(refreshRequests()).toHaveLength(0);
  });

  it("explains a failed refresh while retaining saved matches", async () => {
    statusBody = refreshStatus({
      status: "failed",
      stale: true,
      attempt_count: 3,
      last_failure_code: "generation_failed",
    });

    await renderReady();

    expect(
      screen.getByText(
        "The last refresh failed. You can request another refresh.",
      ),
    ).toBeDefined();

    expect(
      screen.getByRole("list", {
        name: "Your top job matches",
      }),
    ).toBeDefined();

    expect(
      screen.getByRole("button", {
        name: "Refresh matches",
      }).hasAttribute("disabled"),
    ).toBe(false);
  });
});