import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  CLOSE_JOB_ERRORS,
  closeJobPosting,
} from "./close-job";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),

  profileSelect: vi.fn(),
  profileEq: vi.fn(),
  profileMaybeSingle: vi.fn(),

  update: vi.fn(),
  jobEq: vi.fn(),
  jobSelect: vi.fn(),
  jobMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}));

const RECRUITER_ID =
  "11111111-1111-4111-8111-111111111111";

const JOB_ID =
  "22222222-2222-4222-8222-222222222222";

const profileQuery = {
  select: mocks.profileSelect,
  eq: mocks.profileEq,
  maybeSingle: mocks.profileMaybeSingle,
};

const jobQuery = {
  update: mocks.update,
  eq: mocks.jobEq,
  select: mocks.jobSelect,
  maybeSingle: mocks.jobMaybeSingle,
};

beforeEach(() => {
  vi.resetAllMocks();

  mocks.getUser.mockResolvedValue({
    data: { user: { id: RECRUITER_ID } },
    error: null,
  });

  mocks.profileSelect.mockReturnValue(profileQuery);
  mocks.profileEq.mockReturnValue(profileQuery);

  mocks.profileMaybeSingle.mockResolvedValue({
    data: { role: "recruiter" },
    error: null,
  });

  mocks.update.mockReturnValue(jobQuery);
  mocks.jobEq.mockReturnValue(jobQuery);
  mocks.jobSelect.mockReturnValue(jobQuery);

  mocks.jobMaybeSingle.mockResolvedValue({
    data: { id: JOB_ID },
    error: null,
  });

  mocks.from.mockImplementation((table: string) => {
    if (table === "profiles") return profileQuery;
    if (table === "job") return jobQuery;

    throw new Error(`Unexpected table: ${table}`);
  });
});

describe("closeJobPosting", () => {
  it.each([
    null,
    "",
    "invalid-uuid",
    { jobId: JOB_ID },
  ])("rejects invalid input: %s", async (input) => {
    const result = await closeJobPosting(input);

    expect(result).toEqual({
      success: false,
      error: CLOSE_JOB_ERRORS.invalidId,
    });

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await closeJobPosting(JOB_ID);

    expect(result).toEqual({
      success: false,
      error: CLOSE_JOB_ERRORS.signedOut,
    });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects authentication errors", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Session expired" },
    });

    const result = await closeJobPosting(JOB_ID);

    expect(result).toEqual({
      success: false,
      error: CLOSE_JOB_ERRORS.signedOut,
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects job seekers", async () => {
    mocks.profileMaybeSingle.mockResolvedValue({
      data: { role: "job_seeker" },
      error: null,
    });

    const result = await closeJobPosting(JOB_ID);

    expect(result).toEqual({
      success: false,
      error: CLOSE_JOB_ERRORS.notRecruiter,
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects users without a recruiter profile", async () => {
    mocks.profileMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await closeJobPosting(JOB_ID);

    expect(result).toEqual({
      success: false,
      error: CLOSE_JOB_ERRORS.notRecruiter,
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("handles profile lookup failures", async () => {
    mocks.profileMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "Database unavailable" },
    });

    const result = await closeJobPosting(JOB_ID);

    expect(result).toEqual({
      success: false,
      error: CLOSE_JOB_ERRORS.profile,
    });

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("closes an open posting owned by the recruiter", async () => {
    const result = await closeJobPosting(JOB_ID);

    expect(result).toEqual({
      success: true,
      jobId: JOB_ID,
    });

    expect(mocks.from).toHaveBeenCalledWith("job");

    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
      status: "closed",
    });

    expect(mocks.jobEq.mock.calls).toEqual([
      ["id", JOB_ID],
      ["recruiter_id", RECRUITER_ID],
      ["status", "open"],
    ]);

    expect(mocks.jobSelect).toHaveBeenCalledWith("id");
    expect(mocks.jobMaybeSingle).toHaveBeenCalledOnce();
  });

  it("rejects jobs not owned by this recruiter", async () => {
    // Simulates the zero-row result after ownership filtering.
    mocks.jobMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await closeJobPosting(JOB_ID);

    expect(result).toEqual({
      success: false,
      error: CLOSE_JOB_ERRORS.unavailable,
    });

    expect(mocks.jobEq).toHaveBeenCalledWith(
      "recruiter_id",
      RECRUITER_ID
    );
  });

  it("rejects a job that is already closed", async () => {
    mocks.jobMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await closeJobPosting(JOB_ID);

    expect(result).toEqual({
      success: false,
      error: CLOSE_JOB_ERRORS.unavailable,
    });

    expect(mocks.jobEq).toHaveBeenCalledWith(
      "status",
      "open"
    );
  });

  it("handles database errors", async () => {
    mocks.jobMaybeSingle.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "Permission denied",
      },
    });

    const result = await closeJobPosting(JOB_ID);

    expect(result).toEqual({
      success: false,
      error: CLOSE_JOB_ERRORS.database,
    });
  });
});
