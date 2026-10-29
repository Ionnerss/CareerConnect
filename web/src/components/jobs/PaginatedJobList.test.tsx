/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaginatedJobList from "./PaginatedJobList";
import type { JobSearchResult } from "@/lib/jobs/search";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("q=developer&location=Montreal"),
}));

const job: JobSearchResult = {
  id: "job-1",
  title: "Frontend developer",
  firm_name: "CareerConnect",
  location: "Montreal",
  description: "Build accessible interfaces.",
  required_skills: "React, TypeScript",
  salary: 65000,
  status: "open",
  created_at: "2026-10-28T12:00:00Z",
};

let desktop: boolean;
let breakpointListeners: Set<() => void>;

beforeEach(() => {
  desktop = false;
  breakpointListeners = new Set();
  push.mockClear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() { return query === "(min-width: 1024px)" && desktop; },
    addEventListener: (_type: string, listener: () => void) => breakpointListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => breakpointListeners.delete(listener),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderJobs() {
  render(<PaginatedJobList jobs={[job]} query="developer" page={1} totalCount={12} />);
  return screen.getByRole("button", { name: /Frontend developer/ });
}

describe("job details drawer", () => {
  it("contains keyboard focus, preserves the apply link, and restores focus on Escape", async () => {
    const user = userEvent.setup();
    const card = renderJobs();
    await user.click(card);

    const dialog = await screen.findByRole("dialog", { name: "Selected job details" });
    const close = within(dialog).getByRole("button", { name: "Close job details" });
    const apply = within(dialog).getByRole("link", { name: "Apply for this job" });
    expect(apply.getAttribute("href")).toBe("/jobs/job-1/apply");
    await waitFor(() => expect(document.activeElement).toBe(close));
    await user.tab({ shift: true });
    await waitFor(() => expect(document.activeElement).toBe(apply));
    await user.tab();
    await waitFor(() => expect(document.activeElement).toBe(close));

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(card));
  });

  it("dismisses with the close control and when switching to desktop", async () => {
    const user = userEvent.setup();
    const card = renderJobs();
    await user.click(card);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Close job details" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(card);
    await screen.findByRole("dialog");
    desktop = true;
    act(() => breakpointListeners.forEach((listener) => listener()));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps desktop selection inline and preserves URL filters during pagination", async () => {
    desktop = true;
    const user = userEvent.setup();
    await user.click(renderJobs());
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(push).toHaveBeenCalledWith("/jobs?q=developer&location=Montreal&page=2", { scroll: false });
  });
});
