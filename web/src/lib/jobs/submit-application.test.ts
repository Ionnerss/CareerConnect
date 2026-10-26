
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitApplication } from "./submit-application";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),

  // Job query
  jobSelect: vi.fn(),
  jobEq: vi.fn(),
  jobMaybeSingle: vi.fn(),

  // Resume query
  resumeSelect: vi.fn(),
  resumeEq: vi.fn(),
  resumeIs: vi.fn(),
  resumeMaybeSingle: vi.fn(),

  // Application insertion
  applicationInsert: vi.fn(),
  applicationSelect: vi.fn(),
  applicationSingle: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("../supabase/server", () => ({
  createClient: mocks.createClient,
}));

const USER_ID = "33333333-3333-4333-8333-333333333333";
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const RESUME_ID = "22222222-2222-4222-8222-222222222222";
const APPLICATION_ID = "44444444-4444-4444-8444-444444444444";

const validInput = {
  jobId: JOB_ID,
  resumeId: RESUME_ID,
};

// Mock Supabase's chainable query builders.
const jobQuery = {
  select: mocks.jobSelect,
  eq: mocks.jobEq,
  maybeSingle: mocks.jobMaybeSingle,
};

const resumeQuery = {
  select: mocks.resumeSelect,
  eq: mocks.resumeEq,
  is: mocks.resumeIs,
  maybeSingle: mocks.resumeMaybeSingle,
};

const applicationQuery = {
  insert: mocks.applicationInsert,
  select: mocks.applicationSelect,
  single: mocks.applicationSingle,
};

beforeEach(() => {
  vi.resetAllMocks();

  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  });

  // Default: authenticated user
  mocks.getUser.mockResolvedValue({
    data: {
      user: { id: USER_ID },
    },
    error: null,
  });

  // Default: job exists and is open
  mocks.jobSelect.mockReturnValue(jobQuery);
  mocks.jobEq.mockReturnValue(jobQuery);
  mocks.jobMaybeSingle.mockResolvedValue({
    data: {
      id: JOB_ID,
      status: "open",
    },
    error: null,
  });

  // Default: resume exists, is owned, and is active
  mocks.resumeSelect.mockReturnValue(resumeQuery);
  mocks.resumeEq.mockReturnValue(resumeQuery);
  mocks.resumeIs.mockReturnValue(resumeQuery);
  mocks.resumeMaybeSingle.mockResolvedValue({
    data: { id: RESUME_ID },
    error: null,
  });

  // Default: application created successfully
  mocks.applicationInsert.mockReturnValue(applicationQuery);
  mocks.applicationSelect.mockReturnValue(applicationQuery);
  mocks.applicationSingle.mockResolvedValue({
    data: { id: APPLICATION_ID },
    error: null,
  });

  // Return the correct query builder for each table.
  mocks.from.mockImplementation((table: string) => {
    switch (table) {
      case "job":
        return jobQuery;

      case "resumes":
        return resumeQuery;

      case "applications":
        return applicationQuery;

      default:
        throw new Error(`Unexpected table: ${table}`);
    }
  });
});

