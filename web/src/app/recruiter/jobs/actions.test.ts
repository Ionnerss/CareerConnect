import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createJob,
  closeJob,
  reopenJob,
} from "./actions";

const mocks = vi.hoisted(() => ({
  createJobPosting: vi.fn(),
  closeJobPosting: vi.fn(),
  reopenJobPosting: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/jobs/create-job", () => ({
  createJobPosting: mocks.createJobPosting,
}));

vi.mock("@/lib/jobs/close-job", () => ({
  closeJobPosting: mocks.closeJobPosting,
}));

vi.mock("@/lib/jobs/reopen-job", () => ({
  reopenJobPosting: mocks.reopenJobPosting,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

const JOB_ID =
  "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createJob", () => {
  it("preserves existing job creation behavior", async () => {
    const input = { title: "Developer" };

    mocks.createJobPosting.mockResolvedValue({
      success: true,
      job: { id: JOB_ID },
    });

    const result = await createJob(input);

    expect(result.success).toBe(true);

    expect(
      mocks.createJobPosting
    ).toHaveBeenCalledExactlyOnceWith(input);

    expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/recruiter/jobs"
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/jobs"
    );
  });

  it("does not refresh when creation fails", async () => {
    mocks.createJobPosting.mockResolvedValue({
      success: false,
      error: "Unable to create job.",
    });

    const result = await createJob({ title: "" });

    expect(result.success).toBe(false);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("closeJob", () => {
  it("closes a posting and refreshes relevant pages", async () => {
    mocks.closeJobPosting.mockResolvedValue({
      success: true,
      jobId: JOB_ID,
    });

    const result = await closeJob(JOB_ID);

    expect(result).toEqual({
      success: true,
      jobId: JOB_ID,
    });

    expect(
      mocks.closeJobPosting
    ).toHaveBeenCalledExactlyOnceWith(JOB_ID);

    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/recruiter/jobs"
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/jobs"
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/recruiter/jobs/${JOB_ID}/applicants`
    );
  });

  it("does not refresh when closing fails", async () => {
    mocks.closeJobPosting.mockResolvedValue({
      success: false,
      error: "This job is already closed.",
    });

    const result = await closeJob(JOB_ID);

    expect(result.success).toBe(false);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("reopenJob", () => {
  it("reopens a posting and refreshes relevant pages", async () => {
    mocks.reopenJobPosting.mockResolvedValue({
      success: true,
      jobId: JOB_ID,
    });

    const result = await reopenJob(JOB_ID);

    expect(result).toEqual({
      success: true,
      jobId: JOB_ID,
    });

    expect(
      mocks.reopenJobPosting
    ).toHaveBeenCalledExactlyOnceWith(JOB_ID);

    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/recruiter/jobs"
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/jobs"
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/recruiter/jobs/${JOB_ID}/applicants`
    );
  });

  it("does not refresh when reopening fails", async () => {
    mocks.reopenJobPosting.mockResolvedValue({
      success: false,
      error: "This job is already open.",
    });

    const result = await reopenJob(JOB_ID);

    expect(result).toEqual({
      success: false,
      error: "This job is already open.",
    });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
