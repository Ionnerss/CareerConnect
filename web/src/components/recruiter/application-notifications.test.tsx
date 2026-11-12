// @vitest-environment jsdom

/** Tests the recruiter's notifications: read/unread, filter and counts. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecruiterNotificationsList } from "./application-notifications";
import type { RecruiterNotification } from "@/lib/recruiter/notifications";

const mocks = vi.hoisted(() => ({
  setNotificationReadAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
}));

vi.mock("@/app/recruiter/notifications/actions", () => ({
  setNotificationReadAction: mocks.setNotificationReadAction,
  markAllNotificationsReadAction: mocks.markAllNotificationsReadAction,
}));

// The header pulls in the browser Supabase client; only its event name is needed here.
vi.mock("@/components/dashboard/dashboard-header", () => ({
  NOTIFICATIONS_CHANGED_EVENT: "careerconnect:notifications-changed",
}));

const NOW = "2026-11-09T20:00:00.000Z";

const notifications: RecruiterNotification[] = [
  {
    id: "n-3",
    type: "interview_response",
    title: "Interview Accepted",
    message: "Matthew L accepted the interview invitation for Software Dev.",
    createdAt: "2026-11-09T17:00:00Z",
    isRead: false,
    jobId: "job-1",
    applicationId: "app-1",
    interviewId: "int-1",
  },
  {
    id: "n-2",
    type: "application_update",
    title: "New application received",
    message: "Catalin B applied for Software Dev.",
    createdAt: "2026-11-08T12:00:00Z",
    isRead: false,
    jobId: "job-1",
    applicationId: "app-2",
    interviewId: null,
  },
  {
    id: "n-1",
    type: "application_update",
    title: "New application received",
    message: "Dak S applied for Data Analyst.",
    createdAt: "2026-10-20T18:30:00Z",
    isRead: true,
    jobId: "job-2",
    applicationId: "app-3",
    interviewId: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setNotificationReadAction.mockResolvedValue({ success: true });
  mocks.markAllNotificationsReadAction.mockResolvedValue({ success: true });
});

afterEach(() => {
  cleanup();
});

function items() {
  return within(screen.getByRole("list", { name: "Notifications" })).getAllByRole("listitem");
}

function item(message: string) {
  return screen.getByText(message).closest("li") as HTMLElement;
}

describe("RecruiterNotificationsList", () => {
  it("shows a friendly message when there are no notifications", () => {
    render(<RecruiterNotificationsList notifications={[]} now={NOW} />);

    expect(screen.getByText("No notifications yet.")).toBeDefined();
    expect(screen.queryByRole("list", { name: "Notifications" })).toBeNull();
  });

  it("shows new applications and interview replies with when they were posted", () => {
    render(<RecruiterNotificationsList notifications={notifications} now={NOW} />);

    expect(items()).toHaveLength(3);
    expect(items()[0].textContent).toContain("Matthew L accepted the interview invitation for Software Dev.");
    expect(items()[1].textContent).toContain("Catalin B applied for Software Dev.");

    const time = screen.getByText("3 hours ago");
    expect(time.tagName).toBe("TIME");
    expect(time.getAttribute("title")).toBe("Nov 9, 2026, 12:00 PM");
    expect(screen.getByText("Yesterday")).toBeDefined();
  });

  it("links interview replies to interviews and applications to the applicants", () => {
    render(<RecruiterNotificationsList notifications={notifications} now={NOW} />);

    expect(within(item("Matthew L accepted the interview invitation for Software Dev.")).getByRole("link").getAttribute("href")).toBe(
      "/recruiter/interviews",
    );
    expect(within(item("Dak S applied for Data Analyst.")).getByRole("link").getAttribute("href")).toBe(
      "/recruiter/jobs/job-2/applicants",
    );
  });

  it("shows the unread and total counts and marks unread notifications as new", () => {
    render(<RecruiterNotificationsList notifications={notifications} now={NOW} />);

    expect(screen.getByTestId("unread-count").textContent).toBe("2");
    expect(screen.getByTestId("total-count").textContent).toBe("3");
    expect(within(item("Catalin B applied for Software Dev.")).getByText("New")).toBeDefined();
    expect(within(item("Dak S applied for Data Analyst.")).queryByText("New")).toBeNull();
  });

  it("filters by unread and read", async () => {
    const user = userEvent.setup();
    render(<RecruiterNotificationsList notifications={notifications} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "Unread (2)" }));
    expect(screen.getByRole("button", { name: "Unread (2)" }).getAttribute("aria-pressed")).toBe("true");
    expect(items()).toHaveLength(2);
    expect(screen.queryByText("Dak S applied for Data Analyst.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Read (1)" }));
    expect(items()).toHaveLength(1);
    expect(screen.getByText("Dak S applied for Data Analyst.")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "All (3)" }));
    expect(items()).toHaveLength(3);
  });

  it("marks one notification as read, updates the counts and tells the bell", async () => {
    const user = userEvent.setup();
    const bell = vi.fn();
    window.addEventListener("careerconnect:notifications-changed", bell);
    render(<RecruiterNotificationsList notifications={notifications} now={NOW} />);

    await user.click(within(item("Catalin B applied for Software Dev.")).getByRole("button", { name: /as read/ }));

    expect(mocks.setNotificationReadAction).toHaveBeenCalledWith("n-2", true);
    expect(screen.getByTestId("unread-count").textContent).toBe("1");
    expect(within(item("Catalin B applied for Software Dev.")).getByRole("button", { name: /as unread/ })).toBeDefined();
    await waitFor(() => expect(bell).toHaveBeenCalled());
    window.removeEventListener("careerconnect:notifications-changed", bell);
  });

  it("marks a read notification as unread again", async () => {
    const user = userEvent.setup();
    render(<RecruiterNotificationsList notifications={notifications} now={NOW} />);

    await user.click(within(item("Dak S applied for Data Analyst.")).getByRole("button", { name: /as unread/ }));

    expect(mocks.setNotificationReadAction).toHaveBeenCalledWith("n-1", false);
    expect(screen.getByTestId("unread-count").textContent).toBe("3");
  });

  it("puts the notification back and explains when saving fails", async () => {
    mocks.setNotificationReadAction.mockResolvedValue({ success: false, error: "Unable to update the notification. Please try again." });
    const user = userEvent.setup();
    render(<RecruiterNotificationsList notifications={notifications} now={NOW} />);

    await user.click(within(item("Catalin B applied for Software Dev.")).getByRole("button", { name: /as read/ }));

    expect((await screen.findByRole("alert")).textContent).toBe("Unable to update the notification. Please try again.");
    expect(screen.getByTestId("unread-count").textContent).toBe("2");
  });

  it("marks everything as read at once", async () => {
    const user = userEvent.setup();
    render(<RecruiterNotificationsList notifications={notifications} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "Mark all as read" }));

    expect(mocks.markAllNotificationsReadAction).toHaveBeenCalled();
    expect(screen.getByTestId("unread-count").textContent).toBe("0");
    expect((screen.getByRole("button", { name: "Mark all as read" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Unread (0)" }));
    expect(screen.getByText("You're all caught up. No unread notifications.")).toBeDefined();
  });
});
