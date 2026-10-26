/**
 * @vitest-environment jsdom
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  act,
  cleanup,
  render,
  screen,
  within,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import { ApplyToJob } from "./ApplyToJob";

// Mock the Server Actions so tests never contact Supabase.
const mocks = vi.hoisted(() => ({
  getActiveApplicationResumes: vi.fn(),
  submitJobApplication: vi.fn(),
}));

vi.mock("@/app/jobs/actions", () => ({
  getActiveApplicationResumes: mocks.getActiveApplicationResumes,
  submitJobApplication: mocks.submitJobApplication,
}));

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_JOB_ID = "55555555-5555-4555-8555-555555555555";
const RESUME_ID = "22222222-2222-4222-8222-222222222222";
const SECOND_RESUME_ID = "33333333-3333-4333-8333-333333333333";
const APPLICATION_ID = "44444444-4444-4444-8444-444444444444";

const sampleResumes = [
  {
    id: RESUME_ID,
    file_name: "Software-Engineer.pdf",
  },
  {
    id: SECOND_RESUME_ID,
    file_name: "Backend-Developer.pdf",
  },
];

type User = ReturnType<typeof userEvent.setup>;

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

// Opens the form and waits for resumes to load.
async function openApplicationForm(user: User) {
  await user.click(
    screen.getByRole("button", {
      name: "Apply for this job",
    })
  );

  return (await screen.findByRole("combobox", {
    name: "Select resume",
  })) as HTMLSelectElement;
}

// Opens the form and selects a valid resume.
async function selectResume(user: User, resumeId = RESUME_ID) {
  const select = await openApplicationForm(user);
  await user.selectOptions(select, resumeId);
  return select;
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.getActiveApplicationResumes.mockResolvedValue({
    ok: true,
    resumes: sampleResumes,
  });

  mocks.submitJobApplication.mockResolvedValue({
    ok: true,
    applicationId: APPLICATION_ID,
  });
});

afterEach(() => {
  cleanup();
});

describe("ApplyToJob", () => {
  // --------------------------------------------------
  // 1. Initial rendering
  // --------------------------------------------------

  it("initially shows an enabled Apply button", () => {
    render(<ApplyToJob jobId={JOB_ID} />);

    const button = screen.getByRole("button", {
      name: "Apply for this job",
    }) as HTMLButtonElement;

    expect(button.disabled).toBe(false);

    // Resumes should only load after clicking Apply.
    expect(
      mocks.getActiveApplicationResumes
    ).not.toHaveBeenCalled();

    expect(mocks.submitJobApplication).not.toHaveBeenCalled();
  });

  // --------------------------------------------------
  // 2. Resume loading
  // --------------------------------------------------

  it("loads and displays available resumes", async () => {
    const user = userEvent.setup();

    render(<ApplyToJob jobId={JOB_ID} />);

    const select = await openApplicationForm(user);

    expect(
      mocks.getActiveApplicationResumes
    ).toHaveBeenCalledOnce();

    const options = within(select).getAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "Choose a resume",
      "Software-Engineer.pdf",
      "Backend-Developer.pdf",
    ]);

    expect(select.value).toBe("");
  });

  it("displays a loading state while fetching resumes", async () => {
    const user = userEvent.setup();

    const pending = deferred<{
      ok: true;
      resumes: typeof sampleResumes;
    }>();

    mocks.getActiveApplicationResumes.mockReturnValue(
      pending.promise
    );

    render(<ApplyToJob jobId={JOB_ID} />);

    await user.click(
      screen.getByRole("button", {
        name: "Apply for this job",
      })
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Loading resumes..."
    );

    expect(screen.queryByRole("combobox")).toBeNull();

    await act(async () => {
      pending.resolve({
        ok: true,
        resumes: sampleResumes,
      });
    });

    expect(
      await screen.findByRole("combobox", {
        name: "Select resume",
      })
    ).toBeDefined();
  });

  it("shows an upload link when no active resumes exist", async () => {
    const user = userEvent.setup();

    mocks.getActiveApplicationResumes.mockResolvedValue({
      ok: true,
      resumes: [],
    });

    render(<ApplyToJob jobId={JOB_ID} />);

    await user.click(
      screen.getByRole("button", {
        name: "Apply for this job",
      })
    );

    expect(
      await screen.findByText("You have no active resumes.")
    ).toBeDefined();

    const uploadLink = screen.getByRole("link", {
      name: "Upload a resume",
    });

    expect(uploadLink.getAttribute("href")).toBe(
      "/upload-resume"
    );

    expect(
      screen.queryByRole("button", {
        name: "Submit application",
      })
    ).toBeNull();

    expect(mocks.submitJobApplication).not.toHaveBeenCalled();
  });

  // --------------------------------------------------
  // 3. Resume loading errors
  // --------------------------------------------------

  it("shows an authentication error when loading resumes", async () => {
    const user = userEvent.setup();

    mocks.getActiveApplicationResumes.mockResolvedValue({
      ok: false,
      reason: "signed_out",
    });

    render(<ApplyToJob jobId={JOB_ID} />);

    await user.click(
      screen.getByRole("button", {
        name: "Apply for this job",
      })
    );

    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain("Please sign in to apply.");

    expect(mocks.submitJobApplication).not.toHaveBeenCalled();
  });

  it("shows a database error when resumes cannot be loaded", async () => {
    const user = userEvent.setup();

    mocks.getActiveApplicationResumes.mockResolvedValue({
      ok: false,
      reason: "database_error",
    });

    render(<ApplyToJob jobId={JOB_ID} />);

    await user.click(
      screen.getByRole("button", {
        name: "Apply for this job",
      })
    );

    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain("Unable to load your resumes.");
  });

  it("recovers from an unexpected resume-loading error", async () => {
    const user = userEvent.setup();

    mocks.getActiveApplicationResumes.mockRejectedValueOnce(
      new Error("Network failure")
    );

    render(<ApplyToJob jobId={JOB_ID} />);

    await user.click(
      screen.getByRole("button", {
        name: "Apply for this job",
      })
    );

    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain("Unable to load your resumes.");

    await user.click(
      screen.getByRole("button", {
        name: "Refresh resumes",
      })
    );

    expect(
      await screen.findByRole("combobox", {
        name: "Select resume",
      })
    ).toBeDefined();

    expect(
      mocks.getActiveApplicationResumes
    ).toHaveBeenCalledTimes(2);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  // --------------------------------------------------
  // 4. Resume selection
  // --------------------------------------------------

  it("requires selecting a resume before submission", async () => {
    const user = userEvent.setup();

    render(<ApplyToJob jobId={JOB_ID} />);

    const select = await openApplicationForm(user);

    const submitButton = screen.getByRole("button", {
      name: "Submit application",
    }) as HTMLButtonElement;

    expect(select.value).toBe("");
    expect(submitButton.disabled).toBe(true);

    await user.selectOptions(select, RESUME_ID);

    expect(select.value).toBe(RESUME_ID);
    expect(submitButton.disabled).toBe(false);

    expect(mocks.submitJobApplication).not.toHaveBeenCalled();
  });

  it("cancels the application and resets the selection when reopened", async () => {
    const user = userEvent.setup();

    render(<ApplyToJob jobId={JOB_ID} />);

    await selectResume(user);

    await user.click(
      screen.getByRole("button", { name: "Cancel" })
    );

    expect(
      screen.getByRole("button", {
        name: "Apply for this job",
      })
    ).toBeDefined();

    const reopenedSelect = await openApplicationForm(user);

    expect(reopenedSelect.value).toBe("");

    expect(
      mocks.getActiveApplicationResumes
    ).toHaveBeenCalledTimes(2);

    expect(mocks.submitJobApplication).not.toHaveBeenCalled();
  });

  // --------------------------------------------------
  // 5. Successful submission
  // --------------------------------------------------

  it("submits the selected resume for the correct job", async () => {
    const user = userEvent.setup();

    render(<ApplyToJob jobId={JOB_ID} />);

    await selectResume(user, SECOND_RESUME_ID);

    await user.click(
      screen.getByRole("button", {
        name: "Submit application",
      })
    );

    expect(
      mocks.submitJobApplication
    ).toHaveBeenCalledExactlyOnceWith({
      jobId: JOB_ID,
      resumeId: SECOND_RESUME_ID,
    });

    expect(
      (await screen.findByRole("status")).textContent
    ).toContain("Application submitted successfully!");

    const link = screen.getByRole("link", {
      name: "View my applications",
    });

    expect(link.getAttribute("href")).toBe(
      "/application-status"
    );

    // The submission form is replaced by the success message.
    expect(
      screen.queryByRole("button", {
        name: "Submit application",
      })
    ).toBeNull();
  });

  // --------------------------------------------------
  // 6. Duplicate-click prevention
  // --------------------------------------------------

  it("prevents repeated submissions while one is pending", async () => {
    const user = userEvent.setup();

    const pending = deferred<{
      ok: true;
      applicationId: string;
    }>();

    mocks.submitJobApplication.mockReturnValue(pending.promise);

    render(<ApplyToJob jobId={JOB_ID} />);

    await selectResume(user);

    await user.click(
      screen.getByRole("button", {
        name: "Submit application",
      })
    );

    const submittingButton = screen.getByRole("button", {
      name: "Submitting...",
    }) as HTMLButtonElement;

    const resumeSelect = screen.getByRole(
      "combobox"
    ) as HTMLSelectElement;

    expect(submittingButton.disabled).toBe(true);
    expect(resumeSelect.disabled).toBe(true);

    // Clicking the disabled button must not trigger another request.
    await user.click(submittingButton);

    expect(
      mocks.submitJobApplication
    ).toHaveBeenCalledOnce();

    await act(async () => {
      pending.resolve({
        ok: true,
        applicationId: APPLICATION_ID,
      });
    });

    expect(screen.getByRole("status").textContent).toContain(
      "Application submitted successfully!"
    );

    expect(
      mocks.submitJobApplication
    ).toHaveBeenCalledOnce();
  });

  // --------------------------------------------------
  // 7. Submission error messages
  // --------------------------------------------------

  it.each([
    {
      reason: "invalid_input",
      message: "Invalid application details.",
    },
    {
      reason: "signed_out",
      message: "Please sign in again.",
    },
    {
      reason: "job_unavailable",
      message: "This job is no longer accepting applications.",
    },
    {
      reason: "resume_unavailable",
      message: "The selected resume is no longer available.",
    },
    {
      reason: "already_applied",
      message: "You have already applied to this job.",
    },
    {
      reason: "database_error",
      message: "Unable to submit your application. Please try again.",
    },
  ])(
    "displays the correct error for $reason",
    async ({ reason, message }) => {
      const user = userEvent.setup();

      mocks.submitJobApplication.mockResolvedValue({
        ok: false,
        reason,
      });

      render(<ApplyToJob jobId={JOB_ID} />);

      await selectResume(user);

      await user.click(
        screen.getByRole("button", {
          name: "Submit application",
        })
      );

      expect(
        (await screen.findByRole("alert")).textContent
      ).toContain(message);

      // The user can correct or retry the submission.
      const button = screen.getByRole("button", {
        name: "Submit application",
      }) as HTMLButtonElement;

      expect(button.disabled).toBe(false);

      expect(
        screen.queryByText("Application submitted successfully!")
      ).toBeNull();
    }
  );

  // --------------------------------------------------
  // 8. Unexpected submission failures
  // --------------------------------------------------

  it("handles a rejected Server Action and allows retrying", async () => {
    const user = userEvent.setup();

    mocks.submitJobApplication.mockRejectedValueOnce(
      new Error("Network failure")
    );

    render(<ApplyToJob jobId={JOB_ID} />);

    await selectResume(user);

    await user.click(
      screen.getByRole("button", {
        name: "Submit application",
      })
    );

    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain(
      "An unexpected error occurred. Please try again."
    );

    const submitButton = screen.getByRole("button", {
      name: "Submit application",
    }) as HTMLButtonElement;

    expect(submitButton.disabled).toBe(false);

    // The next call uses the successful default mock.
    await user.click(submitButton);

    expect(
      mocks.submitJobApplication
    ).toHaveBeenCalledTimes(2);

    expect(
      (await screen.findByRole("status")).textContent
    ).toContain("Application submitted successfully!");
  });

  it("clears an existing error when the selected resume changes", async () => {
    const user = userEvent.setup();

    mocks.submitJobApplication.mockResolvedValue({
      ok: false,
      reason: "resume_unavailable",
    });

    render(<ApplyToJob jobId={JOB_ID} />);

    const select = await selectResume(user);

    await user.click(
      screen.getByRole("button", {
        name: "Submit application",
      })
    );

    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain(
      "The selected resume is no longer available."
    );

    await user.selectOptions(select, SECOND_RESUME_ID);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(select.value).toBe(SECOND_RESUME_ID);
  });

  // --------------------------------------------------
  // 9. Switching jobs
  // --------------------------------------------------

  it("resets application state when switching to another job", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <ApplyToJob key={JOB_ID} jobId={JOB_ID} />
    );

    await selectResume(user);

    rerender(
      <ApplyToJob key={OTHER_JOB_ID} jobId={OTHER_JOB_ID} />
    );

    expect(
      screen.getByRole("button", {
        name: "Apply for this job",
      })
    ).toBeDefined();

    const select = await openApplicationForm(user);

    expect(select.value).toBe("");

    await user.selectOptions(select, RESUME_ID);

    await user.click(
      screen.getByRole("button", {
        name: "Submit application",
      })
    );

    expect(
      mocks.submitJobApplication
    ).toHaveBeenCalledExactlyOnceWith({
      jobId: OTHER_JOB_ID,
      resumeId: RESUME_ID,
    });
  });
});
