import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const { mockGetPreference, mockSetPreference } = vi.hoisted(
  () => ({
    mockGetPreference: vi.fn(),
    mockSetPreference: vi.fn(),
  }),
);

vi.mock("@/lib/recommendations/refresh-preferences", () => ({
  getRecommendationRefreshPreference: mockGetPreference,
  setRecommendationRefreshPreference: mockSetPreference,
}));

function request(body: unknown) {
  return new Request(
    "http://localhost/api/recommendations/preferences",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  vi.resetAllMocks();

  mockGetPreference.mockResolvedValue({
    success: true,
    enabled: false,
  });

  mockSetPreference.mockImplementation(async (enabled: boolean) => ({
    success: true,
    enabled,
  }));
});

describe("recommendation preferences route", () => {
  it("returns the current preference", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      enabled: false,
    });
  });

  it("maps signed-out reads to 401", async () => {
    mockGetPreference.mockResolvedValue({
      success: false,
      code: "UNAUTHENTICATED",
      error: "Sign in again.",
    });

    expect((await GET()).status).toBe(401);
  });

  it("maps pending MFA updates to 403", async () => {
    mockSetPreference.mockResolvedValue({
      success: false,
      code: "MFA_REQUIRED",
      error: "Complete two-factor authentication.",
    });

    expect(
      (await PUT(request({ enabled: true }))).status,
    ).toBe(403);
  });

  it.each([true, false])(
    "accepts enabled=%s",
    async (enabled) => {
      const response = await PUT(request({ enabled }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        enabled,
      });

      expect(mockSetPreference).toHaveBeenCalledWith(enabled);
    },
  );

  it.each([
    {},
    { enabled: "true" },
    { enabled: null },
    { enabled: true, user_id: "another-user" },
  ])("rejects an invalid body %j", async (body) => {
    const response = await PUT(request(body));

    expect(response.status).toBe(400);
    expect(mockSetPreference).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await PUT(
      new Request(
        "http://localhost/api/recommendations/preferences",
        {
          method: "PUT",
          body: "{",
        },
      ),
    );

    expect(response.status).toBe(400);
    expect(mockSetPreference).not.toHaveBeenCalled();
  });

  it("does not expose unexpected update errors", async () => {
    mockSetPreference.mockRejectedValue(
      new Error("Private database details"),
    );

    const response = await PUT(request({ enabled: true }));

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(
      "Private database details",
    );
  });

  it("marks read and update responses private and non-cacheable", async () => {
    const read = await GET();
    const update = await PUT(request({ enabled: true }));

    expect(read.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );

    expect(update.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
  });
});