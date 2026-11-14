import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOTIFICATIONS_LOAD_ERROR,
  NOTIFICATION_LIMIT,
  NOTIFICATION_NOT_FOUND_ERROR,
  NOTIFICATION_UPDATE_ERROR,
  getRecruiterNotifications,
  markAllNotificationsRead,
  setNotificationRead,
} from "./notifications";
import { getNotificationLink } from "./notification-links";

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
  for (const method of ["select", "update", "eq", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      mocks.calls.push({ table, method, args });
      return builder;
    };
  }
  builder.maybeSingle = () => {
    mocks.calls.push({ table, method: "maybeSingle", args: [] });
    return next();
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: (table: string) => fakeQuery(table) })),
}));

vi.mock("@/lib/recruiter/applicants", () => ({
  getSignedInRecruiter: mocks.getSignedInRecruiter,
}));

const RECRUITER_ID = "11111111-1111-4111-8111-111111111111";
const NOTIFICATION_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-11-12T20:00:00Z");

function queue(table: string, ...results: Result[]) {
  mocks.results[table] = [...(mocks.results[table] ?? []), ...results];
}

function callsTo(method: string) {
  return mocks.calls.filter((c) => c.table === "notifications" && c.method === method).map((c) => c.args);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  for (const key of Object.keys(mocks.results)) delete mocks.results[key];
  mocks.getSignedInRecruiter.mockResolvedValue({ success: true, userId: RECRUITER_ID });
});

describe("getRecruiterNotifications", () => {
  it("returns the sign-in or role error without loading anything", async () => {
    mocks.getSignedInRecruiter.mockResolvedValue({ success: false, error: "Only recruiters can view applicants." });

    expect(await getRecruiterNotifications()).toEqual({
      success: false,
      error: "Only recruiters can view applicants.",
    });
    expect(mocks.calls).toHaveLength(0);
  });

  it("loads the recruiter's own notifications from the notifications table, newest first", async () => {
    queue("notifications", {
      data: [
        {
          id: "n-2",
          type: "interview_response",
          title: "Interview Accepted",
          message: "Matthew L accepted the interview invitation for Software Dev.",
          created_at: "2026-11-12T18:00:00Z",
          is_read: false,
          job_id: "job-1",
          application_id: "app-1",
          interview_id: "int-1",
        },
        {
          id: "n-1",
          type: "application_update",
          title: " New application received ",
          message: "Catalin B applied for Software Dev.",
          created_at: "2026-11-11T12:00:00Z",
          is_read: true,
          job_id: "job-1",
          application_id: "app-2",
          interview_id: null,
        },
      ],
      error: null,
    });

    expect(await getRecruiterNotifications()).toEqual({
      success: true,
      notifications: [
        {
          id: "n-2",
          type: "interview_response",
          title: "Interview Accepted",
          message: "Matthew L accepted the interview invitation for Software Dev.",
          createdAt: "2026-11-12T18:00:00Z",
          isRead: false,
          jobId: "job-1",
          applicationId: "app-1",
          interviewId: "int-1",
        },
        {
          id: "n-1",
          type: "application_update",
          title: "New application received",
          message: "Catalin B applied for Software Dev.",
          createdAt: "2026-11-11T12:00:00Z",
          isRead: true,
          jobId: "job-1",
          applicationId: "app-2",
          interviewId: null,
        },
      ],
    });

    expect(callsTo("eq")).toEqual([["recipient_id", RECRUITER_ID]]);
    expect(callsTo("order")).toEqual([["created_at", { ascending: false }]]);
    expect(callsTo("limit")).toEqual([[NOTIFICATION_LIMIT]]);
  });

  it("returns a friendly error when the notifications cannot be loaded", async () => {
    queue("notifications", { data: null, error: { message: "boom" } });

    expect(await getRecruiterNotifications()).toEqual({ success: false, error: NOTIFICATIONS_LOAD_ERROR });
  });
});

