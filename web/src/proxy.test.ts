import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";

const { mockUpdateSession } = vi.hoisted(() => ({
  mockUpdateSession: vi.fn(),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mockUpdateSession,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("proxy", () => {
  it("lets the exact worker endpoint perform its own authentication", async () => {
    const request = new NextRequest(
      "http://localhost/api/internal/recommendations/refresh",
      { method: "POST" },
    );

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it("continues session handling for protected pages", async () => {
    const request = new NextRequest("http://localhost/dashboard");
    const expected = NextResponse.next();

    mockUpdateSession.mockResolvedValue(expected);

    expect(await proxy(request)).toBe(expected);
    expect(mockUpdateSession).toHaveBeenCalledWith(request);
  });

  it("does not bypass session handling for a similar path", async () => {
    const request = new NextRequest(
      "http://localhost/api/internal/recommendations/refresh/other",
    );

    const expected = NextResponse.next();
    mockUpdateSession.mockResolvedValue(expected);

    expect(await proxy(request)).toBe(expected);
    expect(mockUpdateSession).toHaveBeenCalledWith(request);
  });
});