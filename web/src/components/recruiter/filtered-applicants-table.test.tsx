// @vitest-environment jsdom

/** Tests the applicants table a recruiter sees for one of their postings. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilteredApplicantsTable from "./filtered-applicants-table";
import type { JobApplicant } from "@/lib/recruiter/applicants";

const mocks = vi.hoisted(() => ({
  updateApplicantStatus: vi.fn(),
  openApplicantDocument: vi.fn(),
}));

vi.mock("@/app/recruiter/jobs/[jobId]/applicants/actions", () => ({
  updateApplicantStatus: mocks.updateApplicantStatus,
  openApplicantDocument: mocks.openApplicantDocument,
}));

const applicants: JobApplicant[] = [
  {
    application_id: "app-1",
    applicant_id: "user-1",
    full_name: "Catalin Besleaga",
    status: "Interview",
    applied_at: "2026-11-03T15:00:00Z",
    skill_match: { percent: 67, matched: ["React", "SQL"], missing: ["Docker"] },
    has_resume: true,
    has_cover_letter: false,
  },
  {
    application_id: "app-2",
    applicant_id: "user-2",
    full_name: null,
    status: "In Progress",
    applied_at: "2026-11-01T15:00:00Z",
    skill_match: null,
    has_resume: false,
    has_cover_letter: false,
  },
];

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(cleanup);

function rows() {
  return screen.getAllByRole("row").slice(1);
}

describe("FilteredApplicantsTable", () => {
  it("shows each applicant with their name, status, skill match and actions", () => {
    render(<FilteredApplicantsTable applicants={applicants} jobId="job-1" />);

    expect(rows()).toHaveLength(2);
    const first = within(rows()[0]);
    expect(first.getByText("Catalin Besleaga")).toBeTruthy();
    expect(first.getByText("CB")).toBeTruthy();
    expect((first.getByRole("combobox") as HTMLSelectElement).value).toBe("Interview");
    expect(first.getByText("67%")).toBeTruthy();
    expect(first.getByText("Missing: Docker")).toBeTruthy();
    expect(first.getByRole("progressbar", { name: "Skill match for Catalin Besleaga" }).getAttribute("aria-valuenow")).toBe("67");
    expect(
      first.getByRole("link", { name: "Schedule an interview with Catalin Besleaga" }).getAttribute("href"),
    ).toBe("/recruiter/interviews/new?applicationId=app-1");
  });

  it("handles an applicant without a name or skill match", () => {
    render(<FilteredApplicantsTable applicants={applicants} jobId="job-1" />);

    const second = within(rows()[1]);
    expect(second.getByText("Name not available")).toBeTruthy();
    expect(second.getByText("?")).toBeTruthy();
    expect(second.getByText("—")).toBeTruthy();
    expect(second.getByRole("link", { name: "Schedule an interview with this applicant" })).toBeTruthy();
  });

  it("only lists applicants that match the filters", async () => {
    const user = userEvent.setup();
    render(<FilteredApplicantsTable applicants={applicants} jobId="job-1" />);

    const statusGroup = within(screen.getByRole("group", { name: "Filter by applicant status" }));
    await user.click(statusGroup.getByRole("button", { name: "In Progress" }));

    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText("Name not available")).toBeTruthy();
  });

  it("explains when no applicant matches", async () => {
    const user = userEvent.setup();
    render(<FilteredApplicantsTable applicants={applicants} jobId="job-1" />);

    await user.type(screen.getByLabelText("Search applicants by name"), "nobody");

    expect(screen.getByText("No matching applicants")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("saves a status change for the right application and posting", async () => {
    mocks.updateApplicantStatus.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<FilteredApplicantsTable applicants={applicants} jobId="job-1" />);

    await user.selectOptions(within(rows()[0]).getByRole("combobox"), "Accepted");

    expect(mocks.updateApplicantStatus).toHaveBeenCalledWith("app-1", "job-1", "Accepted");
  });
});
