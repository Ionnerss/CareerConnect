// @vitest-environment jsdom

/** Tests the form recruiters use to schedule and edit interviews. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InterviewForm } from "./interview-form";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  createInterviewAction: vi.fn(),
  updateInterviewAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("@/app/recruiter/interviews/actions", () => ({
  createInterviewAction: mocks.createInterviewAction,
  updateInterviewAction: mocks.updateInterviewAction,
}));

const details = {
  jobTitle: "Software Dev",
  companyName: "Acme",
  employerName: "Matthew L",
  applicantName: "Catalin B",
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

async function fillValidForm() {
  const user = userEvent.setup();
  // Date inputs are filled in one go, like the browser picker does.
  fireEvent.change(screen.getByLabelText("Date and time"), { target: { value: "2099-11-19T14:30" } });
  fireEvent.change(screen.getByLabelText("Reply by"), { target: { value: "2099-11-17T17:00" } });
  await user.selectOptions(screen.getByLabelText("Duration"), "45");
  await user.type(screen.getByLabelText("Meeting link"), "https://meet.example.com/abc");
  await user.type(screen.getByLabelText("Notes for the applicant"), "Bring your ID");
  return user;
}

describe("InterviewForm", () => {
  it("shows the job title, company, employer and job seeker", () => {
    render(<InterviewForm applicationId="app-1" details={details} cancelHref="/back" />);

    for (const text of ["Software Dev", "Acme", "Matthew L", "Catalin B"]) {
      expect(screen.getByText(text)).toBeDefined();
    }
    expect(screen.getByRole("link", { name: "Go back" }).getAttribute("href")).toBe("/back");
  });

  it("stops a reply deadline that is after the interview", async () => {
    render(<InterviewForm applicationId="app-1" details={details} cancelHref="/back" />);

    const user = await fillValidForm();
    fireEvent.change(screen.getByLabelText("Reply by"), { target: { value: "2099-11-20T09:00" } });
    await user.click(screen.getByRole("button", { name: "Send interview" }));

    expect(screen.getByText("The reply deadline must be before the interview.")).toBeDefined();
    expect(mocks.createInterviewAction).not.toHaveBeenCalled();
  });

  it("explains what is missing and does not send an empty form", async () => {
    const user = userEvent.setup();
    render(<InterviewForm applicationId="app-1" details={details} cancelHref="/back" />);

    await user.click(screen.getByRole("button", { name: "Send interview" }));

    expect(screen.getByText("Choose a valid date and time.")).toBeDefined();
    expect(screen.getByText("Choose when the applicant must reply by.")).toBeDefined();
    expect(screen.getByText("Choose how long the interview will last.")).toBeDefined();
    expect(screen.getByLabelText("Date and time").getAttribute("aria-invalid")).toBe("true");
    expect(mocks.createInterviewAction).not.toHaveBeenCalled();
  });

  it("sends the interview and goes to the interviews page", async () => {
    mocks.createInterviewAction.mockResolvedValue({ success: true, interviewId: "int-1", jobId: "job-1" });
    render(<InterviewForm applicationId="app-1" details={details} cancelHref="/back" />);

    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Send interview" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/recruiter/interviews"));
    expect(mocks.createInterviewAction).toHaveBeenCalledWith("app-1", {
      scheduledAt: "2099-11-19T14:30",
      responseDeadline: "2099-11-17T17:00",
      durationMinutes: "45",
      location: "",
      meetingUrl: "https://meet.example.com/abc",
      notes: "Bring your ID",
    });
  });

  it("shows the server's error and field errors when saving fails", async () => {
    mocks.createInterviewAction.mockResolvedValue({
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { scheduledAt: "Choose a date and time in the future." },
    });
    render(<InterviewForm applicationId="app-1" details={details} cancelHref="/back" />);

    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Send interview" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Please fix the highlighted fields.");
    expect(screen.getByText("Choose a date and time in the future.")).toBeDefined();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("only lets the time and reply deadline change when rescheduling", async () => {
    mocks.updateInterviewAction.mockResolvedValue({ success: true, interviewId: "int-1", jobId: "job-1" });
    const user = userEvent.setup();
    render(
      <InterviewForm
        interviewId="int-1"
        details={details}
        cancelHref="/recruiter/interviews"
        initialValues={{
          scheduledAt: "2099-11-19T14:30",
          responseDeadline: "2099-11-17T17:00",
          durationMinutes: "60",
          location: "Room 2.101",
          meetingUrl: "",
          notes: "",
        }}
      />,
    );

    const location = screen.getByLabelText("Location") as HTMLInputElement;
    expect(location.value).toBe("Room 2.101");
    expect(location.disabled).toBe(true);
    expect((screen.getByLabelText("Duration") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Date and time") as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByText(/sends the applicant a new invitation/)).toBeDefined();

    fireEvent.change(screen.getByLabelText("Date and time"), { target: { value: "2099-11-20T10:00" } });
    await user.click(screen.getByRole("button", { name: "Reschedule" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/recruiter/interviews"));
    expect(mocks.updateInterviewAction).toHaveBeenCalledWith(
      "int-1",
      expect.objectContaining({ scheduledAt: "2099-11-20T10:00", location: "Room 2.101" }),
    );
    expect(mocks.createInterviewAction).not.toHaveBeenCalled();
  });
});
