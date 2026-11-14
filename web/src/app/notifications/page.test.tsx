// @vitest-environment jsdom

/** Tests clicking a job seeker's notification: right link, and it counts as read (#257). */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { CareerNotification } from "@/components/notifications/notification-types";

const mocks = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  setReadStatus: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
  }),
}));

vi.mock("@/lib/notifications/notification-service", () => ({
  notificationService: {
    getNotifications: mocks.getNotifications,
    setReadStatus: mocks.setReadStatus,
  },
}));

// The header pulls in the browser Supabase client; only its event name is needed here.
vi.mock("@/components/dashboard/dashboard-header", () => ({
  NOTIFICATIONS_CHANGED_EVENT: "careerconnect:notifications-changed",
}));

import NotificationsPage from "./page";

function notification(overrides: Partial<CareerNotification>): CareerNotification {
  return {
    id: "n-1",
    category: "applications",
    title: "Application Status Updated",
    message: "Software Dev: Your application is now in progress.",
    organization: "CareerConnect",
    timestamp: "2026-11-13T12:00:00Z",
    read: false,
    href: "/application-status?application=app-1#application-app-1",
    actionLabel: "View application",
    ...overrides,
  };
}

const notifications = [
  notification({ id: "n-1" }),
  notification({
    id: "n-2",
    category: "interviews",
    title: "Interview invitation",
    message: "You are invited to an interview.",
    href: "/interviews#interview-int-1",
    actionLabel: "View interview",
  }),
];

/** Stops jsdom from trying to navigate when a link is clicked. */
function preventNavigation(event: MouseEvent) {
  event.preventDefault();
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.getNotifications.mockResolvedValue(notifications);
  mocks.setReadStatus.mockResolvedValue(undefined);
  document.addEventListener("click", preventNavigation);
});

afterEach(() => {
  document.removeEventListener("click", preventNavigation);
  cleanup();
});

describe("NotificationsPage actions", () => {
  it("links each notification to its application or interview", async () => {
    render(<NotificationsPage />);

    for (const name of ["Application Status Updated", "View application"]) {
      expect((await screen.findByRole("link", { name })).getAttribute("href")).toBe(
        "/application-status?application=app-1#application-app-1",
      );
    }

    for (const name of ["Interview invitation", "View interview"]) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe("/interviews#interview-int-1");
    }
  });

  it("marks an unread notification as read when it is opened", async () => {
    const changed = vi.fn();
    window.addEventListener("careerconnect:notifications-changed", changed);

    render(<NotificationsPage />);

    (await screen.findByRole("link", { name: "View interview" })).click();

    expect(mocks.setReadStatus).toHaveBeenCalledWith("n-2", true);
    expect(await screen.findByRole("button", { name: "Mark Interview invitation as unread" })).toBeDefined();
    await waitFor(() => expect(changed).toHaveBeenCalled());

    window.removeEventListener("careerconnect:notifications-changed", changed);
  });

  it("does not save again when an already read notification is opened", async () => {
    mocks.getNotifications.mockResolvedValue([notification({ id: "n-1", read: true })]);

    render(<NotificationsPage />);

    (await screen.findByRole("link", { name: "View application" })).click();

    expect(mocks.setReadStatus).not.toHaveBeenCalled();
  });

  it("keeps working when saving the read status fails", async () => {
    mocks.setReadStatus.mockRejectedValue(new Error("offline"));

    render(<NotificationsPage />);

    (await screen.findByRole("link", { name: "View application" })).click();

    expect(mocks.setReadStatus).toHaveBeenCalledWith("n-1", true);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
