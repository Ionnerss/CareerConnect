/** Tests where a job seeker's notification takes them when clicked (#257). */

import { describe, expect, it, vi } from "vitest";
import {
  applicationAnchorId,
  getSeekerNotificationLink,
  interviewAnchorId,
} from "./notification-links";

// The service imports the browser Supabase client; mapping a row doesn't need it.
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

import { mapNotification } from "./notification-service";

const APP_ID = "11111111-1111-4111-8111-111111111111";
const INTERVIEW_ID = "22222222-2222-4222-8222-222222222222";

describe("getSeekerNotificationLink", () => {
  it("opens the application on the application status page", () => {
    expect(getSeekerNotificationLink({ type: "application_update", applicationId: APP_ID })).toEqual({
      href: `/application-status?application=${APP_ID}#application-${APP_ID}`,
      label: "View application",
    });
  });

  it.each(["interview_invitation", "interview_update", "interview_cancelled", "interview_expired"])(
    "opens the interview for %s",
    (type) => {
      expect(getSeekerNotificationLink({ type, applicationId: APP_ID, interviewId: INTERVIEW_ID })).toEqual({
        href: `/interviews#interview-${INTERVIEW_ID}`,
        label: "View interview",
      });
    },
  );

  it("opens the interviews page when an interview notification has no interview id", () => {
    expect(getSeekerNotificationLink({ type: "interview_invitation", interviewId: null })).toEqual({
      href: "/interviews",
      label: "View interview",
    });
  });

  it("falls back to the application list when there is no application id", () => {
    expect(getSeekerNotificationLink({ type: "application_update", applicationId: null })).toEqual({
      href: "/application-status",
      label: "View applications",
    });
  });

  it("ignores ids that are not real ids, so they never end up in a URL", () => {
    expect(
      getSeekerNotificationLink({ type: "application_update", applicationId: "x#y?z=1" }).href,
    ).toBe("/application-status");
    expect(
      getSeekerNotificationLink({ type: "interview_update", interviewId: "../admin" }).href,
    ).toBe("/interviews");
  });

  it("builds the anchor ids the pages use", () => {
    expect(applicationAnchorId(APP_ID)).toBe(`application-${APP_ID}`);
    expect(interviewAnchorId(INTERVIEW_ID)).toBe(`interview-${INTERVIEW_ID}`);
  });
});

describe("mapNotification", () => {
  const row = {
    id: "n-1",
    recipient_id: "user-1",
    title: "Title",
    message: "Message",
    application_id: APP_ID,
    interview_id: INTERVIEW_ID,
    job_id: "job-1",
    is_read: false,
    created_at: "2026-11-13T12:00:00Z",
  };

  it("links an interview invitation to that interview", () => {
    const notification = mapNotification({ ...row, type: "interview_invitation" });

    expect(notification.category).toBe("interviews");
    expect(notification.href).toBe(`/interviews#interview-${INTERVIEW_ID}`);
    expect(notification.actionLabel).toBe("View interview");
    expect(notification.interviewId).toBe(INTERVIEW_ID);
  });

  it("links an application update to that application", () => {
    const notification = mapNotification({ ...row, type: "application_update", interview_id: null });

    expect(notification.category).toBe("applications");
    expect(notification.href).toBe(`/application-status?application=${APP_ID}#application-${APP_ID}`);
    expect(notification.interviewId).toBeUndefined();
  });
});
