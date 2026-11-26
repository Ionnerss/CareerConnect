import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateJobPosting } from "./update-job";

type Result = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  assurance: vi.fn(),
  profile: { data: null, error: null } as Result,
  update: { data: null, error: null } as Result,
  calls: [] as { table: string; method: string; args: unknown[] }[],
}));

/** Records every query call and resolves with the result queued for the table. */
function query(table: string) {
  const result = () => (table === "profiles" ? mocks.profile : mocks.update);
  const builder: Record<string, unknown> = {
    maybeSingle: async () => result(),
  };
  for (const method of ["select", "update", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      mocks.calls.push({ table, method, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser, mfa: { getAuthenticatorAssuranceLevel: mocks.assurance } },
    from: (table: string) => query(table),
  })),
}));

const RECRUITER_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";

const form = {
  title: "  Junior Frontend Developer ",
  firm_name: "Acme Inc.",
  location: "Montreal, QC",
  work_mode: "Hybrid",
  employment_type: "Full-time",
  required_skills: "React,  typescript, react",
  salary: "65000",
  experience: "",
  description: "Build the web app.",
  status: "closed",
};

function calls(table: string, method: string) {
  return mocks.calls.filter((c) => c.table === table && c.method === method).map((c) => c.args);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.getUser.mockResolvedValue({ data: { user: { id: RECRUITER_ID } }, error: null });
  mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  mocks.profile = { data: { role: "recruiter" }, error: null };
  mocks.update = { data: { id: JOB_ID }, error: null };
});

describe("updateJobPosting", () => {
  it("saves the cleaned changes to the recruiter's own posting", async () => {
    expect(await updateJobPosting(JOB_ID, form)).toEqual({ success: true, jobId: JOB_ID });

    expect(calls("job", "update")).toEqual([
      [
        {
          title: "Junior Frontend Developer",
          firm_name: "Acme Inc.",
          location: "Montreal, QC",
          work_mode: "Hybrid",
          employment_type: "Full-time",
          required_skills: "React, typescript",
          salary: 65000,
          experience: null,
          description: "Build the web app.",
          status: "closed",
        },
      ],
    ]);
    // Only the signed-in recruiter's posting can match.
    expect(calls("job", "eq")).toEqual([
      ["id", JOB_ID],
      ["recruiter_id", RECRUITER_ID],
    ]);
  });

  it("refuses a job id that is not a uuid without signing in", async () => {
    expect(await updateJobPosting("not-an-id", form)).toEqual({
      success: false,
      error: "Invalid job posting.",
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("refuses invalid details without saving", async () => {
    expect(await updateJobPosting(JOB_ID, { ...form, title: "  " })).toEqual({
      success: false,
      error: "Please check the job details.",
    });
    expect(calls("job", "update")).toHaveLength(0);
  });

  it("refuses a signed-out user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    expect(await updateJobPosting(JOB_ID, form)).toEqual({
      success: false,
      error: "Unable to authenticate. Please sign in again.",
    });
    expect(calls("job", "update")).toHaveLength(0);
  });

  it("requires two-factor authentication when it is set up", async () => {
    mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });

    expect(await updateJobPosting(JOB_ID, form)).toEqual({
      success: false,
      error: "Complete two-factor authentication to continue.",
    });
    expect(calls("job", "update")).toHaveLength(0);
  });

  it("only lets recruiters edit postings", async () => {
    mocks.profile = { data: { role: "job_seeker" }, error: null };

    expect(await updateJobPosting(JOB_ID, form)).toEqual({
      success: false,
      error: "Only recruiters can edit job postings.",
    });
    expect(calls("job", "update")).toHaveLength(0);
  });

  it("returns a friendly error when the profile cannot be loaded", async () => {
    mocks.profile = { data: null, error: { message: "boom" } };

    expect(await updateJobPosting(JOB_ID, form)).toEqual({
      success: false,
      error: "Unable to load your profile. Please try again.",
    });
  });

  it("returns a friendly error when saving fails", async () => {
    mocks.update = { data: null, error: { message: "boom" } };

    expect(await updateJobPosting(JOB_ID, form)).toEqual({
      success: false,
      error: "Unable to update this job posting. Please try again.",
    });
  });

  it("reports another recruiter's or a missing posting as not found", async () => {
    mocks.update = { data: null, error: null };

    expect(await updateJobPosting(JOB_ID, form)).toEqual({
      success: false,
      error: "Job posting not found or you do not have permission to edit it.",
    });
  });
});
