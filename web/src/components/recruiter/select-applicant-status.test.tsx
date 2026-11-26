// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicantStatusSelect from "./select-applicant-status";

const mocks = vi.hoisted(() => ({ updateApplicantStatus: vi.fn() }));

vi.mock("@/app/recruiter/jobs/[jobId]/applicants/actions", () => ({
  updateApplicantStatus: mocks.updateApplicantStatus,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(cleanup);

function renderSelect() {
  render(<ApplicantStatusSelect applicationId="app-1" jobId="job-1" initialStatus="In Progress" />);
  return screen.getByRole("combobox") as HTMLSelectElement;
}

describe("ApplicantStatusSelect", () => {
  it("offers every application status and starts on the current one", () => {
    const select = renderSelect();

    expect(select.value).toBe("In Progress");
    expect([...select.options].map((option) => option.value)).toEqual([
      "In Progress",
      "Interview",
      "Accepted",
      "Rejected",
    ]);
  });

  it("saves the new status for this application", async () => {
    mocks.updateApplicantStatus.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    const select = renderSelect();

    await user.selectOptions(select, "Interview");

    expect(mocks.updateApplicantStatus).toHaveBeenCalledWith("app-1", "job-1", "Interview");
    await waitFor(() => expect(select.disabled).toBe(false));
    expect(select.value).toBe("Interview");
    expect(screen.queryByText(/unable/i)).toBeNull();
  });

  it("goes back to the previous status and explains when saving fails", async () => {
    mocks.updateApplicantStatus.mockResolvedValue({ success: false, error: "Unauthorized." });
    const user = userEvent.setup();
    const select = renderSelect();

    await user.selectOptions(select, "Rejected");

    expect(await screen.findByText("Unauthorized.")).toBeTruthy();
    expect(select.value).toBe("In Progress");
  });

  it("shows a default message when the server gives no reason", async () => {
    mocks.updateApplicantStatus.mockResolvedValue({ success: false });
    const user = userEvent.setup();
    const select = renderSelect();

    await user.selectOptions(select, "Accepted");

    expect(await screen.findByText("Unable to update status.")).toBeTruthy();
    expect(select.value).toBe("In Progress");
  });
});
