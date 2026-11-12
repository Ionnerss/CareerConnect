import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPLICATION_NOT_FOUND_ERROR,
  INTERVIEW_CANCELLED_ERROR,
  INTERVIEW_FORM_ERROR,
  INTERVIEW_NOT_FOUND_ERROR,
  INTERVIEW_SAVE_ERROR,
  INTERVIEWS_LOAD_ERROR,
  NOTHING_TO_RESCHEDULE_ERROR,
  cancelInterview,
  createInterview,
  getInterviewSchedulingContext,
  getRecruiterInterviews,
  updateInterview,
} from "./interviews";

type Result = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => ({
  getSignedInRecruiter: vi.fn(),
  calls: [] as { table: string; method: string; args: unknown[] }[],
  results: {} as Record<string, Result[]>,
}));

/** A fake query builder: records every call and resolves with the table's next queued result. */
function fakeQuery(table: string) {
  const next = () => Promise.resolve(mocks.results[table]?.shift() ?? { data: null, error: null });
  const builder: Record<string, unknown> = {
    then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => next().then(resolve, reject),
  };
  for (const method of ["select", "insert", "update", "eq", "neq", "order"]) {
    builder[method] = (...args: unknown[]) => {
      mocks.calls.push({ table, method, args });
      return builder;
    };
  }
  for (const method of ["single", "maybeSingle"]) {
    builder[method] = () => {
      mocks.calls.push({ table, method, args: [] });
      return next();
    };
  }
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => fakeQuery(table),
    // Database functions are recorded under "rpc:<name>" and use that queue.
    rpc: (name: string, args: unknown) => {
      mocks.calls.push({ table: `rpc:${name}`, method: "rpc", args: [args] });
      return Promise.resolve(mocks.results[`rpc:${name}`]?.shift() ?? { data: null, error: null });
    },
  })),
}));

vi.mock("@/lib/recruiter/applicants", () => ({
  getSignedInRecruiter: mocks.getSignedInRecruiter,
}));

const RECRUITER_ID = "11111111-1111-4111-8111-111111111111";
const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const INTERVIEW_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-11-12T20:00:00Z");

const form = {
  scheduledAt: "2026-11-19T14:30",
  responseDeadline: "2026-11-17T17:00",
  durationMinutes: "30",
  location: "Room 2.101",
  meetingUrl: "",
  notes: "Bring your ID",
};

const ownApplication = {
  id: APPLICATION_ID,
  applicant_id: "applicant-1",
  job_id: "job-1",
  profiles: { full_name: "Catalin B" },
  job: { title: "Software Dev", firm_name: "Acme", recruiter_id: RECRUITER_ID },
};

function queue(table: string, ...results: Result[]) {
  mocks.results[table] = [...(mocks.results[table] ?? []), ...results];
}

function callsTo(table: string, method: string) {
  return mocks.calls.filter((c) => c.table === table && c.method === method).map((c) => c.args);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  for (const key of Object.keys(mocks.results)) delete mocks.results[key];
  mocks.getSignedInRecruiter.mockResolvedValue({ success: true, userId: RECRUITER_ID });
});

