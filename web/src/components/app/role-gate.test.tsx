// @vitest-environment jsdom

/**
 * Each kind of account stays on its own pages. A recruiter who opens a job
 * seeker page (dashboard, profile, resume...) is sent to their postings, and a
 * job seeker who opens a recruiter page is sent to their dashboard.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "u1", email: "a@live.concordia.ca" } as {
    id: string;
    email: string;
  } | null,
  role: "recruiter" as string | null,
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
  Plus_Jakarta_Sans: () => ({ className: "jakarta" }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: mocks.role ? { role: mocks.role } : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/dashboard/data", () => ({
  getDashboardProfileSummary: async () => ({ fullName: "Yousef Yousef" }),
}));

vi.mock("@/components/app/app-header", () => ({ default: () => null }));

import RoleGate from "./role-gate";
import AppShell from "./app-shell";

async function redirectedTo(run: () => Promise<unknown>) {
  try {
    await run();
    return null;
  } catch (error) {
    if (error instanceof Redirected) return error.path;
    throw error;
  }
}

beforeEach(() => {
  mocks.user = { id: "u1", email: "a@live.concordia.ca" };
  mocks.role = "recruiter";
});

describe("RoleGate (dashboard, profile)", () => {
  it("sends a recruiter to their postings", async () => {
    expect(
      await redirectedTo(() =>
        RoleGate({ audience: "job_seeker", children: "x" }),
      ),
    ).toBe("/recruiter/jobs");
  });

  it("lets a job seeker through", async () => {
    mocks.role = "job_seeker";
    expect(
      await redirectedTo(() =>
        RoleGate({ audience: "job_seeker", children: "x" }),
      ),
    ).toBeNull();
  });

  it("treats a missing profile as a job seeker", async () => {
    mocks.role = null;
    expect(
      await redirectedTo(() =>
        RoleGate({ audience: "job_seeker", children: "x" }),
      ),
    ).toBeNull();
  });

  it("leaves signed-out visitors to the login middleware", async () => {
    mocks.user = null;
    expect(
      await redirectedTo(() =>
        RoleGate({ audience: "job_seeker", children: "x" }),
      ),
    ).toBeNull();
  });
});

describe("AppShell audience", () => {
  it("sends a recruiter away from job seeker sections", async () => {
    expect(
      await redirectedTo(() =>
        AppShell({ audience: "job_seeker", children: "x" }),
      ),
    ).toBe("/recruiter/jobs");
  });

  it("sends a job seeker away from recruiter sections", async () => {
    mocks.role = "job_seeker";
    expect(
      await redirectedTo(() =>
        AppShell({ audience: "recruiter", children: "x" }),
      ),
    ).toBe("/dashboard");
  });

  it("sends signed-out visitors to log in", async () => {
    mocks.user = null;
    expect(
      await redirectedTo(() =>
        AppShell({ audience: "recruiter", children: "x" }),
      ),
    ).toBe("/auth/login");
  });

  it("renders for the right kind of account", async () => {
    expect(
      await redirectedTo(() =>
        AppShell({ audience: "recruiter", children: "x" }),
      ),
    ).toBeNull();
  });
});
