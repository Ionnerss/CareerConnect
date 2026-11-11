import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_ERROR,
  AUTH_UNAVAILABLE_ERROR,
  LOAD_FAILED_ERROR,
  MAX_JOBS_CONSIDERED,
  MFA_REQUIRED_ERROR,
  NOT_JOB_SEEKER_ERROR,
  getRecommendationInputs,
} from "./recommendation-inputs";

type Result = { data: unknown; error: unknown };

const { mockGetUser, mockFrom, mockAssurance, calls, results } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockAssurance: vi.fn(),
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
  for (const method of ["select", "eq", "order", "limit"]) {
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
    auth: { getUser: mockGetUser, mfa: { getAuthenticatorAssuranceLevel: mockAssurance } },
    from: mockFrom,
  })),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-11T12:00:00Z");

function queue(overrides: Record<string, Result[]> = {}) {
  results.profiles = [{ data: { role: "job_seeker", location: "Montreal" }, error: null }];
  results.profile_skills = [
    { data: [{ name: "React", proficiency: "advanced" }, { name: "SQL", proficiency: "beginner" }], error: null },
  ];
  results.profile_education = [{ data: [], error: null }];
  results.profile_experience = [{ data: [], error: null }];
  results.profile_preferences = [
    {
      data: { desired_role: "Frontend Developer", desired_position: null, desired_salary: "30", work_mode: "remote" },
      error: null,
    },
  ];
  results.job = [
    {
      data: [
        {
          id: "good",
          title: "Frontend Developer",
          firm_name: "Globex",
          location: "Montreal",
          work_mode: "Remote",
          employment_type: "Full-time",
          required_skills: "React, SQL",
          salary: "80000",
          experience: null,
          description: null,
          status: "open",
          created_at: "2026-11-01T00:00:00Z",
        },
        {
          id: "already-applied",
          title: "Frontend Developer",
          firm_name: "Initech",
          location: "Montreal",
          work_mode: "Remote",
          employment_type: "Full-time",
          required_skills: "React",
          salary: null,
          experience: null,
          description: null,
          status: "open",
          created_at: "2026-11-02T00:00:00Z",
        },
      ],
      error: null,
    },
  ];
  results.applications = [{ data: [{ job_id: "already-applied" }], error: null }];
  Object.assign(results, overrides);
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  mockFrom.mockImplementation((table: string) => fakeQuery(table));
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  mockAssurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  queue();
});

describe("getRecommendationInputs", () => {
  it("stops before touching any table when the user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    expect(await getRecommendationInputs()).toEqual({
      success: false,
      code: "UNAUTHENTICATED",
      error: AUTH_ERROR,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("stops before touching any table while two-factor authentication is pending", async () => {
    mockAssurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });

    expect(await getRecommendationInputs()).toEqual({
      success: false,
      code: "MFA_REQUIRED",
      error: MFA_REQUIRED_ERROR,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("reports when the security check cannot be completed", async () => {
    mockAssurance.mockResolvedValue({ data: null, error: new Error("down") });

    expect(await getRecommendationInputs()).toEqual({
      success: false,
      code: "AUTH_UNAVAILABLE",
      error: AUTH_UNAVAILABLE_ERROR,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("blocks recruiters and users without a profile", async () => {
    results.profiles = [{ data: { role: "recruiter", location: null }, error: null }];
    expect(await getRecommendationInputs()).toEqual({
      success: false,
      code: "NOT_JOB_SEEKER",
      error: NOT_JOB_SEEKER_ERROR,
    });

    results.profiles = [{ data: null, error: null }];
    expect(await getRecommendationInputs()).toMatchObject({ success: false, code: "NOT_JOB_SEEKER" });
    expect(calls.some((call) => call.table === "job")).toBe(false);
  });

  it("fails cleanly when a profile table cannot be read", async () => {
    results.profile_skills = [{ data: null, error: { message: "boom" } }];

    expect(await getRecommendationInputs()).toEqual({
      success: false,
      code: "LOAD_FAILED",
      error: LOAD_FAILED_ERROR,
    });
  });

  it("fails cleanly when the postings cannot be read", async () => {
    results.job = [{ data: null, error: { message: "boom" } }];

    expect(await getRecommendationInputs()).toMatchObject({ success: false, code: "LOAD_FAILED" });
  });

  it("reads only the signed-in user's own profile rows", async () => {
    await getRecommendationInputs({ now: NOW });

    for (const table of ["profile_skills", "profile_education", "profile_experience", "profile_preferences"]) {
      const eq = calls.find((call) => call.table === table && call.method === "eq");
      expect(eq?.args).toEqual(["profile_id", USER_ID]);
    }
    expect(calls.find((call) => call.table === "applications" && call.method === "eq")?.args).toEqual([
      "applicant_id",
      USER_ID,
    ]);
    expect(calls.find((call) => call.table === "profiles" && call.method === "eq")?.args).toEqual(["id", USER_ID]);
  });

  it("asks only for open postings and caps how many it looks at", async () => {
    await getRecommendationInputs({ now: NOW });

    expect(calls.find((call) => call.table === "job" && call.method === "eq")?.args).toEqual(["status", "open"]);
    expect(calls.find((call) => call.table === "job" && call.method === "limit")?.args).toEqual([
      MAX_JOBS_CONSIDERED,
    ]);
  });

  it("returns the shortlist without postings the seeker already applied to", async () => {
    const response = await getRecommendationInputs({ now: NOW });

    expect(response.success).toBe(true);
    if (!response.success) return;
    expect(response.empty_profile).toBe(false);
    expect(response.considered_jobs).toBe(2);
    expect(response.shortlist.map((item) => item.job.id)).toEqual(["good"]);
    expect(response.shortlist[0].job.salary).toBe(80000);
    expect(response.seeker_state.preferences.desired_salary).toBe(30);
    expect(response.seeker_state.skills.map((skill) => skill.name)).toEqual(["React", "SQL"]);
    expect(response.seeker_state.location).toBe("Montreal");
  });

  it("returns an empty profile without loading any postings", async () => {
    results.profile_skills = [{ data: [], error: null }];
    results.profile_preferences = [{ data: null, error: null }];

    const response = await getRecommendationInputs({ now: NOW });

    expect(response).toMatchObject({ success: true, empty_profile: true, shortlist: [], considered_jobs: 0 });
    expect(calls.some((call) => call.table === "job" || call.table === "applications")).toBe(false);
  });

  it("never puts the seeker's name or email into the AI state", async () => {
    const response = await getRecommendationInputs({ now: NOW });

    expect(response.success).toBe(true);
    if (!response.success) return;
    expect(JSON.stringify(response.seeker_state)).not.toMatch(/full_name|email|contact/);
    expect(calls.some((call) => call.table === "profiles" && call.method === "select" && String(call.args[0]).includes("email"))).toBe(false);
  });
});
