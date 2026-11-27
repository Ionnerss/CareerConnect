import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatWorkerReport,
  invokeRecommendationWorker,
} from "./invoke-recommendation-worker.mjs";

const stats = {
  recovered: 0,
  selected: 1,
  claimed: 1,
  succeeded: 1,
  failed: 0,
  skipped: 0,
  claim_errors: 0,
  cleanup_errors: 0,
};

const base = {
  baseUrl: "https://app.example",
  secret: "test-secret",
};

function json(body) {
  return Response.json(body);
}

test("uses authenticated POST without following redirects", async () => {
  let calls = 0;

  const result = await invokeRecommendationWorker({
    ...base,
    fetcher: async (url, options) => {
      calls += 1;

      assert.equal(
        url.href,
        "https://app.example/api/internal/recommendations/refresh",
      );
      assert.equal(options.method, "POST");
      assert.equal(
        options.headers.Authorization,
        "Bearer test-secret",
      );
      assert.equal(options.redirect, "manual");
      assert.equal(options.cache, "no-store");
      assert.ok(options.signal instanceof AbortSignal);

      return json({
        success: true,
        stats: {
          ...stats,
          private_field: "do-not-print",
        },
      });
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.kind, "completed");
  assert.deepEqual(result.stats, stats);

  assert.doesNotMatch(
    formatWorkerReport(result),
    /do-not-print/,
  );
});

for (const field of [
  "failed",
  "claim_errors",
  "cleanup_errors",
]) {
  test(`${field} requires attention`, async () => {
    const result = await invokeRecommendationWorker({
      ...base,
      fetcher: async () =>
        json({
          success: true,
          stats: {
            ...stats,
            [field]: 1,
          },
        }),
    });

    assert.equal(result.kind, "attention");
  });
}

test("zero work is a healthy result", async () => {
  const result = await invokeRecommendationWorker({
    ...base,
    fetcher: async () =>
      json({
        success: true,
        stats: Object.fromEntries(
          Object.keys(stats).map((key) => [key, 0]),
        ),
      }),
  });

  assert.equal(result.kind, "completed");
});

test("disabled processing is explicitly skipped", async () => {
  const result = await invokeRecommendationWorker({
    ...base,
    fetcher: async () =>
      json({
        success: true,
        skipped: true,
        reason: "DISABLED",
      }),
  });

  assert.deepEqual(result, { kind: "disabled" });
  assert.match(formatWorkerReport(result), /Skipped/);
});

for (const baseUrl of [
  "http://remote.example",
  "http://localhost:3000",
  "https://user:password@app.example",
  "https://app.example/path",
  "https://app.example?token=value",
  "https://app.example/#fragment",
]) {
  test(`rejects invalid origin ${baseUrl}`, async () => {
    let called = false;

    await assert.rejects(
      invokeRecommendationWorker({
        ...base,
        baseUrl,
        fetcher: async () => {
          called = true;
          return json({});
        },
      }),
    );

    assert.equal(called, false);
  });
}

test("permits explicitly enabled loopback HTTP", async () => {
  const result = await invokeRecommendationWorker({
    ...base,
    baseUrl: "http://127.0.0.1:3000",
    allowLocal: true,
    fetcher: async () =>
      json({
        success: true,
        skipped: true,
        reason: "DISABLED",
      }),
  });

  assert.equal(result.kind, "disabled");
});

test("local flag still rejects remote HTTP", async () => {
  await assert.rejects(
    invokeRecommendationWorker({
      ...base,
      baseUrl: "http://remote.example",
      allowLocal: true,
    }),
  );
});

for (const secret of ["", "bad\nheader"]) {
  test("rejects invalid secret before fetching", async () => {
    let called = false;

    await assert.rejects(
      invokeRecommendationWorker({
        ...base,
        secret,
        fetcher: async () => {
          called = true;
          return json({});
        },
      }),
    );

    assert.equal(called, false);
  });
}

test("HTTP failure does not expose the response body", async () => {
  await assert.rejects(
    invokeRecommendationWorker({
      ...base,
      fetcher: async () =>
        new Response("private-server-details", {
          status: 503,
        }),
    }),
    {
      message: "Worker request failed (HTTP 503).",
    },
  );
});

test("network failure is not retried or exposed", async () => {
  let calls = 0;

  await assert.rejects(
    invokeRecommendationWorker({
      ...base,
      fetcher: async () => {
        calls += 1;
        throw new Error("private-token");
      },
    }),
    {
      message:
        "Worker request did not complete. Check server state before invoking again.",
    },
  );

  assert.equal(calls, 1);
});

test("rejects malformed JSON", async () => {
  await assert.rejects(
    invokeRecommendationWorker({
      ...base,
      fetcher: async () =>
        new Response("<html>unexpected</html>"),
    }),
    /invalid JSON/,
  );
});

test("rejects an unsuccessful batch body", async () => {
  await assert.rejects(
    invokeRecommendationWorker({
      ...base,
      fetcher: async () =>
        json({
          success: false,
          stats,
        }),
    }),
    /did not report/,
  );
});

for (const invalid of [-1, 1.5, undefined]) {
  test("rejects invalid or missing statistics", async () => {
    await assert.rejects(
      invokeRecommendationWorker({
        ...base,
        fetcher: async () =>
          json({
            success: true,
            stats: {
              ...stats,
              claimed: invalid,
            },
          }),
      }),
      /invalid batch statistics/,
    );
  });
}