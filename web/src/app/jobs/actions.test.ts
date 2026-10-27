import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getActiveApplicationResumes,
  submitJobApplication,
} from "./actions";

const mocks = vi.hoisted(() => ({
  // Application submission
  submitApplication: vi.fn(),
  revalidatePath: vi.fn(),

  // Supabase
  createClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/lib/jobs/submit-application", () => ({
  submitApplication: mocks.submitApplication,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
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

const sampleResumes = [
  {
    id: RESUME_ID,
    file_name: "Software-Engineer.pdf",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    file_name: "Backend-Developer.pdf",
  },
];

// Mock the Supabase query builder.
const resumeQuery = {
  select: mocks.select,
  eq: mocks.eq,
  is: mocks.is,
  order: mocks.order,
};

beforeEach(() => {
  vi.resetAllMocks();

  // Default: signed-in user
  mocks.getUser.mockResolvedValue({
    data: {
      user: { id: USER_ID },
    },
    error: null,
  });

  // Mock Supabase server client
  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  });

  // Build the chainable Supabase query.
  mocks.from.mockReturnValue(resumeQuery);
  mocks.select.mockReturnValue(resumeQuery);
  mocks.eq.mockReturnValue(resumeQuery);
  mocks.is.mockReturnValue(resumeQuery);

  // Default: return two active resumes.
  mocks.order.mockResolvedValue({
    data: sampleResumes,
    error: null,
  });
});

// ==================================================
// 1. Application submission Server Action
// ==================================================

describe("submitJobApplication", () => {
  it("submits an application and refreshes the relevant pages", async () => {
    mocks.submitApplication.mockResolvedValue({
      ok: true,
      applicationId: APPLICATION_ID,
    });

    const result = await submitJobApplication(validInput);

    expect(result).toEqual({
      ok: true,
      applicationId: APPLICATION_ID,
    });

    expect(mocks.submitApplication)
      .toHaveBeenCalledExactlyOnceWith(validInput);

    expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/application-status"
    );

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/dashboard"
    );
  });

  it("returns submission errors without refreshing pages", async () => {
    mocks.submitApplication.mockResolvedValue({
      ok: false,
      reason: "already_applied",
    });

    const result = await submitJobApplication(validInput);

    expect(result).toEqual({
      ok: false,
      reason: "already_applied",
    });

    expect(mocks.submitApplication)
      .toHaveBeenCalledExactlyOnceWith(validInput);

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

// ==================================================
// 2. Active resume retrieval Server Action
// ==================================================

describe("getActiveApplicationResumes", () => {
  it("rejects unauthenticated users without querying resumes", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await getActiveApplicationResumes();

    expect(result).toEqual({
      ok: false,
      reason: "signed_out",
    });

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.getUser).toHaveBeenCalledOnce();

    // No database queries should be performed.
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects users when authentication fails", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: "Session expired",
      },
    });

    const result = await getActiveApplicationResumes();

    expect(result).toEqual({
      ok: false,
      reason: "signed_out",
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns only the current user's active resumes", async () => {
    const result = await getActiveApplicationResumes();

    expect(result).toEqual({
      ok: true,
      resumes: sampleResumes,
    });

    // Query the correct table.
    expect(mocks.from)
      .toHaveBeenCalledExactlyOnceWith("resumes");

    // Retrieve only the data needed by the selector.
    expect(mocks.select).toHaveBeenCalledWith(
      "id, file_name"
    );

    // Only the authenticated user's resumes.
    expect(mocks.eq).toHaveBeenCalledWith(
      "user_id",
      USER_ID
    );

    // Exclude archived resumes.
    expect(mocks.is).toHaveBeenCalledWith(
      "archived_at",
      null
    );

    // Show newest uploads first.
    expect(mocks.order).toHaveBeenCalledWith(
      "uploaded_at",
      { ascending: false }
    );

    expect(mocks.order).toHaveBeenCalledOnce();
  });

  it("returns an empty array when no active resumes exist", async () => {
    mocks.order.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await getActiveApplicationResumes();

    expect(result).toEqual({
      ok: true,
      resumes: [],
    });

    expect(mocks.from).toHaveBeenCalledWith("resumes");

    expect(mocks.is).toHaveBeenCalledWith(
      "archived_at",
      null
    );
  });

  it("returns database_error when fetching resumes fails", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "Unable to retrieve resumes",
      },
    });

    const result = await getActiveApplicationResumes();

    expect(result).toEqual({
      ok: false,
      reason: "database_error",
    });

    expect(mocks.from).toHaveBeenCalledWith("resumes");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
