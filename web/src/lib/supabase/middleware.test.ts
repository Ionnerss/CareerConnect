/**
 * Tests protected-route redirects and session cookie handling.
 * Mocks Supabase authentication to check logged-in, logged-out,
 * and error scenarios without contacting the real Supabase project.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "./middleware";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

function requestFor(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

describe("protected routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.createServerClient.mockReturnValue({
      auth: { getClaims: mocks.getClaims },
    });

    // Default: visitor is logged out.
    mocks.getClaims.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it.each([
    "/dashboard",
    "/dashboard/settings",
    "/upload-resume",
    "/upload-resume/history",
  ])("redirects logged-out visitors from %s", async (path) => {
    const response = await updateSession(requestFor(path));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login",
    );
    expect(mocks.getClaims).toHaveBeenCalledOnce();
  });

  it.each([
    "/",
    "/auth/login",
    "/auth/signup",
    "/dashboard-public",
    "/upload-resume-info",
  ])("does not redirect public or unrelated paths: %s", async (path) => {
    const response = await updateSession(requestFor(path));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    "/dashboard",
    "/upload-resume",
  ])("allows authenticated visitors to %s", async (path) => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "test-user-id" } },
      error: null,
    });

    const response = await updateSession(requestFor(path));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects when authentication returns an error", async () => {
    mocks.getClaims.mockResolvedValue({
      data: null,
      error: new Error("Invalid token"),
    });

    const response = await updateSession(requestFor("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login",
    );
  });

  it.each([true, false])(
    "preserves updated cookies when authenticated=%s",
    async (authenticated) => {
      mocks.getClaims.mockImplementationOnce(async () => {
        // Simulate Supabase updating cookies during getClaims().
        const options = mocks.createServerClient.mock.calls[0][2];

        options.cookies.setAll([
          {
            name: "test-session",
            value: "updated-value",
            options: {
              path: "/",
              httpOnly: true,
              secure: true,
              sameSite: "lax",
            },
          },
        ]);

        return {
          data: authenticated
            ? { claims: { sub: "test-user-id" } }
            : null,
          error: null,
        };
      });

      const request = requestFor("/dashboard");
      const response = await updateSession(request);

      expect(response.status).toBe(authenticated ? 200 : 307);

      expect(request.cookies.get("test-session")?.value).toBe(
        "updated-value",
      );

      expect(response.cookies.get("test-session")).toMatchObject({
        name: "test-session",
        value: "updated-value",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      });
    },
  );
});