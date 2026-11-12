
 // @vitest-environment jsdom

/**
 * The signed-in header must show on every app section and highlight the
 * section you are in. These tests guard the navigation, not the styling.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AppHeader from "./app-header";

const mocks = vi.hoisted(() => ({ pathname: "/jobs" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/auth/actions", () => ({ logout: vi.fn() }));

afterEach(cleanup);

function currentLink() {
  return screen
    .getAllByRole("link")
    .find((link) => link.getAttribute("aria-current") === "page");
}

describe("AppHeader", () => {
  it("shows the logo, the four sections, log out and the initials", () => {
    mocks.pathname = "/jobs";
    render(<AppHeader initials="YY" />);

    expect(screen.getByText("CareerConnect")).toBeTruthy();

    for (const name of ["Home", "Jobs", "Applications", "Resume"]) {
      expect(screen.getByRole("link", { name })).toBeTruthy();
    }

    expect(screen.getByRole("button", { name: /log out/i })).toBeTruthy();

    expect(
      screen.getByRole("link", { name: "Your profile" }).textContent
    ).toBe("YY");
  });

  it.each([
    ["/dashboard", "Home"],
    ["/jobs", "Jobs"],
    ["/application-status", "Applications"],
    ["/upload-resume", "Resume"],
  ])("highlights the current section on %s", (path, label) => {
    mocks.pathname = path;
    render(<AppHeader initials="YY" />);

    expect(currentLink()?.textContent).toBe(label);
  });

  it("highlights the parent section on a nested route", () => {
    mocks.pathname = "/jobs/123";
    render(<AppHeader initials="YY" />);

    expect(currentLink()?.textContent).toBe("Jobs");
  });

  it("highlights nothing on pages that are not in the menu", () => {
    mocks.pathname = "/recruiter/jobs";
    render(<AppHeader initials="YY" />);

    expect(currentLink()).toBeUndefined();
  });

  it("gives recruiters their own menu and sends the logo to their postings", () => {
    mocks.pathname = "/recruiter/jobs/abc/applicants";
    render(<AppHeader initials="RR" role="recruiter" />);

    expect(
      screen.getByRole("link", { name: "Job postings" })
    ).toBeTruthy();

    expect(
      screen.queryByRole("link", { name: "Resume" })
    ).toBeNull();

    expect(currentLink()?.textContent).toBe("Job postings");

    expect(
      screen.getByText("CareerConnect").closest("a")?.getAttribute("href")
    ).toBe("/recruiter/jobs");
  });

  it("provides recruiter notifications through the bell and highlights it on the notifications page", () => {
    mocks.pathname = "/recruiter/notifications";
    render(<AppHeader initials="RR" role="recruiter" />);

    const notificationLink = screen.getByRole("link", {
      name: "Notifications",
    });

    // The notification bell links to the recruiter notifications page.
    expect(notificationLink.getAttribute("href")).toBe(
      "/recruiter/notifications"
    );

    // The bell is highlighted when the recruiter is on this page.
    expect(notificationLink.getAttribute("aria-current")).toBe("page");

    // The active link should be the notification bell.
    expect(currentLink()).toBe(notificationLink);
  });

  it("opens the recruiter account page from a recruiter's avatar", () => {
    mocks.pathname = "/recruiter/jobs";
    render(<AppHeader initials="YY" role="recruiter" />);

    expect(
      screen.getByRole("link", { name: "Your account" }).getAttribute("href")
    ).toBe("/recruiter/account");

    expect(
      screen.queryByRole("link", { name: "Your profile" })
    ).toBeNull();
  });

  it("opens the profile from a job seeker's avatar", () => {
    mocks.pathname = "/jobs";
    render(<AppHeader initials="YY" />);

    expect(
      screen.getByRole("link", { name: "Your profile" }).getAttribute("href")
    ).toBe("/profile");
  });
});
