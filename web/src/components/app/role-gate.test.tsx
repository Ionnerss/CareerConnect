// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  requireMfaForPage: vi.fn(),
  getProfileRole: vi.fn(),
  getDashboardProfileSummary: vi.fn(),
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

vi.mock("next/font/google", () => ({
  Plus_Jakarta_Sans: () => ({
    className: "jakarta",
  }),
}));

vi.mock("@/lib/auth/require-mfa", () => ({
  requireMfaForPage: mocks.requireMfaForPage,
}));

vi.mock("@/lib/auth/current-role", () => ({
  getProfileRole: mocks.getProfileRole,
}));

vi.mock("@/lib/dashboard/data", () => ({
  getDashboardProfileSummary:
    mocks.getDashboardProfileSummary,
}));

vi.mock("@/components/app/app-header", () => ({
  default: () => null,
}));

import RoleGate from "./role-gate";
import AppShell from "./app-shell";

const testUser = {
  id: "test-user-id",
  email: "test@example.com",
};

async function redirectedTo(
  run: () => Promise<unknown>
) {
  try {
    await run();
    return null;
  } catch (error) {
    if (error instanceof Redirected) {
      return error.path;
    }

    throw error;
  }
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.requireMfaForPage.mockResolvedValue({
    user: testUser,
    supabase: {},
  });

  mocks.getProfileRole.mockResolvedValue("job_seeker");

  mocks.getDashboardProfileSummary.mockResolvedValue({
    fullName: "Test User",
  });
});

describe("RoleGate MFA and audience", () => {
  it("allows a verified job seeker", async () => {
    expect(
      await redirectedTo(() =>
        RoleGate({
          audience: "job_seeker",
          children: "content",
        })
      )
    ).toBeNull();
  });

  it("redirects recruiters from job seeker pages", async () => {
    mocks.getProfileRole.mockResolvedValue("recruiter");

    expect(
      await redirectedTo(() =>
        RoleGate({
          audience: "job_seeker",
          children: "content",
        })
      )
    ).toBe("/recruiter/jobs");
  });

  it("does not look up roles before MFA", async () => {
    mocks.requireMfaForPage.mockRejectedValue(
      new Redirected("/auth/mfa")
    );

    expect(
      await redirectedTo(() =>
        RoleGate({
          audience: "job_seeker",
          children: "content",
        })
      )
    ).toBe("/auth/mfa");

    expect(
      mocks.getProfileRole
    ).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users", async () => {
    mocks.requireMfaForPage.mockRejectedValue(
      new Redirected("/auth/login")
    );

    expect(
      await redirectedTo(() =>
        RoleGate({
          audience: "job_seeker",
          children: "content",
        })
      )
    ).toBe("/auth/login");
  });
});

describe("AppShell MFA and audience", () => {
  it("allows a verified recruiter", async () => {
    mocks.getProfileRole.mockResolvedValue("recruiter");

    expect(
      await redirectedTo(() =>
        AppShell({
          audience: "recruiter",
          children: "content",
        })
      )
    ).toBeNull();
  });

  it("redirects job seekers from recruiter pages", async () => {
    expect(
      await redirectedTo(() =>
        AppShell({
          audience: "recruiter",
          children: "content",
        })
      )
    ).toBe("/dashboard");
  });

  it("does not fetch dashboard data before MFA", async () => {
    mocks.requireMfaForPage.mockRejectedValue(
      new Redirected("/auth/mfa")
    );

    expect(
      await redirectedTo(() =>
        AppShell({
          audience: "recruiter",
          children: "content",
        })
      )
    ).toBe("/auth/mfa");

    expect(
      mocks.getDashboardProfileSummary
    ).not.toHaveBeenCalled();

    expect(
      mocks.getProfileRole
    ).not.toHaveBeenCalled();
  });

  it("denies authentication failures", async () => {
    mocks.requireMfaForPage.mockRejectedValue(
      new Redirected("/auth/login")
    );

    expect(
      await redirectedTo(() =>
        AppShell({
          audience: "recruiter",
          children: "content",
        })
      )
    ).toBe("/auth/login");
  });
});
