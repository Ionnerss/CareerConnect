import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  enqueueRecommendationRefresh,
  fetchRecommendationRefreshStatus,
  fetchSavedRecommendations,
} from "./refresh-client";

const mockFetch = vi.fn();

function response(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  };
}

function savedRun(resultCount = 0) {
  return {
    id: "run-1",
    created_at: "2026-11-27T00:00:00Z",
    completed_at: "2026-11-27T00:00:10Z",
    result_count: resultCount,
    summary_count: 0,
    ranking_mode: resultCount === 0 ? null : "code_only",
  };
}

function recommendation() {
  return {
    job: {
      id: "job-1",
      title: "Java Developer",
      firm_name: "Test Company",
      location: "Montreal",
      work_mode: "Remote",
      employment_type: "Full-time",
      required_skills: "Java",
      salary: 60000,
      experience: null,
      description: "Build Java services.",
      status: "open",
      created_at: "2026-11-01T00:00:00Z",
    },
    score: 80,
    match_score: 80,
    fit: null,
    skill_match: {
      percent: 100,
      matched: ["Java"],
      missing: [],
    },
    reasons: ["Your profile lists Java"],
    summary: null,
    fit_error: null,
    fit_generated_at: null,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recommendation refresh client", () => {
  it.each([
    {
      label: "no successful run",
      run: null,
    },
    {
      label: "a successful empty run",
      run: savedRun(),
    },
  ])("preserves $label", async ({ run }) => {
    mockFetch.mockResolvedValue(
      response({
        success: true,
        run,
        recommendations: [],
      }),
    );

    const result = await fetchSavedRecommendations();

    expect(result.run).toEqual(run);
    expect(result.recommendations).toEqual([]);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/recommendations",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });

  it("reads saved recommendation content", async () => {
    const item = recommendation();

    mockFetch.mockResolvedValue(
      response({
        success: true,
        run: savedRun(1),
        recommendations: [item],
      }),
    );

    const result = await fetchSavedRecommendations();

    expect(result.recommendations).toEqual([item]);
  });

  it("reads refresh state and freshness", async () => {
    const body = {
      success: true,
      processing_enabled: false,
      status: "queued",
      stale: true,
      background_enabled: false,
      manual_pending: true,
      attempt_count: 0,
      max_attempts: 3,
      next_attempt_at: null,
      last_failure_code: null,
      generated_at: "2026-11-27T00:00:00Z",
      checked_at: "2026-11-27T00:05:00Z",
    };

    mockFetch.mockResolvedValue(response(body));

    expect(await fetchRecommendationRefreshStatus()).toEqual(body);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/recommendations/status",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it.each(["queued", "already_pending"] as const)(
    "handles a refresh response of %s",
    async (status) => {
      mockFetch.mockResolvedValue(
        response({ success: true, status }, 202),
      );

      expect(await enqueueRecommendationRefresh()).toEqual({
        success: true,
        status,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/recommendations/refresh",
        expect.objectContaining({ method: "POST" }),
      );
    },
  );

  it.each([
    ["UNAUTHENTICATED", 401],
    ["MFA_REQUIRED", 403],
    ["NOT_JOB_SEEKER", 403],
  ] as const)(
    "preserves the error code %s",
    async (code, status) => {
      mockFetch.mockResolvedValue(
        response(
          {
            success: false,
            code,
            error: "Private server details",
          },
          status,
        ),
      );

      await expect(fetchSavedRecommendations()).rejects.toMatchObject({
        code,
      });
    },
  );

  it("reports a network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Connection failed"));

    await expect(fetchSavedRecommendations()).rejects.toMatchObject({
      code: "NETWORK",
    });
  });

  it("rejects a non-JSON response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => {
        throw new SyntaxError("Invalid JSON");
      },
    });

    await expect(fetchSavedRecommendations()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("rejects malformed recommendation rows", async () => {
    mockFetch.mockResolvedValue(
      response({
        success: true,
        run: savedRun(1),
        recommendations: [
          {
            ...recommendation(),
            score: 200,
          },
        ],
      }),
    );

    await expect(fetchSavedRecommendations()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("reports cooldown guidance without automatically retrying", async () => {
    mockFetch.mockResolvedValue(
      response(
        {
          success: false,
          code: "RATE_LIMITED",
          error: "Please wait.",
        },
        429,
        { "Retry-After": "60" },
      ),
    );

    await expect(enqueueRecommendationRefresh()).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 60,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("preserves cancellation for the caller", async () => {
    const controller = new AbortController();
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";

    controller.abort();
    mockFetch.mockRejectedValue(abortError);

    await expect(
      fetchSavedRecommendations(controller.signal),
    ).rejects.toBe(abortError);
  });
});