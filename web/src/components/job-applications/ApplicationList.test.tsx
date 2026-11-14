// @vitest-environment jsdom

/** Tests that a notification opens the page of the list that shows its application (#257). */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ApplicationList, { getPageForApplication } from "./ApplicationList";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";

const applications: ApplicationCardData[] = Array.from({ length: 14 }, (_, index) => ({
  id: `app-${index + 1}`,
  status: "In Progress",
  created_at: "2026-11-01T15:00:00Z",
  job: {
    title: `Job ${index + 1}`,
    firm_name: "Acme",
    location: "Montreal",
    recruiter_name: "Matthew L",
  },
}));

afterEach(() => {
  cleanup();
});

describe("getPageForApplication", () => {
  it("finds the page (6 per page) that holds the application", () => {
    expect(getPageForApplication(applications, "app-1")).toBe(1);
    expect(getPageForApplication(applications, "app-6")).toBe(1);
    expect(getPageForApplication(applications, "app-7")).toBe(2);
    expect(getPageForApplication(applications, "app-14")).toBe(3);
  });

  it("starts on the first page when there is no id or it isn't in the list", () => {
    expect(getPageForApplication(applications, undefined)).toBe(1);
    expect(getPageForApplication(applications, "missing")).toBe(1);
  });
});

describe("ApplicationList", () => {
  it("opens on the page with the highlighted application", () => {
    render(<ApplicationList applications={applications} highlightId="app-9" />);

    expect(screen.getByText("Job 9")).toBeDefined();
    expect(screen.queryByText("Job 1")).toBeNull();
  });

  it("opens on the first page by default", () => {
    render(<ApplicationList applications={applications} />);

    expect(screen.getByText("Job 1")).toBeDefined();
    expect(screen.queryByText("Job 9")).toBeNull();
  });
});
