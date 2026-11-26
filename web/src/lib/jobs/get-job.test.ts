import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJobForEditing } from "./get-job";

type Result = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  assurance: vi.fn(),
  profile: { data: null, error: null } as Result,
  job: { data: null, error: null } as Result,
  calls: [] as { table: string; method: string; args: unknown[] }[],
}));

function query(table: string) {
  const builder: Record<string, unknown> = {
    maybeSingle: async () => (table === "profiles" ? mocks.profile : mocks.job),
  };
  for (const method of ["select", "eq"]) {
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

const job = {
  id: JOB_ID,
  title: "Junior Frontend Developer",
  firm_name: "Acme Inc.",
  location: "Montreal, QC",
  work_mode: "Hybrid",
  employment_type: "Full-time",
  required_skills: "React, TypeScript",
  salary: 65000,
  experience: null,
  description: "Build the web app.",
  status: "open",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.getUser.mockResolvedValue({ data: { user: { id: RECRUITER_ID } }, error: null });
  mocks.assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  mocks.profile = { data: { role: "recruiter" }, error: null };
  mocks.job = { data: job, error: null };
});

describe("getJobForEditing", () => {
  it("loads the recruiter's own posting for the edit form", async () => {
    expect(await getJobForEditing(JOB_ID)).toEqual({ success: true, job });

    expect(mocks.calls.filter((c) => c.table === "job" && c.method === "eq").map((c) => c.args)).toEqual([
      ["id", JOB_ID],
      ["recruiter_id", RECRUITER_ID],
    ]);
  });

  it("treats an invalid id as not found", async () => {
    expect(await getJobForEditing("nope")).toEqual({ success: false, error: "Job posting not found." });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("refuses a signed-out user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });

    expect(await getJobForEditing(JOB_ID)).toEqual({
      success: false,
      error: "Unable to authenticate. Please sign in again.",
    });
  });

  it("explains when the security check cannot be completed", async () => {
    mocks.assurance.mockResolvedValue({ data: null, error: { message: "boom" } });

    expect(await getJobForEditing(JOB_ID)).toEqual({
      success: false,
      error: "Unable to verify authentication security.",
    });
  });

  it("only lets recruiters open the edit form", async () => {
    mocks.profile = { data: null, error: null };

    expect(await getJobForEditing(JOB_ID)).toEqual({
      success: false,
      error: "Only recruiters can edit job postings.",
    });
    expect(mocks.calls.some((c) => c.table === "job")).toBe(false);
  });

  it("reports another recruiter's or a missing posting as not found", async () => {
    mocks.job = { data: null, error: null };

    expect(await getJobForEditing(JOB_ID)).toEqual({ success: false, error: "Job posting not found." });
  });

  it("returns a friendly error when the posting cannot be loaded", async () => {
    mocks.job = { data: null, error: { message: "boom" } };

    expect(await getJobForEditing(JOB_ID)).toEqual({
      success: false,
      error: "Unable to load this job posting. Please try again.",
    });
  });
});