describe("setNotificationRead", () => {
  it("marks the recruiter's own notification as read with the time it was read", async () => {
    queue("notifications", { data: { id: NOTIFICATION_ID }, error: null });

    expect(await setNotificationRead(NOTIFICATION_ID, true, NOW)).toEqual({ success: true });
    expect(callsTo("update")).toEqual([[{ is_read: true, read_at: "2026-11-12T20:00:00.000Z" }]]);
    expect(callsTo("eq")).toEqual([
      ["id", NOTIFICATION_ID],
      ["recipient_id", RECRUITER_ID],
    ]);
  });

  it("marks a notification as unread again", async () => {
    queue("notifications", { data: { id: NOTIFICATION_ID }, error: null });

    expect(await setNotificationRead(NOTIFICATION_ID, false, NOW)).toEqual({ success: true });
    expect(callsTo("update")).toEqual([[{ is_read: false, read_at: null }]]);
  });

  it("reports someone else's or a missing notification as not found", async () => {
    queue("notifications", { data: null, error: null });

    expect(await setNotificationRead(NOTIFICATION_ID, true, NOW)).toEqual({
      success: false,
      error: NOTIFICATION_NOT_FOUND_ERROR,
    });
  });

  it("refuses an id that is not a uuid without touching the database", async () => {
    expect(await setNotificationRead("nope", true, NOW)).toEqual({
      success: false,
      error: NOTIFICATION_NOT_FOUND_ERROR,
    });
    expect(mocks.calls).toHaveLength(0);
  });

  it("returns a friendly error when saving fails", async () => {
    queue("notifications", { data: null, error: { message: "boom" } });

    expect(await setNotificationRead(NOTIFICATION_ID, true, NOW)).toEqual({
      success: false,
      error: NOTIFICATION_UPDATE_ERROR,
    });
  });
});

describe("markAllNotificationsRead", () => {
  it("only marks the recruiter's unread notifications", async () => {
    expect(await markAllNotificationsRead(NOW)).toEqual({ success: true });
    expect(callsTo("update")).toEqual([[{ is_read: true, read_at: "2026-11-12T20:00:00.000Z" }]]);
    expect(callsTo("eq")).toEqual([
      ["recipient_id", RECRUITER_ID],
      ["is_read", false],
    ]);
  });

  it("returns a friendly error when saving fails", async () => {
    queue("notifications", { data: null, error: { message: "boom" } });

    expect(await markAllNotificationsRead(NOW)).toEqual({ success: false, error: NOTIFICATION_UPDATE_ERROR });
  });
});

describe("getNotificationLink", () => {
  it("sends interview replies to that interview on the interviews page", () => {
    expect(getNotificationLink({ type: "interview_response", interviewId: "int-1", jobId: "job-1" })).toEqual({
      href: "/recruiter/interviews#interview-int-1",
      label: "View interview",
    });
  });

  it("sends an interview notification without an interview id to the interviews page", () => {
    expect(getNotificationLink({ type: "interview_response", interviewId: null, jobId: "job-1" })).toEqual({
      href: "/recruiter/interviews",
      label: "View interview",
    });
  });

  it("sends a new application to that applicant's row", () => {
    expect(
      getNotificationLink({ type: "application_update", interviewId: null, jobId: "job-1", applicationId: "app-1" }),
    ).toEqual({
      href: "/recruiter/jobs/job-1/applicants#applicant-app-1",
      label: "View applicant",
    });
  });

  it("sends new applications without an application id to that posting's applicants", () => {
    expect(getNotificationLink({ type: "application_update", interviewId: null, jobId: "job-1" })).toEqual({
      href: "/recruiter/jobs/job-1/applicants",
      label: "View applicants",
    });
  });

  it("has no link when there is nothing to open", () => {
    expect(getNotificationLink({ type: "application_update", interviewId: null, jobId: null })).toBeNull();
  });
});
