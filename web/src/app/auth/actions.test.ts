import { beforeEach, describe, expect, it, vi } from "vitest";
import { logout } from "./actions";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { signOut: mocks.signOut } })),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logout", () => {
  it("signs out of every session and sends the user to the login page", async () => {
    mocks.signOut.mockResolvedValue({ error: null });

    await logout();

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.redirect).toHaveBeenCalledWith("/auth/login");
  });

  it("returns an error and stays on the page when signing out fails", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "boom" } });

    expect(await logout()).toEqual({ error: "Unable to sign out. Please try again." });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
