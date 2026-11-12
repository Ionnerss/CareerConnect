// @vitest-environment jsdom

/** Tests the recruiter's list of interviews: statuses, editing and cancelling. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecruiterInterviewsList } from "./recruiter-interviews-list";
import type { RecruiterInterview } from "@/lib/recruiter/interviews";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  cancelInterviewAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
}));

vi.mock("@/app/recruiter/interviews/actions", () => ({
  cancelInterviewAction: mocks.cancelInterviewAction,
}));

const NOW = "2026-11-12T20:00:00.000Z";

function interview(overrides: Partial<RecruiterInterview>): RecruiterInterview {
  return {
    id: "int-1",
    applicationId: "app-1",
    jobId: "job-1",
    jobTitle: "Software Dev",
    companyName: "Acme",
    applicantName: "Catalin B",
    scheduledAt: "2026-11-19T19:30:00Z",
    responseDeadline: "2026-11-17T22:00:00Z",
    durationMinutes: 30,
    location: null,
    meetingUrl: "https://meet.example.com/abc",
    notes: null,
    status: "pending",
    ...overrides,
  };
}

const interviews: RecruiterInterview[] = [
  interview({ id: "int-1", applicantName: "Catalin B", status: "pending" }),
  interview({ id: "int-2", applicantName: "Matthew L", status: "accepted", scheduledAt: "2026-11-20T15:00:00Z" }),
  interview({ id: "int-3", applicantName: "Dak S", status: "declined", scheduledAt: "2026-11-21T15:00:00Z" }),
  interview({ id: "int-4", applicantName: "Ray N", status: "cancelled", scheduledAt: "2026-11-22T15:00:00Z" }),
  interview({ id: "int-5", applicantName: null, status: "accepted", scheduledAt: "2026-11-01T15:00:00Z" }),
  interview({ id: "int-6", applicantName: "Erra T", status: "expired", scheduledAt: "2026-11-23T15:00:00Z" }),
];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

function card(name: string) {
  return screen.getByText(name).closest("li") as HTMLElement;
}

describe("RecruiterInterviewsList", () => {
  it("shows a friendly message when there are no interviews", () => {
    render(<RecruiterInterviewsList interviews={[]} now={NOW} />);

    expect(screen.getByText("No interviews yet.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Go to my job postings" }).getAttribute("href")).toBe("/recruiter/jobs");
  });

  it("splits upcoming interviews from past and cancelled ones", () => {
    render(<RecruiterInterviewsList interviews={interviews} now={NOW} />);

    const upcoming = within(screen.getByRole("region", { name: "Upcoming" }));
    const past = within(screen.getByRole("region", { name: "Past and cancelled" }));

    expect(upcoming.getByText("Catalin B")).toBeDefined();
    expect(upcoming.getByText("Matthew L")).toBeDefined();
    expect(upcoming.getByText("Dak S")).toBeDefined();
    expect(past.getByText("Ray N")).toBeDefined();
    expect(past.getByText("A candidate")).toBeDefined();
  });

  it("shows each interview's status, time and job", () => {
    render(<RecruiterInterviewsList interviews={interviews} now={NOW} />);

    expect(within(card("Catalin B")).getByText("Pending")).toBeDefined();
    expect(within(card("Matthew L")).getByText("Accepted")).toBeDefined();
    expect(within(card("Dak S")).getByText("Rejected")).toBeDefined();
    expect(within(card("Ray N")).getByText("Cancelled")).toBeDefined();
    expect(within(card("Erra T")).getByText("Expired")).toBeDefined();
    expect(within(card("Catalin B")).getByText(/Reply by/)).toBeDefined();
    expect(within(card("Matthew L")).queryByText(/Reply by/)).toBeNull();

    const time = within(card("Catalin B")).getByText("Thu, Nov 19, 2026, 2:30 PM");
    expect(time.tagName).toBe("TIME");
    expect(time.getAttribute("dateTime")).toBe("2026-11-19T19:30:00Z");
    expect(within(card("Catalin B")).getByText("Software Dev")).toBeDefined();
    expect(within(card("Catalin B")).getByRole("link", { name: "Meeting link" }).getAttribute("href")).toBe(
      "https://meet.example.com/abc",
    );
  });

  it("only offers reschedule and cancel on upcoming interviews that are not cancelled", () => {
    render(<RecruiterInterviewsList interviews={interviews} now={NOW} />);

    expect(
      screen.getByRole("link", { name: "Reschedule interview with Catalin B" }).getAttribute("href"),
    ).toBe("/recruiter/interviews/int-1/edit");
    expect(screen.queryByRole("link", { name: "Reschedule interview with Ray N" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel interview with A candidate" })).toBeNull();
  });

  it("offers a reschedule, not a cancel, for declined and expired invitations", () => {
    render(<RecruiterInterviewsList interviews={interviews} now={NOW} />);

    for (const name of ["Dak S", "Erra T"]) {
      expect(screen.getByRole("link", { name: `Reschedule interview with ${name}` })).toBeDefined();
      expect(screen.queryByRole("button", { name: `Cancel interview with ${name}` })).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Cancel interview with Matthew L" })).toBeDefined();
  });

  it("asks before cancelling and moves the interview to cancelled", async () => {
    mocks.cancelInterviewAction.mockResolvedValue({ success: true, interviewId: "int-1", jobId: null });
    const user = userEvent.setup();
    render(<RecruiterInterviewsList interviews={interviews} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "Cancel interview with Catalin B" }));
    expect(mocks.cancelInterviewAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Yes, cancel it" }));

    expect(mocks.cancelInterviewAction).toHaveBeenCalledWith("int-1");
    const past = within(await screen.findByRole("region", { name: "Past and cancelled" }));
    expect(within(past.getByText("Catalin B").closest("li") as HTMLElement).getByText("Cancelled")).toBeDefined();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("keeps the interview when the recruiter changes their mind", async () => {
    const user = userEvent.setup();
    render(<RecruiterInterviewsList interviews={interviews} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "Cancel interview with Catalin B" }));
    await user.click(screen.getByRole("button", { name: "Keep it" }));

    expect(mocks.cancelInterviewAction).not.toHaveBeenCalled();
    expect(within(card("Catalin B")).getByText("Pending")).toBeDefined();
  });

  it("shows an error if the interview cannot be cancelled", async () => {
    mocks.cancelInterviewAction.mockResolvedValue({ success: false, error: "This interview was not found." });
    const user = userEvent.setup();
    render(<RecruiterInterviewsList interviews={interviews} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "Cancel interview with Catalin B" }));
    await user.click(screen.getByRole("button", { name: "Yes, cancel it" }));

    expect((await screen.findByRole("alert")).textContent).toBe("This interview was not found.");
  });
});
