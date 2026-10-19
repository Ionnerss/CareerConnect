// @vitest-environment jsdom

/**
 * Tests the public homepage content and structure: the menu works from the
 * keyboard, every in-page link has a target, the primary actions point at
 * real routes, and anything made up is labelled as illustrative.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomeNavigation from "./home-navigation";
import HomeHero from "./home-hero";
import HomeStatement from "./home-statement";
import JobSeekerSection from "./job-seeker-section";
import OpportunitiesSection from "./opportunities-section";
import RecruiterSection from "./recruiter-section";
import HowItWorksSection from "./how-it-works-section";
import { HomeEnding, HomeFooter } from "./home-ending";

beforeEach(() => {
  // Motion helpers read this; reduced motion keeps the test deterministic.
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <div>
      <HomeNavigation />
      <main>
        <HomeHero />
        <HomeStatement />
        <JobSeekerSection />
        <OpportunitiesSection />
        <RecruiterSection />
        <HowItWorksSection />
        <HomeEnding />
      </main>
      <HomeFooter />
    </div>,
  );
}

describe("HomeNavigation", () => {
  it("links to log in and sign up", () => {
    render(<HomeNavigation />);

    const main = screen.getByRole("navigation", { name: "Main navigation" });

    expect(
      within(main).getByRole("link", { name: "Log in" }).getAttribute("href"),
    ).toBe("/auth/login");
    expect(
      within(main).getByRole("link", { name: "Sign up" }).getAttribute("href"),
    ).toBe("/auth/signup");
  });

  it("opens and closes the mobile menu, and closes it with Escape", async () => {
    const user = userEvent.setup();
    render(<HomeNavigation />);

    const button = screen.getByRole("button", { name: "Open navigation" });
    expect(button.getAttribute("aria-expanded")).toBe("false");

    await user.click(button);
    expect(
      screen
        .getByRole("button", { name: "Close navigation" })
        .getAttribute("aria-expanded"),
    ).toBe("true");

    fireEvent.keyDown(screen.getByRole("banner"), { key: "Escape" });

    const reopened = screen.getByRole("button", { name: "Open navigation" });
    expect(reopened.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(reopened);
  });
});

describe("homepage structure", () => {
  it("has exactly one h1", () => {
    renderPage();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("gives every in-page link a matching section", () => {
    const { container } = renderPage();

    const hashes = Array.from(container.querySelectorAll("a[href^='#']")).map(
      (link) => link.getAttribute("href")!.slice(1),
    );

    expect(hashes.length).toBeGreaterThan(0);
    for (const id of hashes) {
      expect(container.querySelector(`#${id}`), `#${id} exists`).not.toBeNull();
    }
  });

  it("points every sign-up and log-in action at a real route", () => {
    const { container } = renderPage();

    const internal = Array.from(container.querySelectorAll("a[href^='/']")).map(
      (link) => link.getAttribute("href")!.split("?")[0],
    );

    expect(internal.length).toBeGreaterThan(0);
    for (const href of internal) {
      expect(["/", "/auth/login", "/auth/signup"]).toContain(href);
    }
  });

  it("gives recruiters a clear way to sign up and log in", () => {
    const { container } = renderPage();

    const signup = container.querySelector("a[href='/auth/signup?as=recruiter']");
    const login = container.querySelector("a[href='/auth/login?as=recruiter']");

    expect(signup?.textContent).toMatch(/Recruiter sign up/);
    expect(login?.textContent).toMatch(/Recruiter log in/);
    expect(container.textContent).toMatch(/Concordia email/);
  });

  it("labels invented people, companies and postings as illustrative", () => {
    renderPage();

    expect(screen.getByText(/Illustrative profile and opportunities/)).toBeTruthy();
    expect(screen.getByText(/Illustrative · not real jobs/)).toBeTruthy();
    expect(screen.getByText(/Illustrative view/)).toBeTruthy();
    expect(screen.getByText(/Illustrative profile ·/)).toBeTruthy();
  });

  it("does not make up customer proof or statistics", () => {
    const { container } = renderPage();
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/testimonial|trusted by|\d[\d,]*\+? (users|jobs|companies|hires)/i);
  });

  it("keeps the recruiter skill-match numbers consistent with the posting", () => {
    renderPage();

    // 3 required skills: Alex has 2 (67%), Sam has 1 (33%).
    expect(screen.getByText(/2 of 3\s+skills/)).toBeTruthy();
    expect(screen.getByText(/1 of 3\s+skills/)).toBeTruthy();
    expect(screen.getByText(/67%/)).toBeTruthy();
    expect(screen.getByText(/33%/)).toBeTruthy();
  });

  it("describes only the three steps CareerConnect supports today", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Build your profile" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Search for jobs" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Follow every application" }),
    ).toBeTruthy();
  });
});
