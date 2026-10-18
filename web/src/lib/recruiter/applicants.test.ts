import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_ERROR,
  JOB_NOT_FOUND_ERROR,
  NOT_RECRUITER_ERROR,
  formatApplicationStatus,
  getJobApplicants,
  getRecruiterJobs,
} from "./applicants";

type Result = { data: unknown; error: unknown };

const { mockGetUser, mockFrom, calls, results } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  calls: [] as { table: string; method: string; args: unknown[] }[],
  results: {} as Record<string, Result[]>,
}));

/** A fake query builder: every method records its call and returns itself; awaiting it returns the next queued result. */
function fakeQuery(table: string) {
  const next = () => Promise.resolve(results[table]?.shift() ?? { data: null, error: null });
  const builder: Record<string, unknown> = {
    then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      next().then(resolve, reject),
  };
  for (const method of ["select", "eq", "order", "in"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return builder;
    };
  }
  builder.maybeSingle = () => next();
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

const RECRUITER_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";

function signedInAs(role: string | null) {
  mockGetUser.mockResolvedValueOnce({ data: { user: { id: RECRUITER_ID } }, error: null });
  results.profiles = [{ data: role ? { role } : null, error: null }];
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  mockFrom.mockImplementation((table: string) => fakeQuery(table));
});

