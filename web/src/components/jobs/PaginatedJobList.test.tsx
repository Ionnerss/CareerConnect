// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PaginatedJobList from "./PaginatedJobList";
import type { JobSearchResult } from "@/lib/jobs/search";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams("page=1"),
}));

afterEach(cleanup);

function job(id: string, title: string): JobSearchResult {
  return {
    id,
    title,
    firm_name: "Example Company",
    location: "Montreal",
    description: "Job description",
    required_skills: "TypeScript",
    salary: 60000,
    status: "open",
    created_at: "2026-11-01T00:00:00Z",
  };
}

describe("PaginatedJobList posting links", () => {
  it("shows the linked job even when it is absent from the current page", () => {
    render(
      <PaginatedJobList
        jobs={[job("job-a", "Job A")]}
        linkedJob={job("job-b", "Job B")}
        query=""
        page={1}
        totalCount={7}
      />
    );

    const details = screen.getAllByRole("region", {
        name: "Job details",
    });

    expect(details).toHaveLength(2);

    for (const detail of details) {
        expect(detail.textContent).toContain("Job B");
        expect(detail.textContent).not.toContain("Job A");
    }

    const applyLinks = screen.getAllByRole("link", {
        name: "Apply for this job",
    });

    expect(applyLinks).toHaveLength(2);

    for (const link of applyLinks) {
        expect(link.getAttribute("href")).toBe("/jobs/job-b/apply");
    }
  });

  it("shows a linked job when the current search has no results", () => {
    render(
      <PaginatedJobList
        jobs={[]}
        linkedJob={job("job-b", "Job B")}
        query="unrelated search"
        page={1}
        totalCount={0}
      />
    );

    expect(screen.getByRole("heading", { name: "Job B" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Apply for this job" }).getAttribute("href")
    ).toBe("/jobs/job-b/apply");
  });
});