import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getMfaStatus: vi.fn(),
  createClient: vi.fn(),
}));

class Redirected extends Error {
  constructor(public path: string) {
    super(`redirect:${path}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Redirected(path);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/auth/mfa", () => ({
  getMfaStatus: mocks.getMfaStatus,
}));

import {
  requireMfaForPage,
  requireMfaForAction,
} from "./require-mfa";

const testUser = {
  id: "test-user-id",
  email: "test@example.com",
};

beforeEach(() => {
  vi.resetAllMocks();

  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: mocks.getUser,
    },
  });

  mocks.getUser.mockResolvedValue({
    data: { user: testUser },
    error: null,
  });

  mocks.getMfaStatus.mockResolvedValue({
    status: "authenticated",
    accessAllowed: true,
  });
});

describe("requireMfaForPage", () => {
  it("redirects logged-out users to login", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      requireMfaForPage()
    ).rejects.toMatchObject({
      path: "/auth/login",
    });

    expect(mocks.getMfaStatus).not.toHaveBeenCalled();
  });

  it("redirects when user lookup fails", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Authentication failed"),
    });

    await expect(
      requireMfaForPage()
    ).rejects.toMatchObject({
      path: "/auth/login",
    });
  });

  it("redirects AAL1 users requiring MFA", async () => {
    mocks.getMfaStatus.mockResolvedValue({
      status: "mfa_required",
      accessAllowed: false,
    });

    await expect(
      requireMfaForPage()
    ).rejects.toMatchObject({
      path: "/auth/mfa",
    });
  });

  it("allows authenticated users without MFA", async () => {
    const result = await requireMfaForPage();

    expect(result.user.id).toBe(testUser.id);
  });

  it("allows verified MFA users", async () => {
    mocks.getMfaStatus.mockResolvedValue({
      status: "authenticated",
      accessAllowed: true,
    });

    await expect(
      requireMfaForPage()
    ).resolves.toHaveProperty("user.id", testUser.id);
  });

  it("blocks stale MFA sessions", async () => {
    mocks.getMfaStatus.mockResolvedValue({
      status: "session_stale",
      accessAllowed: false,
    });

    await expect(
      requireMfaForPage()
    ).rejects.toThrow(
      "Unable to verify your authentication security level."
    );
  });

  it("blocks unavailable MFA information", async () => {
    mocks.getMfaStatus.mockResolvedValue({
      status: "auth_info_unavailable",
      accessAllowed: false,
    });

    await expect(
      requireMfaForPage()
    ).rejects.toThrow();
  });

  it("fails closed when MFA verification throws", async () => {
    mocks.getMfaStatus.mockRejectedValue(
      new Error("Supabase unavailable")
    );

    await expect(
      requireMfaForPage()
    ).rejects.toThrow(
      "Unable to verify your authentication security level."
    );
  });
});

describe("requireMfaForAction", () => {
  it("allows authenticated sessions", async () => {
    await expect(
      requireMfaForAction()
    ).resolves.toHaveProperty("user.id", testUser.id);
  });

  it("rejects requests that still require MFA", async () => {
    mocks.getMfaStatus.mockResolvedValue({
      status: "mfa_required",
      accessAllowed: false,
    });

    await expect(
      requireMfaForAction()
    ).rejects.toThrow(
      "Complete two-factor authentication to continue."
    );
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      requireMfaForAction()
    ).rejects.toThrow("Authentication required.");
  });

  it("rejects stale sessions", async () => {
    mocks.getMfaStatus.mockResolvedValue({
      status: "session_stale",
      accessAllowed: false,
    });

    await expect(
      requireMfaForAction()
    ).rejects.toThrow();
  });

  it("rejects MFA service failures", async () => {
    mocks.getMfaStatus.mockRejectedValue(
      new Error("MFA lookup failed")
    );

    await expect(
      requireMfaForAction()
    ).rejects.toThrow();
  });
});
