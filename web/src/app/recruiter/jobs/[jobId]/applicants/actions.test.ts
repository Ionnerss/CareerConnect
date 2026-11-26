import { beforeEach, describe, expect, it, vi } from "vitest";
import { openApplicantDocument, updateApplicantStatus, type ApplicationStatus } from "./actions";

type Result = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getApplicantDocumentUrl: vi.fn(),
  revalidatePath: vi.fn(),
  job: { data: null, error: null } as Result,
  application: { data: null, error: null } as Result,
  calls: [] as { table: string; method: string; args: unknown[] }[],
}));

function query(table: string) {
  const result = async () => (table === "job" ? mocks.job : mocks.application);
  const builder: Record<string, unknown> = { single: result, maybeSingle: result };
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
    auth: { getUser: mocks.getUser },
    from: (table: string) => query(table),
  })),
}));
vi.mock("@/lib/recruiter/applicant-documents", () => ({
  getApplicantDocumentUrl: mocks.getApplicantDocumentUrl,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const RECRUITER_ID = "recruiter-1";
const JOB_ID = "job-1";
const APPLICATION_ID = "app-1";

function calls(table: string, method: string) {
  return mocks.calls.filter((c) => c.table === table && c.method === method).map((c) => c.args);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.getUser.mockResolvedValue({ data: { user: { id: RECRUITER_ID } } });
  mocks.job = { data: { id: JOB_ID }, error: null };
  mocks.application = { data: { id: APPLICATION_ID }, error: null };
});

describe("updateApplicantStatus", () => {
  it.each<ApplicationStatus>(["In Progress", "Interview", "Accepted", "Rejected"])(
    "moves an applicant of the recruiter's own posting to %s",
    async (status) => {
      expect(await updateApplicantStatus(APPLICATION_ID, JOB_ID, status)).toEqual({ success: true });

      expect(calls("job", "eq")).toEqual([
        ["id", JOB_ID],
        ["recruiter_id", RECRUITER_ID],
      ]);
      expect(calls("applications", "update")).toEqual([[{ status }]]);
      expect(calls("applications", "eq")).toEqual([
        ["id", APPLICATION_ID],
        ["job_id", JOB_ID],
      ]);
      expect(mocks.revalidatePath).toHaveBeenCalledWith(`/recruiter/jobs/${JOB_ID}/applicants`);
    },
  );

  it("refuses an unknown status without contacting the database", async () => {
    const result = await updateApplicantStatus(APPLICATION_ID, JOB_ID, "Hired" as ApplicationStatus);

    expect(result).toEqual({ success: false, error: "Invalid status." });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("refuses a signed-out user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    expect(await updateApplicantStatus(APPLICATION_ID, JOB_ID, "Interview")).toEqual({
      success: false,
      error: "Not authenticated.",
    });
    expect(calls("applications", "update")).toHaveLength(0);
  });

  it("refuses to change applicants of another recruiter's posting", async () => {
    mocks.job = { data: null, error: null };

    expect(await updateApplicantStatus(APPLICATION_ID, JOB_ID, "Rejected")).toEqual({
      success: false,
      error: "Unauthorized.",
    });
    expect(calls("applications", "update")).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the database error and does not refresh the page", async () => {
    mocks.application = { data: null, error: { message: "permission denied" } };

    expect(await updateApplicantStatus(APPLICATION_ID, JOB_ID, "Accepted")).toEqual({
      success: false,
      error: "permission denied",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an application that is not on this posting", async () => {
    mocks.application = { data: null, error: null };

    expect(await updateApplicantStatus(APPLICATION_ID, JOB_ID, "Accepted")).toEqual({
      success: false,
      error: "Unable to update status.",
    });
  });
});

describe("openApplicantDocument", () => {
  it("asks the documents helper for a link to the requested file", async () => {
    const request = { applicationId: APPLICATION_ID, kind: "resume" } as never;
    mocks.getApplicantDocumentUrl.mockResolvedValue({ success: true, url: "https://signed.example" });

    expect(await openApplicantDocument(request)).toEqual({ success: true, url: "https://signed.example" });
    expect(mocks.getApplicantDocumentUrl).toHaveBeenCalledWith(request);
  });
});