describe("submitApplication", () => {
  // --------------------------------------------------
  // 1. Input validation
  // --------------------------------------------------

  it("rejects invalid input before accessing Supabase", async () => {
    const invalidInputs = [
      null,
      {},
      { jobId: "invalid-uuid", resumeId: RESUME_ID },
      { jobId: JOB_ID, resumeId: "invalid-uuid" },
      { jobId: JOB_ID },
      { resumeId: RESUME_ID },
      {
        ...validInput,
        applicantId: USER_ID,
      },
    ];

    for (const input of invalidInputs) {
      const result = await submitApplication(input);

      expect(result).toEqual({
        ok: false,
        reason: "invalid_input",
      });
    }

    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  // --------------------------------------------------
  // 2. Authentication
  // --------------------------------------------------

  it("rejects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "signed_out",
    });

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects users when authentication fails", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Session expired" },
    });

    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "signed_out",
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });

  // --------------------------------------------------
  // 3. Job availability
  // --------------------------------------------------

  it.each([
    ["nonexistent", null],
    ["closed", { id: JOB_ID, status: "closed" }],
  ])("rejects a %s job", async (_scenario, job) => {
    mocks.jobMaybeSingle.mockResolvedValue({
      data: job,
      error: null,
    });

    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "job_unavailable",
    });

    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("job");
    expect(mocks.jobSelect).toHaveBeenCalledWith("id, status");
    expect(mocks.jobEq).toHaveBeenCalledWith("id", JOB_ID);
    expect(mocks.jobMaybeSingle).toHaveBeenCalledOnce();

    // Never reach resume validation or insertion.
    expect(mocks.resumeMaybeSingle).not.toHaveBeenCalled();
    expect(mocks.applicationInsert).not.toHaveBeenCalled();
  });

  it("handles database errors when checking the job", async () => {
    mocks.jobMaybeSingle.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "Unable to read job",
      },
    });

    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "database_error",
    });

    expect(mocks.applicationInsert).not.toHaveBeenCalled();
  });

  // --------------------------------------------------
  // 4. Resume ownership and availability
  // --------------------------------------------------

  it.each([
    ["belongs to another user"],
    ["is archived"],
    ["does not exist"],
  ])("rejects a resume that %s", async () => {
    // No row matches the required ownership and
    // active-resume filters.
    mocks.resumeMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "resume_unavailable",
    });

    expect(mocks.resumeSelect).toHaveBeenCalledWith("id");
    expect(mocks.resumeEq).toHaveBeenCalledWith("id", RESUME_ID);
    expect(mocks.resumeEq).toHaveBeenCalledWith(
      "user_id",
      USER_ID
    );
    expect(mocks.resumeIs).toHaveBeenCalledWith(
      "archived_at",
      null
    );

    expect(mocks.applicationInsert).not.toHaveBeenCalled();
  });

  it("handles database errors when checking the resume", async () => {
    mocks.resumeMaybeSingle.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "Unable to read resume",
      },
    });

    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "database_error",
    });

    expect(mocks.applicationInsert).not.toHaveBeenCalled();
  });

  // --------------------------------------------------
  // 5. Successful application submission
  // --------------------------------------------------

  it("submits an application using the authenticated user", async () => {
    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: true,
      applicationId: APPLICATION_ID,
    });

    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
      "job",
      "resumes",
      "applications",
    ]);

    expect(mocks.applicationInsert).toHaveBeenCalledExactlyOnceWith({
      job_id: JOB_ID,
      resume_id: RESUME_ID,
      applicant_id: USER_ID,
    });

    expect(mocks.applicationSelect).toHaveBeenCalledWith("id");
    expect(mocks.applicationSingle).toHaveBeenCalledOnce();
  });

  // --------------------------------------------------
  // 6. Database insertion errors
  // --------------------------------------------------

  it("rejects duplicate applications", async () => {
    mocks.applicationSingle.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key violates unique constraint "applications_applicant_job_unique"',
      },
    });

    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "already_applied",
    });

    expect(mocks.applicationInsert).toHaveBeenCalledOnce();
  });

  it("rejects submission if the job closes during insertion", async () => {
    mocks.applicationSingle.mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "You can only apply to an open job.",
      },
    });

    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "job_unavailable",
    });

    expect(mocks.applicationInsert).toHaveBeenCalledOnce();
  });

  it("rejects submission if the resume becomes unavailable", async () => {
    mocks.applicationSingle.mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "You must select your own active resume.",
      },
    });

    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "resume_unavailable",
    });

    expect(mocks.applicationInsert).toHaveBeenCalledOnce();
  });

  it("does not mistake an unrelated unique constraint for a duplicate application", async () => {
    mocks.applicationSingle.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key violates unique constraint "another_constraint"',
      },
    });

    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "database_error",
    });
  });

  it("handles unexpected application insertion errors", async () => {
    mocks.applicationSingle.mockResolvedValue({
      data: null,
      error: {
        code: "XX000",
        message: "Unexpected database failure",
      },
    });

    const result = await submitApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "database_error",
    });
  });
});