describe("getRecruiterJobs", () => {
  it("asks the user to sign in when there is no session", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    expect(await getRecruiterJobs()).toEqual({ success: false, error: AUTH_ERROR });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("blocks users who are not recruiters", async () => {
    signedInAs("job_seeker");

    expect(await getRecruiterJobs()).toEqual({ success: false, error: NOT_RECRUITER_ERROR });
    expect(mockFrom).not.toHaveBeenCalledWith("job");
  });

  it("returns only the recruiter's own postings with applicant counts", async () => {
    signedInAs("recruiter");
    results.job = [
      {
        data: [
          { id: JOB_ID, title: "Developer", location: "Montreal", status: "open", created_at: "2026-10-13", applications: [{ count: 3 }] },
          { id: "job-2", title: "Analyst", location: "Toronto", status: "open", created_at: "2026-10-12", applications: [] },
        ],
        error: null,
      },
    ];

    const result = await getRecruiterJobs();

    expect(calls).toContainEqual({ table: "job", method: "eq", args: ["recruiter_id", RECRUITER_ID] });
    expect(result).toEqual({
      success: true,
      jobs: [
        { id: JOB_ID, title: "Developer", location: "Montreal", status: "open", created_at: "2026-10-13", applicant_count: 3 },
        { id: "job-2", title: "Analyst", location: "Toronto", status: "open", created_at: "2026-10-12", applicant_count: 0 },
      ],
    });
  });

  it("returns a friendly error when the database fails", async () => {
    signedInAs("recruiter");
    results.job = [{ data: null, error: { message: "boom" } }];

    expect(await getRecruiterJobs()).toEqual({
      success: false,
      error: "Unable to load your job postings. Please try again.",
    });
  });
});

describe("getJobApplicants", () => {
  it("rejects an invalid job id without querying the database", async () => {
    expect(await getJobApplicants("not-a-uuid")).toEqual({ success: false, error: JOB_NOT_FOUND_ERROR });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("blocks users who are not recruiters", async () => {
    signedInAs("job_seeker");

    expect(await getJobApplicants(JOB_ID)).toEqual({ success: false, error: NOT_RECRUITER_ERROR });
  });

  it("does not show applicants for a posting owned by another recruiter", async () => {
    signedInAs("recruiter");
    results.job = [{ data: null, error: null }];

    expect(await getJobApplicants(JOB_ID)).toEqual({ success: false, error: JOB_NOT_FOUND_ERROR });
    expect(calls).toContainEqual({ table: "job", method: "eq", args: ["recruiter_id", RECRUITER_ID] });
    expect(mockFrom).not.toHaveBeenCalledWith("applications");
  });

  it("lists applicants with name, date and status, oldest first", async () => {
    signedInAs("recruiter");
    const job = { id: JOB_ID, title: "Developer", location: "Montreal", status: "open" };
    results.job = [{ data: job, error: null }];
    results.applications = [
      {
        data: [
          { id: "app-1", applicant_id: "user-1", status: "applied", created_at: "2026-10-10T12:00:00Z", profiles: { full_name: "Sam Lee" } },
          { id: "app-2", applicant_id: "user-2", status: "interview", created_at: "2026-10-11T12:00:00Z", profiles: null },
        ],
        error: null,
      },
    ];

    const result = await getJobApplicants(JOB_ID);

    expect(calls).toContainEqual({ table: "applications", method: "eq", args: ["job_id", JOB_ID] });
    expect(calls).toContainEqual({ table: "applications", method: "order", args: ["created_at", { ascending: true }] });
    expect(result).toEqual({
      success: true,
      job,
      applicants: [
        { application_id: "app-1", applicant_id: "user-1", full_name: "Sam Lee", status: "applied", applied_at: "2026-10-10T12:00:00Z", skill_match: null },
        { application_id: "app-2", applicant_id: "user-2", full_name: null, status: "interview", applied_at: "2026-10-11T12:00:00Z", skill_match: null },
      ],
      required_skills: [],
    });
    expect(mockFrom).not.toHaveBeenCalledWith("profile_skills");
  });

  describe("skill match", () => {
    const job = { id: JOB_ID, title: "Developer", location: "Montreal", status: "open" };

    function twoApplicants() {
      return [
        { id: "app-1", applicant_id: "user-1", status: "applied", created_at: "2026-10-10T12:00:00Z", profiles: { full_name: "Sam Lee" } },
        { id: "app-2", applicant_id: "user-2", status: "applied", created_at: "2026-10-11T12:00:00Z", profiles: { full_name: "Alex Kim" } },
      ];
    }

    it("scores each applicant against the required skills and lists the best match first", async () => {
      signedInAs("recruiter");
      results.job = [{ data: { ...job, required_skills: "TypeScript, React, SQL, Git" }, error: null }];
      results.applications = [{ data: twoApplicants(), error: null }];
      results.profile_skills = [
        {
          data: [
            { profile_id: "user-1", name: "react" },
            { profile_id: "user-2", name: "TypeScript" },
            { profile_id: "user-2", name: "React" },
            { profile_id: "user-2", name: "SQL" },
          ],
          error: null,
        },
      ];

      const result = await getJobApplicants(JOB_ID);

      expect(calls).toContainEqual({ table: "profile_skills", method: "in", args: ["profile_id", ["user-1", "user-2"]] });
      expect(result.success && result.required_skills).toEqual(["TypeScript", "React", "SQL", "Git"]);
      expect(result.success && result.applicants.map((a) => [a.full_name, a.skill_match?.percent])).toEqual([
        ["Alex Kim", 75],
        ["Sam Lee", 25],
      ]);
      expect(result.success && result.applicants[0].skill_match?.missing).toEqual(["Git"]);
    });

    it("keeps oldest-first order for equal scores and scores 0 for applicants with no skills", async () => {
      signedInAs("recruiter");
      results.job = [{ data: { ...job, required_skills: "React" }, error: null }];
      results.applications = [{ data: twoApplicants(), error: null }];
      results.profile_skills = [{ data: [], error: null }];

      const result = await getJobApplicants(JOB_ID);

      expect(result.success && result.applicants.map((a) => [a.full_name, a.skill_match?.percent])).toEqual([
        ["Sam Lee", 0],
        ["Alex Kim", 0],
      ]);
    });

    it("returns a friendly error when skills cannot be loaded", async () => {
      signedInAs("recruiter");
      results.job = [{ data: { ...job, required_skills: "React" }, error: null }];
      results.applications = [{ data: twoApplicants(), error: null }];
      results.profile_skills = [{ data: null, error: { message: "boom" } }];

      expect(await getJobApplicants(JOB_ID)).toEqual({
        success: false,
        error: "Unable to load applicant skills. Please try again.",
      });
    });

    it("does not look up skills when nobody has applied", async () => {
      signedInAs("recruiter");
      results.job = [{ data: { ...job, required_skills: "React" }, error: null }];
      results.applications = [{ data: [], error: null }];

      await getJobApplicants(JOB_ID);

      expect(mockFrom).not.toHaveBeenCalledWith("profile_skills");
    });
  });

  it("returns an empty list when nobody has applied", async () => {
    signedInAs("recruiter");
    results.job = [{ data: { id: JOB_ID, title: "Developer", location: "Montreal", status: "open" }, error: null }];
    results.applications = [{ data: [], error: null }];

    const result = await getJobApplicants(JOB_ID);

    expect(result.success && result.applicants).toEqual([]);
  });

  it("returns a friendly error when applicants cannot be loaded", async () => {
    signedInAs("recruiter");
    results.job = [{ data: { id: JOB_ID, title: "Developer", location: "Montreal", status: "open" }, error: null }];
    results.applications = [{ data: null, error: { message: "boom" } }];

    expect(await getJobApplicants(JOB_ID)).toEqual({
      success: false,
      error: "Unable to load applicants. Please try again.",
    });
  });
});

describe("formatApplicationStatus", () => {
  it.each([
    ["applied", "Applied"],
    ["under_review", "Under review"],
    ["interview", "Interview"],
    ["some_new_status", "Some new status"],
    ["", "Unknown"],
  ])("formats %s as %s", (status, label) => {
    expect(formatApplicationStatus(status)).toBe(label);
  });
});
