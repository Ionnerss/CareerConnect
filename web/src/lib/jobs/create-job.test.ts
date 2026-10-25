import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_ERROR,
  CREATE_JOB_ERROR,
  INVALID_JOB_ERROR,
  NOT_RECRUITER_ERROR,
  createJobPosting,
} from "./create-job";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileResult: { data: null as unknown, error: null as unknown },
  insertResult: { data: null as unknown, error: null as unknown },
  insert: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}));

const RECRUITER_ID = "11111111-1111-4111-8111-111111111111";

const form = {
  title: "Junior Frontend Developer",
  firm_name: "Acme Inc.",
  location: "Montreal, QC",
  work_mode: "Hybrid",
  required_skills: "React, typescript, react",
  salary: "65000",
  experience: "",
  description: "Build the web app.",
};

const createdJob = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Junior Frontend Developer",
  location: "Montreal, QC",
  status: "open",
  created_at: "2026-10-24T00:00:00Z",
};

function signedInAs(role: string | null) {
  mocks.getUser.mockResolvedValue({ data: { user: { id: RECRUITER_ID } }, error: null });
  mocks.profileResult = { data: role ? { role } : null, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertResult = { data: createdJob, error: null };

  mocks.from.mockImplementation((table: string) => {
    if (table === "profiles") {
      type ProfileQuery = {
        select: () => ProfileQuery;
        eq: () => ProfileQuery;
        maybeSingle: () => Promise<unknown>;
      };
      const query: ProfileQuery = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => mocks.profileResult,
      };
      return query;
    }

    return {
      insert: (row: unknown) => {
        mocks.insert(row);
        return { select: () => ({ single: async () => mocks.insertResult }) };
      },
    };
  });
});

describe("createJobPosting", () => {
  it("rejects invalid input before touching the database", async () => {
    const result = await createJobPosting({ ...form, title: "" });

    expect(result).toEqual({ success: false, error: INVALID_JOB_ERROR });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("asks the user to sign in when there is no session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    expect(await createJobPosting(form)).toEqual({ success: false, error: AUTH_ERROR });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("blocks job seekers from posting", async () => {
    signedInAs("job_seeker");

    expect(await createJobPosting(form)).toEqual({ success: false, error: NOT_RECRUITER_ERROR });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("blocks users without a profile", async () => {
    signedInAs(null);

    expect(await createJobPosting(form)).toEqual({ success: false, error: NOT_RECRUITER_ERROR });
  });

  it("creates an open posting owned by the recruiter with cleaned-up values", async () => {
    signedInAs("recruiter");

    expect(await createJobPosting(form)).toEqual({ success: true, job: createdJob });
    expect(mocks.insert).toHaveBeenCalledWith({
      recruiter_id: RECRUITER_ID,
      title: "Junior Frontend Developer",
      firm_name: "Acme Inc.",
      location: "Montreal, QC",
      work_mode: "Hybrid",
      required_skills: "React, typescript",
      salary: 65000,
      experience: null,
      description: "Build the web app.",
      status: "open",
    });
  });

  it("saves a closed posting when the recruiter chooses Closed", async () => {
    signedInAs("recruiter");

    await createJobPosting({ ...form, status: "closed" });

    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ status: "closed" }));
  });

  it("ignores a recruiter_id sent from the browser", async () => {
    signedInAs("recruiter");

    await createJobPosting({ ...form, recruiter_id: "someone-else" });

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recruiter_id: RECRUITER_ID }),
    );
  });

  it("shows the not-a-recruiter message when the database policy refuses the insert", async () => {
    signedInAs("recruiter");
    mocks.insertResult = { data: null, error: { code: "42501", message: "RLS" } };

    expect(await createJobPosting(form)).toEqual({ success: false, error: NOT_RECRUITER_ERROR });
  });

  it("returns a friendly error when the insert fails", async () => {
    signedInAs("recruiter");
    mocks.insertResult = { data: null, error: { code: "XX000", message: "boom" } };

    expect(await createJobPosting(form)).toEqual({ success: false, error: CREATE_JOB_ERROR });
  });
});
