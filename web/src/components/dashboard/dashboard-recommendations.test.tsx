// @vitest-environment jsdom

/** Tests the "Recommended for you" card on the dashboard (#101 / #203). */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardRecommendations from "./dashboard-recommendations";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function recommendation(index: number, score: number) {
  return {
    job: {
      id: `job-${index}`,
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
      created_at: "2026-11-10T12:00:00Z",
    },
    score,
    match_score: score,
    fit: null,
    skill_match: null,
    reasons: [],
    summary: null,
  };
}

function success(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    empty_profile: false,
    considered_jobs: 17,
    recommendations: [92, 85, 74, 66, 58, 51, 40].map((score, index) => recommendation(index + 1, score)),
    ai_ranked: true,
    summary_status: "ok",
    ...overrides,
  };
}

async function openMatches() {
  const user = userEvent.setup();
  render(<DashboardRecommendations />);
  await user.click(screen.getByRole("button", { name: "Show my top matches" }));
  return user;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DashboardRecommendations", () => {
  it("does not call the AI until the seeker asks", () => {
    render(<DashboardRecommendations />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Recommended for you" })).toBeDefined();
    expect(screen.getByRole("link", { name: "See all recommendations" }).getAttribute("href")).toBe(
      "/jobs/recommendations",
    );
  });

  it("shows a loading message while the request runs", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    await openMatches();

    expect(screen.getByRole("status").textContent).toContain("Finding your best matches");
    expect(screen.queryByRole("button", { name: "Show my top matches" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/recommendations", expect.objectContaining({ method: "POST" }));
  });

  it("shows at most 5 jobs, best first, each with its score and an apply link", async () => {
    fetchMock.mockResolvedValue(jsonResponse(success()));

    await openMatches();

    const list = await screen.findByRole("list", { name: "Your top job matches" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0].textContent).toContain("Job 1");
    expect(items[0].textContent).toContain("Company 1 · Montreal");
    expect(items[0].textContent).toContain("92% · Strong match");
    expect(items[2].textContent).toContain("74% · Good match");
    expect(items[4].textContent).toContain("58% · Possible match");
    expect(screen.queryByText("Job 6")).toBeNull();

    expect(within(items[0]).getByRole("link", { name: "View and apply for Job 1" }).getAttribute("href")).toBe(
      "/jobs/job-1/apply",
    );
    expect(screen.getByText(/Picked from 17 open jobs/)).toBeDefined();
  });

  it("asks again when the seeker presses Refresh", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(success()));

    const user = await openMatches();
    await screen.findByRole("list", { name: "Your top job matches" });
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await screen.findByRole("list", { name: "Your top job matches" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("says when the order comes from the profile match only", async () => {
    fetchMock.mockResolvedValue(jsonResponse(success({ ai_ranked: false })));

    await openMatches();

    expect(await screen.findByText(/AI ranking is unavailable right now/)).toBeDefined();
  });

  it("sends a seeker with an empty profile to their profile", async () => {
    fetchMock.mockResolvedValue(jsonResponse(success({ empty_profile: true, recommendations: [] })));

    await openMatches();

    expect((await screen.findByRole("link", { name: "Complete your profile" })).getAttribute("href")).toBe("/profile");
  });

  it("suggests browsing jobs when nothing matches", async () => {
    fetchMock.mockResolvedValue(jsonResponse(success({ recommendations: [] })));

    await openMatches();

    expect(await screen.findByText("No matching open jobs right now.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Browse jobs" }).getAttribute("href")).toBe("/jobs");
  });

  it("shows the error and lets the seeker try again", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ success: false, code: "AI_NOT_CONFIGURED", error: "AI recommendations are not set up on the server yet." }, 503),
      )
      .mockResolvedValueOnce(jsonResponse(success()));

    const user = await openMatches();

    expect((await screen.findByRole("alert")).textContent).toContain("AI recommendations are not set up on the server yet.");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("list", { name: "Your top job matches" })).toBeDefined();
  });

  it("sends the seeker to MFA when the endpoint asks for it", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, code: "MFA_REQUIRED", error: "Please finish two-step verification." }, 403),
    );

    await openMatches();

    expect((await screen.findByRole("link", { name: "Verify your account" })).getAttribute("href")).toBe("/auth/mfa");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("sends a signed-out seeker to log in", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, code: "UNAUTHENTICATED", error: "Please log in." }, 401));

    await openMatches();

    expect((await screen.findByRole("link", { name: "Log in again" })).getAttribute("href")).toBe("/auth/login");
  });

  it("shows a connection error when the server can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await openMatches();

    expect((await screen.findByRole("alert")).textContent).toContain("We could not reach the server");
  });

  it("fills in missing job details", async () => {
    const base = recommendation(1, 70);
    const item = { ...base, job: { ...base.job, title: "  ", firm_name: null, location: null } };
    fetchMock.mockResolvedValue(jsonResponse(success({ recommendations: [item], considered_jobs: 1 })));

    await openMatches();

    const row = within(await screen.findByRole("list", { name: "Your top job matches" })).getByRole("listitem");
    expect(row.textContent).toContain("Untitled position");
    expect(row.textContent).toContain("Company not listed");
    expect(row.textContent).not.toContain("·  ");
    expect(screen.getByText(/Picked from 1 open job\./)).toBeDefined();
  });
});
