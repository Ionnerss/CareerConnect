// @vitest-environment jsdom

/** Tests the recruiter's list of new-application notifications. */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ApplicationNotifications } from "./application-notifications";
import type { ApplicationNotification } from "@/lib/recruiter/notifications";

const NOW = new Date("2026-11-09T20:00:00Z");

const notifications: ApplicationNotification[] = [
  {
    id: "app-2",
    jobId: "job-1",
    jobTitle: "Software Dev",
    applicantName: "Catalin B",
    createdAt: "2026-11-09T17:00:00Z",
  },
  {
    id: "app-1",
    jobId: "job-2",
    jobTitle: "Data Analyst",
    applicantName: null,
    createdAt: "2026-11-08T12:00:00Z",
  },
];

afterEach(() => {
  cleanup();
});

describe("ApplicationNotifications", () => {
  it("shows who applied for which position, newest first", () => {
    render(<ApplicationNotifications notifications={notifications} now={NOW} />);

    const items = within(screen.getByRole("list", { name: "Notifications" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Catalin B applied for your Software Dev position.");
    expect(items[1].textContent).toContain("A candidate applied for your Data Analyst position.");
  });

  it("shows when each notification was posted, with the full date on hover", () => {
    render(<ApplicationNotifications notifications={notifications} now={NOW} />);

    const time = screen.getByText("3 hours ago");
    expect(time.tagName).toBe("TIME");
    expect(time.getAttribute("dateTime")).toBe("2026-11-09T17:00:00Z");
    expect(time.getAttribute("title")).toBe("Nov 9, 2026, 12:00 PM");
    expect(screen.getByText("Yesterday")).toBeDefined();
  });

  it("links each notification to the applicants of that posting", () => {
    render(<ApplicationNotifications notifications={notifications} now={NOW} />);

    expect(
      screen.getByRole("link", { name: "View applicants for Software Dev" }).getAttribute("href"),
    ).toBe("/recruiter/jobs/job-1/applicants");
    expect(
      screen.getByRole("link", { name: "View applicants for Data Analyst" }).getAttribute("href"),
    ).toBe("/recruiter/jobs/job-2/applicants");
  });

  it("shows a friendly message when there are no notifications", () => {
    render(<ApplicationNotifications notifications={[]} now={NOW} />);

    expect(screen.getByText("No notifications yet.")).toBeDefined();
    expect(screen.queryByRole("list", { name: "Notifications" })).toBeNull();
  });
});
