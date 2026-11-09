import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOTIFICATIONS_LOAD_ERROR,
  NOTIFICATION_LIMIT,
  getRecruiterNotifications,
} from "./notifications";

type Result = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => ({
  getSignedInRecruiter: vi.fn(),
  calls: [] as { table: string; method: string; args: unknown[] }[],
  results: {} as Record<string, Result>,
}));

/** A fake query builder: records every call and resolves with the table's queued result. */
function fakeQuery(table: string) {
  const builder: Record<string, unknown> = {
    then: (resolve: (r: Result) => unknown) =>
      Promise.resolve(mocks.results[table] ?? { data: null, error: null }).then(resolve),
  };
  for (const method of ["select", "eq", "in", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      mocks.calls.push({ table, method, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: (table: string) => fakeQuery(table) })),
}));

vi.mock("@/lib/recruiter/applicants", () => ({
  getSignedInRecruiter: mocks.getSignedInRecruiter,
}));

const RECRUITER_ID = "11111111-1111-4111-8111-111111111111";

function call(table: string, method: string) {
  return mocks.calls.find((c) => c.table === table && c.method === method)?.args;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  for (const key of Object.keys(mocks.results)) delete mocks.results[key];
  mocks.getSignedInRecruiter.mockResolvedValue({ success: true, userId: RECRUITER_ID });
});

describe("getRecruiterNotifications", () => {
  it("returns the sign-in or role error without loading anything", async () => {
    mocks.getSignedInRecruiter.mockResolvedValue({
      success: false,
      error: "Only recruiters can view applicants.",
    });

    expect(await getRecruiterNotifications()).toEqual({
      success: false,
      error: "Only recruiters can view applicants.",
    });
    expect(mocks.calls).toHaveLength(0);
  });

  it("returns no notifications when the recruiter has no postings", async () => {
    mocks.results.job = { data: [], error: null };

    expect(await getRecruiterNotifications()).toEqual({ success: true, notifications: [] });
    expect(mocks.calls.some((c) => c.table === "applications")).toBe(false);
  });

  it("builds one notification per application to the recruiter's own postings, newest first", async () => {
    mocks.results.job = {
      data: [
        { id: "job-1", title: "Software Dev" },
        { id: "job-2", title: "  " },
      ],
      error: null,
    };
    mocks.results.applications = {
      data: [
        { id: "app-2", job_id: "job-1", created_at: "2026-11-09T18:00:00Z", profiles: { full_name: "Catalin B" } },
        { id: "app-1", job_id: "job-2", created_at: "2026-11-08T12:00:00Z", profiles: [{ full_name: null }] },
      ],
      error: null,
    };

    expect(await getRecruiterNotifications()).toEqual({
      success: true,
      notifications: [
        {
          id: "app-2",
          jobId: "job-1",
          jobTitle: "Software Dev",
          applicantName: "Catalin B",
          createdAt: "2026-11-09T18:00:00Z",
        },
        {
          id: "app-1",
          jobId: "job-2",
          jobTitle: "your job posting",
          applicantName: null,
          createdAt: "2026-11-08T12:00:00Z",
        },
      ],
    });

    expect(call("job", "eq")).toEqual(["recruiter_id", RECRUITER_ID]);
    expect(call("applications", "in")).toEqual(["job_id", ["job-1", "job-2"]]);
    expect(call("applications", "order")).toEqual(["created_at", { ascending: false }]);
    expect(call("applications", "limit")).toEqual([NOTIFICATION_LIMIT]);
  });

  it("returns a friendly error when the postings cannot be loaded", async () => {
    mocks.results.job = { data: null, error: { message: "boom" } };

    expect(await getRecruiterNotifications()).toEqual({ success: false, error: NOTIFICATIONS_LOAD_ERROR });
  });

  it("returns a friendly error when the applications cannot be loaded", async () => {
    mocks.results.job = { data: [{ id: "job-1", title: "Software Dev" }], error: null };
    mocks.results.applications = { data: null, error: { message: "boom" } };

    expect(await getRecruiterNotifications()).toEqual({ success: false, error: NOTIFICATIONS_LOAD_ERROR });
  });
});
