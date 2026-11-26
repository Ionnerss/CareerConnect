// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogoutButton from "./logout-button";

const mocks = vi.hoisted(() => ({ logout: vi.fn() }));

vi.mock("@/app/auth/actions", () => ({ logout: mocks.logout }));

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(cleanup);

describe("LogoutButton", () => {
  it("calls the logout action once and disables itself while waiting", async () => {
    let finish: (value: undefined) => void = () => {};
    mocks.logout.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "Log out" }));

    const waiting = screen.getByRole("button", { name: "Logging out..." }) as HTMLButtonElement;
    expect(waiting.disabled).toBe(true);
    await user.click(waiting);
    expect(mocks.logout).toHaveBeenCalledTimes(1);

    finish(undefined);
    expect(await screen.findByRole("button", { name: "Log out" })).toBeTruthy();
  });

  it("shows the error returned by the server", async () => {
    mocks.logout.mockResolvedValue({ error: "Unable to sign out. Please try again." });
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Unable to sign out. Please try again.");
  });

  it("shows a friendly message when the request fails unexpectedly", async () => {
    mocks.logout.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "An unexpected error occurred. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
  });
});