describe("getRecruiterInterviews", () => {
  it("returns the sign-in or role error without loading anything", async () => {
    mocks.getSignedInRecruiter.mockResolvedValue({ success: false, error: "Only recruiters can view applicants." });

    expect(await getRecruiterInterviews()).toEqual({ success: false, error: "Only recruiters can view applicants." });
    expect(mocks.calls).toHaveLength(0);
  });

  it("lists only the recruiter's interviews, soonest first, with job and applicant details", async () => {
    queue("interviews", {
      data: [
        {
          id: "int-1",
          application_id: "app-1",
          scheduled_at: "2026-11-19T19:30:00Z",
          response_deadline: "2026-11-17T22:00:00Z",
          duration_minutes: 30,
          location: null,
          meeting_url: "https://meet.example.com/abc",
          notes: null,
          status: "accepted",
          applicant: { full_name: " Catalin B " },
          application: { job_id: "job-1", job: { title: "Software Dev", firm_name: "Acme" } },
        },
        {
          id: "int-2",
          application_id: "app-2",
          scheduled_at: "2026-11-20T15:00:00Z",
          response_deadline: null,
          duration_minutes: 60,
          location: "Room 2.101",
          meeting_url: null,
          notes: "Bring ID",
          status: "pending",
          applicant: [{ full_name: null }],
          application: [{ job_id: "job-2", job: [{ title: "  ", firm_name: null }] }],
        },
      ],
      error: null,
    });

    const result = await getRecruiterInterviews();

    expect(result).toEqual({
      success: true,
      interviews: [
        {
          id: "int-1",
          applicationId: "app-1",
          jobId: "job-1",
          jobTitle: "Software Dev",
          companyName: "Acme",
          applicantName: "Catalin B",
          scheduledAt: "2026-11-19T19:30:00Z",
          responseDeadline: "2026-11-17T22:00:00Z",
          durationMinutes: 30,
          location: null,
          meetingUrl: "https://meet.example.com/abc",
          notes: null,
          status: "accepted",
        },
        {
          id: "int-2",
          applicationId: "app-2",
          jobId: "job-2",
          jobTitle: "your job posting",
          companyName: null,
          applicantName: null,
          scheduledAt: "2026-11-20T15:00:00Z",
          responseDeadline: null,
          durationMinutes: 60,
          location: "Room 2.101",
          meetingUrl: null,
          notes: "Bring ID",
          status: "pending",
        },
      ],
    });
    expect(callsTo("interviews", "eq")).toEqual([["recruiter_id", RECRUITER_ID]]);
    expect(callsTo("interviews", "order")).toEqual([["scheduled_at", { ascending: true }]]);
  });

  it("returns a friendly error when the interviews cannot be loaded", async () => {
    queue("interviews", { data: null, error: { message: "boom" } });

    expect(await getRecruiterInterviews()).toEqual({ success: false, error: INTERVIEWS_LOAD_ERROR });
  });
});

describe("getInterviewSchedulingContext", () => {
  it("returns the job, company, employer and applicant for the form", async () => {
    queue("applications", { data: ownApplication, error: null });
    queue("profiles", { data: { full_name: "Matthew L" }, error: null });

    expect(await getInterviewSchedulingContext(APPLICATION_ID)).toEqual({
      success: true,
      context: {
        applicationId: APPLICATION_ID,
        jobId: "job-1",
        jobTitle: "Software Dev",
        companyName: "Acme",
        applicantName: "Catalin B",
        employerName: "Matthew L",
      },
    });
  });

  it("refuses applications to another recruiter's posting", async () => {
    queue("applications", {
      data: { ...ownApplication, job: { ...ownApplication.job, recruiter_id: "someone-else" } },
      error: null,
    });

    expect(await getInterviewSchedulingContext(APPLICATION_ID)).toEqual({
      success: false,
      error: APPLICATION_NOT_FOUND_ERROR,
    });
  });

  it("refuses an id that is not a uuid without loading anything", async () => {
    expect(await getInterviewSchedulingContext("not-an-id")).toEqual({
      success: false,
      error: APPLICATION_NOT_FOUND_ERROR,
    });
    expect(mocks.calls).toHaveLength(0);
  });
});

describe("createInterview", () => {
  it("returns field errors without saving when the details are invalid", async () => {
    const result = await createInterview(APPLICATION_ID, { ...form, scheduledAt: "" }, NOW);

    expect(result).toMatchObject({ success: false, error: INTERVIEW_FORM_ERROR });
    expect(!result.success && "fieldErrors" in result && result.fieldErrors?.scheduledAt).toBeTruthy();
    expect(mocks.calls).toHaveLength(0);
  });

  it("does not save an interview for someone else's applicant", async () => {
    queue("applications", { data: null, error: null });

    expect(await createInterview(APPLICATION_ID, form, NOW)).toEqual({
      success: false,
      error: APPLICATION_NOT_FOUND_ERROR,
    });
    expect(callsTo("interviews", "insert")).toHaveLength(0);
  });

  it("saves a pending interview and moves a new application to the Interview stage", async () => {
    queue("applications", { data: ownApplication, error: null }, { data: null, error: null });
    queue("interviews", { data: { id: INTERVIEW_ID }, error: null });

    expect(await createInterview(APPLICATION_ID, form, NOW)).toEqual({
      success: true,
      interviewId: INTERVIEW_ID,
      jobId: "job-1",
    });

    expect(callsTo("interviews", "insert")).toEqual([
      [
        {
          application_id: APPLICATION_ID,
          recruiter_id: RECRUITER_ID,
          applicant_id: "applicant-1",
          scheduled_at: "2026-11-19T19:30:00.000Z",
          response_deadline: "2026-11-17T22:00:00.000Z",
          duration_minutes: 30,
          location: "Room 2.101",
          meeting_url: null,
          notes: "Bring your ID",
          status: "pending",
        },
      ],
    ]);
    expect(callsTo("applications", "update")).toEqual([[{ status: "Interview" }]]);
    expect(callsTo("applications", "eq")).toContainEqual(["status", "In Progress"]);
  });
});

