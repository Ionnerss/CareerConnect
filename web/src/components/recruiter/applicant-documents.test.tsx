/**
 * @vitest-environment jsdom
 */

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { ApplicantDocuments } from "./applicant-documents";

const { mockOpenDocument } = vi.hoisted(() => ({
  mockOpenDocument: vi.fn(),
}));

vi.mock(
  "@/app/recruiter/jobs/[jobId]/applicants/actions",
  () => ({
    openApplicantDocument: mockOpenDocument,
  })
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("ApplicantDocuments", () => {
  it("renders actions for available documents", () => {
    render(
      <ApplicantDocuments
        applicationId="app-1"
        hasResume={true}
        hasCoverLetter={true}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "View resume",
      })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", {
        name: "Download resume",
      })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", {
        name: "View cover letter",
      })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", {
        name: "Download cover letter",
      })
    ).toBeTruthy();
  });

  it("shows unavailable state for a missing cover letter", () => {
    render(
      <ApplicantDocuments
        applicationId="app-1"
        hasResume={true}
        hasCoverLetter={false}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "View resume",
      })
    ).toBeTruthy();

    expect(
      screen.queryByRole("button", {
        name: "View cover letter",
      })
    ).toBeNull();

    expect(
      screen.getByText("Not provided")
    ).toBeTruthy();
  });

  it("displays errors returned by the backend", async () => {
    const user = userEvent.setup();

    mockOpenDocument.mockResolvedValue({
      success: false,
      error: "You cannot access this document.",
    });

    render(
      <ApplicantDocuments
        applicationId="app-1"
        hasResume={true}
        hasCoverLetter={false}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: "Download resume",
      })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveProperty(
      "textContent",
      "You cannot access this document."
    );

    expect(mockOpenDocument).toHaveBeenCalledWith({
      applicationId: "app-1",
      kind: "resume",
      mode: "download",
    });
  });

  it("opens an authorized resume in a new tab", async () => {
    const user = userEvent.setup();

    const replace = vi.fn();

    const popup = {
      opener: null,
      location: { replace },
      close: vi.fn(),
    };

    const openSpy = vi
      .spyOn(window, "open")
      .mockReturnValue(popup as unknown as Window);

    mockOpenDocument.mockResolvedValue({
      success: true,
      url: "https://example.com/signed-resume.pdf",
    });

    render(
      <ApplicantDocuments
        applicationId="app-1"
        hasResume={true}
        hasCoverLetter={false}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: "View resume",
      })
    );

    expect(
      await screen.findByText(
        "Document opened in a new tab."
      )
    ).toBeTruthy();

    expect(openSpy).toHaveBeenCalledWith(
      "about:blank",
      "_blank"
    );

    expect(mockOpenDocument).toHaveBeenCalledWith({
      applicationId: "app-1",
      kind: "resume",
      mode: "view",
    });

    expect(replace).toHaveBeenCalledWith(
      "https://example.com/signed-resume.pdf"
    );

    expect(popup.close).not.toHaveBeenCalled();
  });
});
