import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserApplications } from "./application_status_logic";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

const { mockRequireMfaForAction } = vi.hoisted(() => ({
  mockRequireMfaForAction: vi.fn(),
}));

vi.mock("@/lib/auth/require-mfa", () => ({
  requireMfaForAction: mockRequireMfaForAction,
}));

const USER_ID = "user-a";
const JOB_ID = "job-a";
const RECRUITER_ID = "recruiter-a";
const CREATED_AT = "2026-11-09T12:00:00Z";

let results: Record<string, QueryResult[]>;
let calls: Array<{ table: string; method: string; args: unknown[] }>;

function nextResult(table: string): Promise<QueryResult> {
  const result = results[table]?.shift();

  if (!result) {
    throw new Error(`Unexpected query for ${table}`);
  }

  return Promise.resolve(result);
}

function fakeQuery(table: string) {
  const builder = {
    select(...args: unknown[]) {
      calls.push({ table, method: "select", args });
      return builder;
    },
    eq(...args: unknown[]) {
      calls.push({ table, method: "eq", args });
      return builder;
    },
    order(...args: unknown[]) {
      calls.push({ table, method: "order", args });
      return builder;
    },
    range(...args: unknown[]) {
      calls.push({ table, method: "range", args });
      return nextResult(table);
    },
    in(...args: unknown[]) {
      calls.push({ table, method: "in", args });
      return nextResult(table);
    },
    // Also lets the test fail meaningfully against the old unpaged query.
    then(
      resolve: (result: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) {
      return nextResult(table).then(resolve, reject);
    },
  };

  return builder;
}

function application(number: number) {
  return {
    id: `app-${String(number).padStart(4, "0")}`,
    job_id: JOB_ID,
    status: "In Progress",
    created_at: CREATED_AT,
  };
}

beforeEach(() => {
  calls = [];
  results = {};

  mockRequireMfaForAction.mockReset();
  mockRequireMfaForAction.mockResolvedValue({
    user: { id: USER_ID },
    supabase: { from: (table: string) => fakeQuery(table) },
  });
});

describe("getUserApplications", () => {
  it("returns all 1001 applications across pages in stable order", async () => {
    // All timestamps are equal, so id determines the order.
    const firstPage = Array.from(
      { length: 1000 },
      (_, index) => application(1001 - index),
    );

    results.applications = [
      { data: firstPage, error: null },
      { data: [application(1)], error: null },
    ];
    results.job = [
      {
        data: [{
          id: JOB_ID,
          title: "Developer",
          firm_name: "Acme",
          location: "Montreal",
          recruiter_id: RECRUITER_ID,
        }],
        error: null,
      },
    ];
    results.profiles_public = [
      {
        data: [{ id: RECRUITER_ID, full_name: "Recruiter" }],
        error: null,
      },
    ];

    const applications = await getUserApplications();

    expect(applications).toHaveLength(1001);
    expect(applications[0].id).toBe("app-1001");
    expect(applications.at(-1)?.id).toBe("app-0001");
    expect(applications.every((item) => item.job?.title === "Developer")).toBe(true);

    expect(calls.filter((call) => call.table === "applications" && call.method === "range"))
      .toEqual([
        { table: "applications", method: "range", args: [0, 999] },
        { table: "applications", method: "range", args: [1000, 1999] },
      ]);
    expect(calls).toContainEqual({
      table: "applications",
      method: "order",
      args: ["created_at", { ascending: false }],
    });
    expect(calls).toContainEqual({
      table: "applications",
      method: "order",
      args: ["id", { ascending: false }],
    });
  });

  it("throws when a later page fails instead of returning partial data", async () => {
    results.applications = [
      {
        data: Array.from(
          { length: 1000 },
          (_, index) => application(1001 - index),
        ),
        error: null,
      },
      { data: null, error: { message: "second page failed" } },
    ];

    await expect(getUserApplications()).rejects.toMatchObject({
      message: "second page failed",
    });

    expect(calls.filter((call) => call.table === "applications" && call.method === "range"))
      .toHaveLength(2);
    expect(calls.some((call) => call.table === "job")).toBe(false);
  });

    it("loads job and recruiter details in batches of at most 100 IDs", async () => {
        const ids = Array.from({ length: 101 }, (_, index) => 101 - index);
        const suffix = (number: number) => String(number).padStart(4, "0");

        results.applications = [
            {
            data: ids.map((number) => ({
                ...application(number),
                job_id: `job-${suffix(number)}`,
            })),
            error: null,
            },
        ];

        // Each mocked response contains at most 100 rows. An unbatched
        // lookup therefore cannot supply details for all 101 applications.
        results.job = [
            {
            data: ids.slice(0, 100).map((number) => ({
                id: `job-${suffix(number)}`,
                title: `Job ${number}`,
                firm_name: "Acme",
                location: "Montreal",
                recruiter_id: `recruiter-${suffix(number)}`,
            })),
            error: null,
            },
            {
            data: [{
                id: "job-0001",
                title: "Job 1",
                firm_name: "Acme",
                location: "Montreal",
                recruiter_id: "recruiter-0001",
            }],
            error: null,
            },
        ];

        results.profiles_public = [
            {
            data: ids.slice(0, 100).map((number) => ({
                id: `recruiter-${suffix(number)}`,
                full_name: `Recruiter ${number}`,
            })),
            error: null,
            },
            {
            data: [{
                id: "recruiter-0001",
                full_name: "Recruiter 1",
            }],
            error: null,
            },
        ];

        const loaded = await getUserApplications();

        expect(loaded).toHaveLength(101);
        expect(loaded[0]).toMatchObject({
            id: "app-0101",
            job: { title: "Job 101", recruiter_name: "Recruiter 101" },
        });
        expect(loaded.at(-1)).toMatchObject({
            id: "app-0001",
            job: { title: "Job 1", recruiter_name: "Recruiter 1" },
        });

        for (const table of ["job", "profiles_public"]) {
            const lookups = calls.filter(
            (call) => call.table === table && call.method === "in",
            );

            expect(lookups).toHaveLength(2);
            expect(lookups.map((call) => (call.args[1] as string[]).length))
            .toEqual([100, 1]);
        }
    });

    it("returns an empty list without looking up jobs or recruiters", async () => {
        results.applications = [{ data: [], error: null }];

        const applications = await getUserApplications();

        expect(applications).toEqual([]);
        expect(calls.some((call) => call.table === "job")).toBe(false);
        expect(calls.some((call) => call.table === "profiles_public")).toBe(false);
    });
});