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
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import { CloseJobButton } from "./close-job-button";

const mocks = vi.hoisted(() => ({
  closeJob: vi.fn(),
  reopenJob: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/recruiter/jobs/actions", () => ({
  closeJob: mocks.closeJob,
  reopenJob: mocks.reopenJob,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
  }),
}));

const JOB_ID =
  "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.resetAllMocks();

  mocks.closeJob.mockResolvedValue({
    success: true,
    jobId: JOB_ID,
  });

  mocks.reopenJob.mockResolvedValue({
    success: true,
    jobId: JOB_ID,
  });
});

afterEach(() => {
  cleanup();
});

describe("CloseJobButton — Open jobs", () => {
  it("displays Close job for open postings", () => {
    render(
      <CloseJobButton jobId={JOB_ID} status="open" />
    );

    expect(
      screen.getByRole("button", { name: "Close job" })
    ).toBeDefined();

    expect(
      screen.queryByRole("button", { name: "Reopen job" })
    ).toBeNull();
  });

  it("requires confirmation before closing", async () => {
    const user = userEvent.setup();

    render(
      <CloseJobButton jobId={JOB_ID} status="open" />
    );

    await user.click(
      screen.getByRole("button", { name: "Close job" })
    );

    expect(
      screen.getByText("Stop accepting applications?")
    ).toBeDefined();

    expect(
      screen.getByRole("button", { name: "Confirm close" })
    ).toBeDefined();

    expect(mocks.closeJob).not.toHaveBeenCalled();
  });

  it("allows cancelling a close operation", async () => {
    const user = userEvent.setup();

    render(
      <CloseJobButton jobId={JOB_ID} status="open" />
    );

    await user.click(
      screen.getByRole("button", { name: "Close job" })
    );

    await user.click(
      screen.getByRole("button", { name: "Cancel" })
    );

    expect(
      screen.getByRole("button", { name: "Close job" })
    ).toBeDefined();

    expect(mocks.closeJob).not.toHaveBeenCalled();
  });

  it("closes a posting successfully", async () => {
    const user = userEvent.setup();

    render(
      <CloseJobButton jobId={JOB_ID} status="open" />
    );

    await user.click(
      screen.getByRole("button", { name: "Close job" })
    );

    await user.click(
      screen.getByRole("button", { name: "Confirm close" })
    );

    expect(
      mocks.closeJob
    ).toHaveBeenCalledExactlyOnceWith(JOB_ID);

    expect(
      (await screen.findByRole("status")).textContent
    ).toContain("Closed");

    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.reopenJob).not.toHaveBeenCalled();
  });

  it("displays backend errors", async () => {
    const user = userEvent.setup();

    mocks.closeJob.mockResolvedValue({
      success: false,
      error: "This job is already closed.",
    });

    render(
      <CloseJobButton jobId={JOB_ID} status="open" />
    );

    await user.click(
      screen.getByRole("button", { name: "Close job" })
    );

    await user.click(
      screen.getByRole("button", { name: "Confirm close" })
    );

    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain("This job is already closed.");

    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("CloseJobButton — Closed jobs", () => {
  it("displays Reopen job instead of Close job", () => {
    render(
      <CloseJobButton jobId={JOB_ID} status="closed" />
    );

    expect(
      screen.getByRole("button", { name: "Reopen job" })
    ).toBeDefined();

    expect(
      screen.queryByRole("button", { name: "Close job" })
    ).toBeNull();

    expect(mocks.reopenJob).not.toHaveBeenCalled();
  });

  it("displays the reopening confirmation", async () => {
    const user = userEvent.setup();

    render(
      <CloseJobButton jobId={JOB_ID} status="closed" />
    );

    await user.click(
      screen.getByRole("button", { name: "Reopen job" })
    );

    expect(
      screen.getByText("Reopen this job posting?")
    ).toBeDefined();

    expect(
      screen.getByText(
        /This job will become visible to job seekers again/
      )
    ).toBeDefined();

    expect(
      screen.getByRole("button", { name: "Confirm reopen" })
    ).toBeDefined();

    expect(mocks.reopenJob).not.toHaveBeenCalled();
  });

  it("allows the recruiter to cancel reopening", async () => {
    const user = userEvent.setup();

    render(
      <CloseJobButton jobId={JOB_ID} status="closed" />
    );

    await user.click(
      screen.getByRole("button", { name: "Reopen job" })
    );

    await user.click(
      screen.getByRole("button", { name: "Cancel" })
    );

    expect(
      screen.getByRole("button", { name: "Reopen job" })
    ).toBeDefined();

    expect(mocks.reopenJob).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("reopens the posting successfully", async () => {
    const user = userEvent.setup();

    render(
      <CloseJobButton jobId={JOB_ID} status="closed" />
    );

    await user.click(
      screen.getByRole("button", { name: "Reopen job" })
    );

    await user.click(
      screen.getByRole("button", { name: "Confirm reopen" })
    );

    expect(
      mocks.reopenJob
    ).toHaveBeenCalledExactlyOnceWith(JOB_ID);

    expect(
      (await screen.findByRole("status")).textContent
    ).toContain("Reopened");

    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.closeJob).not.toHaveBeenCalled();
  });

  it("displays a backend reopening error", async () => {
    const user = userEvent.setup();

    mocks.reopenJob.mockResolvedValue({
      success: false,
      error: "This job is already open or does not belong to you.",
    });

    render(
      <CloseJobButton jobId={JOB_ID} status="closed" />
    );

    await user.click(
      screen.getByRole("button", { name: "Reopen job" })
    );

    await user.click(
      screen.getByRole("button", { name: "Confirm reopen" })
    );

    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain(
      "This job is already open or does not belong to you."
    );

    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("handles unexpected reopening failures", async () => {
    const user = userEvent.setup();

    mocks.reopenJob.mockRejectedValue(
      new Error("Network failure")
    );

    render(
      <CloseJobButton jobId={JOB_ID} status="closed" />
    );

    await user.click(
      screen.getByRole("button", { name: "Reopen job" })
    );

    await user.click(
      screen.getByRole("button", { name: "Confirm reopen" })
    );

    expect(
      (await screen.findByRole("alert")).textContent
    ).toContain(
      "An unexpected error occurred. Please try again."
    );

    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("prevents duplicate reopen requests", async () => {
    const user = userEvent.setup();

    let resolve!: (value: {
      success: true;
      jobId: string;
    }) => void;

    const pending = new Promise<{
      success: true;
      jobId: string;
    }>((res) => {
      resolve = res;
    });

    mocks.reopenJob.mockReturnValue(pending);

    render(
      <CloseJobButton jobId={JOB_ID} status="closed" />
    );

    await user.click(
      screen.getByRole("button", { name: "Reopen job" })
    );

    await user.click(
      screen.getByRole("button", { name: "Confirm reopen" })
    );

    const button = screen.getByRole("button", {
      name: "Reopening...",
    }) as HTMLButtonElement;

    const cancelButton = screen.getByRole("button", {
      name: "Cancel",
    }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(cancelButton.disabled).toBe(true);

    await user.click(button);

    expect(mocks.reopenJob).toHaveBeenCalledOnce();

    await act(async () => {
      resolve({ success: true, jobId: JOB_ID });
    });

    expect(
      screen.getByRole("status").textContent
    ).toContain("Reopened");

    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
