import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "./middleware";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
  getAal: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

function requestFor(path: string) {
  return new NextRequest(
    `http://localhost:3000${path}`
  );
}

function authenticated() {
  mocks.getClaims.mockResolvedValue({
    data: {
      claims: { sub: "test-user-id" },
    },
    error: null,
  });
}

function setAal(currentLevel: string, nextLevel: string) {
  mocks.getAal.mockResolvedValue({
    data: { currentLevel, nextLevel },
    error: null,
  });
}

describe("MFA route protection", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.createServerClient.mockReturnValue({
      auth: {
        getClaims: mocks.getClaims,
        mfa: {
          getAuthenticatorAssuranceLevel: mocks.getAal,
        },
      },
    });

    mocks.getClaims.mockResolvedValue({
      data: null,
      error: null,
    });

    setAal("aal1", "aal1");
  });

  it.each([
    "/dashboard",
    "/dashboard/settings",
    "/upload-resume",
    "/jobs",
    "/profile",
    "/recruiter",
    "/recruiter/jobs",
    "/application-status",
  ])("redirects logged-out users from %s", async (path) => {
    const response = await updateSession(
      requestFor(path)
    );

    expect(response.status).toBe(307);

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login"
    );

    expect(mocks.getAal).not.toHaveBeenCalled();
  });

  it.each([
    "/",
    "/auth/login",
    "/auth/signup",
    "/auth/mfa",
    "/account/security",
    "/dashboard-public",
  ])("leaves public and MFA routes accessible: %s", async (path) => {
    const response = await updateSession(
      requestFor(path)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.getAal).not.toHaveBeenCalled();
  });

  it("allows users without enrolled MFA", async () => {
    authenticated();
    setAal("aal1", "aal1");

    const response = await updateSession(
      requestFor("/dashboard")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows completed MFA sessions", async () => {
    authenticated();
    setAal("aal2", "aal2");

    const response = await updateSession(
      requestFor("/recruiter/jobs")
    );

    expect(response.status).toBe(200);
  });

  it("redirects unverified MFA sessions", async () => {
    authenticated();
    setAal("aal1", "aal2");

    const response = await updateSession(
      requestFor("/upload-resume")
    );

    expect(response.status).toBe(307);

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/mfa"
    );
  });

  it("blocks stale MFA sessions", async () => {
    authenticated();
    setAal("aal2", "aal1");

    const response = await updateSession(
      requestFor("/profile")
    );

    expect(response.status).toBe(403);
  });

  it("fails closed on MFA API errors", async () => {
    authenticated();

    mocks.getAal.mockResolvedValue({
      data: null,
      error: new Error("Supabase MFA failure"),
    });

    const response = await updateSession(
      requestFor("/dashboard")
    );

    expect(response.status).toBe(503);
  });

  it("fails closed when MFA checking throws", async () => {
    authenticated();

    mocks.getAal.mockRejectedValue(
      new Error("Network error")
    );

    const response = await updateSession(
      requestFor("/dashboard")
    );

    expect(response.status).toBe(503);
  });

  it("preserves updated session cookies", async () => {
    authenticated();
    setAal("aal1", "aal2");

    mocks.getClaims.mockImplementationOnce(async () => {
      const options =
        mocks.createServerClient.mock.calls[0][2];

      options.cookies.setAll([
        {
          name: "test-session",
          value: "updated-value",
          options: {
            path: "/",
            httpOnly: true,
          },
        },
      ]);

      return {
        data: {
          claims: { sub: "test-user-id" },
        },
        error: null,
      };
    });

    const response = await updateSession(
      requestFor("/dashboard")
    );

    expect(response.status).toBe(307);

    expect(response.cookies.get("test-session"))
      .toMatchObject({
        name: "test-session",
        value: "updated-value",
      });
  });


  it("forwards audited resume actions without an MFA redirect", async () => {
    authenticated();
    setAal("aal1", "aal2");

    const request = new NextRequest(
      "http://localhost:3000/upload-resume",
      {
        method: "POST",
        headers: {
          "next-action": "test-action-id",
          "content-type": "text/plain;charset=UTF-8",
        },
        body: "[]",
      }
    );

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.getClaims).toHaveBeenCalledOnce();
    expect(mocks.getAal).not.toHaveBeenCalled();
  });

  it("still redirects normal resume page navigation", async () => {
    authenticated();
    setAal("aal1", "aal2");

    const response = await updateSession(
      requestFor("/upload-resume")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/mfa"
    );
  });

  it("does not exempt ordinary POST requests", async () => {
    authenticated();
    setAal("aal1", "aal2");

    const request = new NextRequest(
      "http://localhost:3000/upload-resume",
      {
        method: "POST",
      }
    );

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/mfa"
    );
  });

  it("does not exempt Server Actions on unrelated routes", async () => {
    authenticated();
    setAal("aal1", "aal2");

    const request = new NextRequest(
      "http://localhost:3000/profile",
      {
        method: "POST",
        headers: {
          "next-action": "test-action-id",
        },
      }
    );

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/mfa"
    );
  });

  it("forwards signed-out resume actions to their own auth guard", async () => {
    const request = new NextRequest(
      "http://localhost:3000/upload-resume",
      {
        method: "POST",
        headers: {
          "next-action": "test-action-id",
        },
      }
    );

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();

    // The action must reject this request itself.
    expect(mocks.getClaims).toHaveBeenCalledOnce();
  });
});
