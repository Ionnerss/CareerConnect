// @vitest-environment jsdom

/**
 * Tests the Application Analytics page: status summary, the activity chart
 * and its time ranges, the history list, the empty state and links.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";
import { AnalyticsDashboard } from "./analytics-dashboard";

const NOW = new Date(2026, 10, 9, 12, 30); // Nov 9, 2026

function application(
  id: string,
  status: string,
  daysAgo: number,
  title = `Job ${id}`,
): ApplicationCardData {
  return {
    id,
    status,
    created_at: new Date(2026, 10, 9 - daysAgo, 12).toISOString(),
    job: { title, firm_name: "Acme Inc.", location: "Montreal", recruiter_name: "Recruiter" },
  };
}

const sample: ApplicationCardData[] = [
  application("1", "In Progress", 1, "Frontend Developer"),
  application("2", "Interview", 3, "Backend Developer"),
  application("3", "Accepted", 20, "Data Analyst"),
  application("4", "Rejected", 60, "QA Tester"),
];

afterEach(() => {
  cleanup();
});

describe("AnalyticsDashboard", () => {
  it("shows how many applications are in each status", () => {
    render(<AnalyticsDashboard applications={sample} now={NOW} />);

    const summary = screen.getByRole("region", { name: "Applications by status" });
    const value = (label: string) =>
      within(summary).getByText(label).closest("div")?.querySelector("dd")?.textContent;

    expect(value("Total")).toBe("4");
    expect(value("Pending")).toBe("1");
    expect(value("Interviews")).toBe("1");
    expect(value("Offers")).toBe("1");
    expect(value("Rejected")).toBe("1");
  });

  it("charts the last 30 days by default and lists that history newest first", () => {
    render(<AnalyticsDashboard applications={sample} now={NOW} />);

    expect(screen.getByRole("button", { name: "30 days" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("3 applications in the last 30 days")).toBeDefined();
    expect(screen.getAllByTestId("chart-bar")).toHaveLength(30);

    const history = within(screen.getByRole("list", { name: "Application history" }));
    expect(history.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Frontend Developer"),
      expect.stringContaining("Backend Developer"),
      expect.stringContaining("Data Analyst"),
    ]);
  });

  it("labels In Progress as Pending and Accepted as Offer in the history", () => {
    render(<AnalyticsDashboard applications={sample} now={NOW} />);

    const history = within(screen.getByRole("list", { name: "Application history" }));
    expect(history.getByText("Pending")).toBeDefined();
    expect(history.getByText("Offer")).toBeDefined();
  });

  it("changes the chart and history when another time range is picked", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard applications={sample} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "7 days" }));
    expect(screen.getByRole("button", { name: "7 days" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("2 applications in the last 7 days")).toBeDefined();
    expect(screen.getAllByTestId("chart-bar")).toHaveLength(7);

    await user.click(screen.getByRole("button", { name: "1 year" }));
    expect(screen.getByText("4 applications in the last 12 months")).toBeDefined();
    expect(screen.getAllByTestId("chart-bar")).toHaveLength(13);
  });

  it("explains when the chosen range has no applications", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard applications={sample} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "1 day" }));

    expect(
      screen.getByText("No applications in the last 24 hours. Try a longer time range."),
    ).toBeDefined();
    expect(screen.queryByRole("list", { name: "Application history" })).toBeNull();
  });

  it("shows an empty state with a link to jobs when there are no applications", () => {
    render(<AnalyticsDashboard applications={[]} now={NOW} />);

    expect(screen.getByText("You haven't applied to any jobs yet.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Browse jobs" }).getAttribute("href")).toBe("/jobs");
    expect(screen.queryAllByTestId("chart-bar")).toHaveLength(0);
  });

  it("shows an error when applications could not be loaded", () => {
    render(<AnalyticsDashboard applications={[]} loadError now={NOW} />);

    expect(screen.getByRole("alert").textContent).toContain("couldn't load your applications");
    expect(screen.queryByText("You haven't applied to any jobs yet.")).toBeNull();
  });

  it("links back to the dashboard and to the application status page", () => {
    render(<AnalyticsDashboard applications={sample} now={NOW} />);

    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("link", { name: "View application status" }).getAttribute("href")).toBe(
      "/application-status",
    );
  });

  it("shows at most 10 applications in the history and links to the rest", () => {
    const many = Array.from({ length: 12 }, (_, index) => application(`m${index}`, "In Progress", index));
    render(<AnalyticsDashboard applications={many} now={NOW} />);

    const history = within(screen.getByRole("list", { name: "Application history" }));
    expect(history.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByRole("link", { name: "View all 12" }).getAttribute("href")).toBe("/application-status");
  });
});
