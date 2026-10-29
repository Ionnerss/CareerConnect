// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";
import { MAX_JOB_SEARCH_LENGTH } from "@/lib/validations/job-search";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getApplications: vi.fn(),
  getSummary: vi.fn(),
}));
vi.mock("next/font/google", () => ({ Plus_Jakarta_Sans: () => ({ className: "jakarta" }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/application_status/application_status_logic", () => ({ getUserApplications: mocks.getApplications }));
vi.mock("@/lib/dashboard/data", () => ({ getDashboardProfileSummary: mocks.getSummary }));
vi.mock("./dashboard-logout-button", () => ({ default: () => <button>Log out</button> }));

import DashboardPage from "@/app/dashboard/page";

function application(index: number, status: string | null = "In Progress"): ApplicationCardData {
  return {
    id: `fixture-${index}`, status, created_at: "2026-10-18T10:00:00Z",
    job: { title: `Test position ${index}`, firm_name: "Test company", location: "Test location", recruiter_name: "" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "test-user", email: "test@example.invalid" } } });
  mocks.getApplications.mockResolvedValue([]);
  mocks.getSummary.mockResolvedValue({ fullName: "Test Person", resumeCount: 1 });
});
afterEach(cleanup);

describe("dashboard presentation and server boundaries", () => {
  it("redirects signed-out visitors before fetching dashboard data", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(DashboardPage()).rejects.toThrow("redirect:/auth/login");
    expect(mocks.getApplications).not.toHaveBeenCalled();
    expect(mocks.getSummary).not.toHaveBeenCalled();
  });

  it("keeps the signed-in profile lookup and GET search contract", async () => {
    render(await DashboardPage());
    expect(mocks.getSummary).toHaveBeenCalledWith("test-user");
    const search = screen.getByRole("search");
    expect(search.getAttribute("action")).toBe("/jobs");
    expect(search.getAttribute("method")).toBe("get");
    const input = within(search).getByRole("searchbox", { name: "Search jobs" });
    expect(input.getAttribute("name")).toBe("q");
    expect(input.getAttribute("maxlength")).toBe(String(MAX_JOB_SEARCH_LENGTH));
    expect(screen.getByRole("link", { name: "Skip to dashboard" }).getAttribute("href")).toBe("#dashboard-main");
    expect(screen.getByRole("main").getAttribute("tabindex")).toBe("-1");
  });

  it("distinguishes a failed request from a real empty application list", async () => {
    mocks.getApplications.mockRejectedValue(new Error("test fetch failure"));
    render(await DashboardPage());
    expect(screen.getByRole("alert").textContent).toContain("couldn't load your applications");
    const totals = screen.getByRole("region", { name: "Your applications" });
    expect(within(totals).getAllByText("Unavailable")).toHaveLength(5);
    expect(within(totals).queryByText("0")).toBeNull();
    expect(screen.queryByText("You haven't applied to any jobs yet.")).toBeNull();
    expect(screen.queryByRole("region", { name: "Your next step" })).toBeNull();
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe("/dashboard");
  });

  it("keeps profile steps available during an application error without inventing an apply step", async () => {
    mocks.getApplications.mockRejectedValue(new Error("test fetch failure"));
    mocks.getSummary.mockResolvedValue({ fullName: null, resumeCount: 0 });
    render(await DashboardPage());
    const steps = screen.getByRole("region", { name: "Your next step" });
    const destinations = within(steps).getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(destinations).toEqual(["/profile", "/upload-resume"]);
  });

  it("shows true zero counts and an existing browse destination for an empty account", async () => {
    render(await DashboardPage());
    expect(within(screen.getByRole("region", { name: "Your applications" })).getAllByText("0")).toHaveLength(5);
    expect(screen.getByText("You haven't applied to any jobs yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse jobs" }).getAttribute("href")).toBe("/jobs");
  });

  it("keeps all-application totals, source ordering, the five-row limit and status labels", async () => {
    mocks.getApplications.mockResolvedValue([
      application(1, "Accepted"), application(2, "Interview"), application(3, "Rejected"),
      application(4, null), application(5), application(6),
    ]);
    render(await DashboardPage());
    const recent = screen.getByRole("region", { name: "Recent applications" });
    expect(within(recent).getAllByRole("listitem")).toHaveLength(5);
    expect(within(recent).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(
      [1, 2, 3, 4, 5].map((index) => `Test position ${index}`),
    );
    expect(within(recent).getByText("Latest 5 of 6")).toBeTruthy();
    for (const label of ["Offer", "Interview", "Rejected", "Unknown", "In Progress"]) {
      expect(within(recent).getByText(label)).toBeTruthy();
    }
    expect(within(screen.getByRole("region", { name: "Your applications" })).getByText("6")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Your next step" })).toBeNull();
  });

  it("preserves missing-job/date fallbacks and unknown status text", async () => {
    mocks.getApplications.mockResolvedValue([{ ...application(1, "Custom status"), job: null, created_at: "invalid" }]);
    render(await DashboardPage());
    expect(screen.getByText("Position not specified")).toBeTruthy();
    expect(screen.getByText("Company not specified · Location not specified")).toBeTruthy();
    expect(screen.getByText("Custom status")).toBeTruthy();
    expect(screen.getByText("Date not available")).toBeTruthy();
  });
});
