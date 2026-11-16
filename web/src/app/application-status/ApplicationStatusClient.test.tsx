
// @vitest-environment jsdom

/** Tests the quick links at the top of the application status page. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ApplicationStatusClient from "./ApplicationStatusClient";

// Live status updates need a Supabase connection; they are not what this test checks.
vi.mock("@/lib/application_status/change-status-real-time", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
});

describe("ApplicationStatusClient", () => {
  it("provides access to analytics without a redundant interviews shortcut", () => {
    render(<ApplicationStatusClient applications={[]} />);

    // The redundant Interviews quick link should not appear.
    expect(
      screen.queryByRole("link", { name: "Interviews" })
    ).toBeNull();

    // The View analytics link should remain available.
    expect(
      screen.getByRole("link", { name: "View analytics" }).getAttribute("href")
    ).toBe("/application-status/analytics");
  });
});