describe("updateInterview", () => {
  const existing = {
    id: INTERVIEW_ID,
    status: "accepted",
    scheduled_at: "2026-11-19T19:30:00+00:00",
    response_deadline: "2026-11-17T22:00:00+00:00",
    application: { job_id: "job-1" },
  };

  it("cannot change a cancelled interview", async () => {
    queue("interviews", { data: { ...existing, status: "cancelled" }, error: null });

    expect(await updateInterview(INTERVIEW_ID, form, NOW)).toEqual({
      success: false,
      error: INTERVIEW_CANCELLED_ERROR,
    });
    expect(callsTo("rpc:reschedule_interview", "rpc")).toHaveLength(0);
  });

  it("reschedules through the database when the time changes", async () => {
    queue("interviews", { data: existing, error: null });

    const result = await updateInterview(INTERVIEW_ID, { ...form, scheduledAt: "2026-11-20T10:00" }, NOW);

    expect(result).toEqual({ success: true, interviewId: INTERVIEW_ID, jobId: "job-1" });
    expect(callsTo("rpc:reschedule_interview", "rpc")).toEqual([
      [
        {
          p_interview_id: INTERVIEW_ID,
          p_scheduled_at: "2026-11-20T15:00:00.000Z",
          p_response_deadline: "2026-11-17T22:00:00.000Z",
        },
      ],
    ]);
    // Recruiters cannot update the table directly; only the database function changes it.
    expect(callsTo("interviews", "update")).toHaveLength(0);
    expect(callsTo("interviews", "eq")).toContainEqual(["recruiter_id", RECRUITER_ID]);
  });

  it("asks for a new time when nothing would change", async () => {
    queue("interviews", { data: existing, error: null });

    expect(await updateInterview(INTERVIEW_ID, form, NOW)).toEqual({
      success: false,
      error: NOTHING_TO_RESCHEDULE_ERROR,
    });
    expect(callsTo("rpc:reschedule_interview", "rpc")).toHaveLength(0);
  });

  it("shows the database's reason when rescheduling is refused", async () => {
    queue("interviews", { data: existing, error: null });
    queue("rpc:reschedule_interview", {
      data: null,
      error: { code: "P0001", message: "This interview cannot be rescheduled." },
    });

    expect(await updateInterview(INTERVIEW_ID, { ...form, responseDeadline: "2026-11-18T09:00" }, NOW)).toEqual({
      success: false,
      error: "This interview cannot be rescheduled.",
    });
  });
});

describe("cancelInterview", () => {
  it("cancels through the database so the applicant is told", async () => {
    expect(await cancelInterview(INTERVIEW_ID)).toEqual({
      success: true,
      interviewId: INTERVIEW_ID,
      jobId: null,
    });
    expect(callsTo("rpc:cancel_interview", "rpc")).toEqual([[{ p_interview_id: INTERVIEW_ID }]]);
    expect(callsTo("interviews", "update")).toHaveLength(0);
  });

  it("shows the database's reason when it refuses", async () => {
    queue("rpc:cancel_interview", {
      data: null,
      error: { code: "P0001", message: "This interview cannot be cancelled." },
    });

    expect(await cancelInterview(INTERVIEW_ID)).toEqual({
      success: false,
      error: "This interview cannot be cancelled.",
    });
  });

  it("hides unexpected database errors behind a friendly message", async () => {
    queue("rpc:cancel_interview", { data: null, error: { code: "42501", message: "permission denied" } });

    expect(await cancelInterview(INTERVIEW_ID)).toEqual({ success: false, error: INTERVIEW_SAVE_ERROR });
  });

  it("refuses an id that is not a uuid", async () => {
    expect(await cancelInterview("nope")).toEqual({ success: false, error: INTERVIEW_NOT_FOUND_ERROR });
    expect(mocks.calls).toHaveLength(0);
  });
});
