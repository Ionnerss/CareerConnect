import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { verifyRecommendationRefreshResilience } from "./check-recommendation-refresh-resilience.mjs";

function required(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function localURL(value, label) {
  const url = new URL(value);

  assert.ok(
    url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    `${label} must be a plain local HTTP origin.`,
  );

  return url;
}

function checked(result, label) {
  if (result.error) {
    const code =
      result.error.code ??
      result.error.status ??
      "unknown";

    throw new Error(`${label} failed (${code}).`);
  }

  return result.data;
}

function boundedFetch(input, init = {}) {
  return fetch(input, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(60_000),
  });
}

const appURL = localURL(
  process.argv[2] ?? "http://127.0.0.1:3000",
  "Application URL",
);

const supabaseURL = localURL(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  "Supabase URL",
);

const publishableKey = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);

const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const workerSecret = required("RECOMMENDATION_WORKER_SECRET");

const admin = createClient(
  supabaseURL.origin,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: boundedFetch,
    },
  },
);

// Use the same SSR cookie mechanism as the application.
const cookieJar = new Map();

const seekerClient = createServerClient(
  supabaseURL.origin,
  publishableKey,
  {
    cookies: {
      getAll() {
        return Array.from(cookieJar, ([name, value]) => ({
          name,
          value,
        }));
      },
      setAll(cookies) {
        for (const { name, value } of cookies) {
          if (value) {
            cookieJar.set(name, value);
          } else {
            cookieJar.delete(name);
          }
        }
      },
    },
    global: {
      fetch: boundedFetch,
    },
  },
);

async function request(
  path,
  {
    method = "GET",
    worker = false,
    anonymous = false,
  } = {},
) {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (worker) {
    headers.set("Authorization", `Bearer ${workerSecret}`);
  } else if (!anonymous && cookieJar.size > 0) {
    headers.set(
      "Cookie",
      Array.from(
        cookieJar,
        ([name, value]) => `${name}=${value}`,
      ).join("; "),
    );
  }

  const response = await boundedFetch(
    new URL(path, appURL),
    {
      method,
      headers,
      redirect: "manual",
      cache: "no-store",
    },
  );

  const body = await response.json().catch(() => null);

  return { response, body };
}

function expectHTTP(result, expectedStatus, label) {
  const code =
    typeof result.body?.code === "string"
      ? result.body.code
      : "NO_CODE";

  assert.equal(
    result.response.status,
    expectedStatus,
    `${label}: unexpected HTTP status (${code}).`,
  );
}

async function savedRecommendations() {
  const result = await request("/api/recommendations");

  expectHTTP(result, 200, "Read saved recommendations");
  assert.equal(result.body?.success, true);
  assert.ok(Array.isArray(result.body.recommendations));

  return result.body;
}

async function refreshStatus() {
  const result = await request(
    "/api/recommendations/status",
  );

  expectHTTP(result, 200, "Read refresh status");
  assert.equal(result.body?.success, true);

  return result.body;
}

async function invokeWorker() {
  const result = await request(
    "/api/internal/recommendations/refresh",
    {
      method: "POST",
      worker: true,
    },
  );

  expectHTTP(result, 200, "Invoke worker");
  assert.equal(result.body?.success, true);

  return result.body;
}

async function requireQuietLocalQueue() {
  const backgroundParticipants = checked(
    await admin
      .from("recommendation_refresh_preferences")
      .select("user_id")
      .eq("enabled", true)
      .limit(1),
    "Check background participants",
  );

  assert.equal(
    backgroundParticipants.length,
    0,
    "Other background participants exist. Disable them locally before this test.",
  );

  const manualRequests = checked(
    await admin
      .from("recommendation_refresh_state")
      .select("user_id")
      .eq("manual_refresh_pending", true)
      .limit(1),
    "Check pending manual requests",
  );

  assert.equal(
    manualRequests.length,
    0,
    "Other manual requests are pending. Finish them before this test.",
  );
}

let userId = null;
let checksPassed = false;

try {
  await requireQuietLocalQueue();

  const unauthorizedWorker = await request(
    "/api/internal/recommendations/refresh",
    {
      method: "POST",
      anonymous: true,
    },
  );

  expectHTTP(
    unauthorizedWorker,
    401,
    "Worker without a secret",
  );

  const email = `recommendation-smoke-${randomUUID()}@example.test`;
  const password = randomBytes(32).toString("hex");

  const created = checked(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "Recommendation Smoke Test",
      },
    }),
    "Create temporary account",
  );

  assert.ok(created.user?.id, "Account creation returned no user.");
  userId = created.user.id;

  checked(
    await admin
      .from("profiles")
      .update({
        role: "job_seeker",
      })
      .eq("id", userId)
      .select("id")
      .single(),
    "Set temporary seeker role",
  );

  const signedIn = checked(
    await seekerClient.auth.signInWithPassword({
      email,
      password,
    }),
    "Sign in temporary seeker",
  );

  assert.equal(signedIn.user?.id, userId);
  assert.ok(cookieJar.size > 0, "Sign-in produced no session cookies.");

  const initialStatus = await refreshStatus();

  assert.equal(
    initialStatus.processing_enabled,
    true,
    "Restart Next.js with background processing enabled for this local test.",
  );
  assert.equal(initialStatus.background_enabled, false);

  const initialSaved = await savedRecommendations();

  assert.equal(initialSaved.run, null);
  assert.deepEqual(initialSaved.recommendations, []);

  const queued = await request(
    "/api/recommendations/refresh",
    {
      method: "POST",
    },
  );

  expectHTTP(queued, 202, "Queue refresh");
  assert.equal(queued.body?.success, true);
  assert.equal(queued.body.status, "queued");

  // Exercise the compatibility endpoint while the same work is pending.
  const repeated = await request("/api/recommendations", {
    method: "POST",
  });

  expectHTTP(repeated, 202, "Repeat refresh request");
  assert.equal(repeated.body?.success, true);
  assert.equal(repeated.body.status, "already_pending");

  const pendingStatus = await refreshStatus();

  assert.equal(pendingStatus.manual_pending, true);
  assert.equal(pendingStatus.background_enabled, false);

  // POST acknowledges work without publishing synchronously.
  const beforeWorker = await savedRecommendations();

  assert.equal(
    beforeWorker.run,
    null,
    "A queue request unexpectedly published a run.",
  );

  await invokeWorker();

  const published = await savedRecommendations();

  assert.ok(
    published.run?.id,
    "The worker did not publish a successful run. Check the Next.js terminal.",
  );
  assert.equal(published.run.result_count, 0);
  assert.deepEqual(published.recommendations, []);

  const completedStatus = await refreshStatus();

  assert.equal(completedStatus.manual_pending, false);
  assert.equal(completedStatus.stale, false);
  assert.equal(completedStatus.background_enabled, false);
  assert.ok(completedStatus.generated_at);
  assert.ok(completedStatus.checked_at);

  const state = checked(
    await admin
      .from("recommendation_refresh_state")
      .select(
        "requested_revision, completed_revision, claim_token, manual_refresh_pending, attempt_count",
      )
      .eq("user_id", userId)
      .single(),
    "Read completed refresh state",
  );

  assert.equal(
    state.completed_revision,
    state.requested_revision,
  );
  assert.equal(state.claim_token, null);
  assert.equal(state.manual_refresh_pending, false);
  assert.equal(state.attempt_count, 1);

  // Completed work must not produce another run on the next tick.
  await invokeWorker();

  const afterSecondWorker = await savedRecommendations();

  assert.equal(
    afterSecondWorker.run?.id,
    published.run.id,
    "A second worker invocation replaced already-completed work.",
  );

  const runs = checked(
    await admin
      .from("recommendation_runs")
      .select("id, status")
      .eq("user_id", userId),
    "Read temporary seeker's runs",
  );

  assert.equal(runs.length, 1);
  assert.equal(runs[0].id, published.run.id);
  assert.equal(runs[0].status, "succeeded");

  await verifyRecommendationRefreshResilience({
    admin,
    seekerClient,
    userId,
    published,
    completedStatus,
    savedRecommendations,
    refreshStatus,
    invokeWorker,
  });

  checksPassed = true;
} catch (error) {
  process.exitCode = 1;
  console.error(
    error instanceof Error
      ? error.message
      : "Recommendation smoke test failed.",
  );
} finally {
  if (userId) {
    try {
      checked(
        await admin.auth.admin.deleteUser(userId),
        "Delete temporary account",
      );

      const profile = checked(
        await admin
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle(),
        "Check profile cleanup",
      );

      assert.equal(profile, null);

      const state = checked(
        await admin
          .from("recommendation_refresh_state")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle(),
        "Check refresh-state cleanup",
      );

      assert.equal(state, null);

      const remainingRuns = checked(
        await admin
          .from("recommendation_runs")
          .select("id")
          .eq("user_id", userId),
        "Check run cleanup",
      );

      assert.equal(remainingRuns.length, 0);
    } catch (error) {
      process.exitCode = 1;
      console.error(
        error instanceof Error
          ? error.message
          : "Temporary account cleanup failed.",
      );
      console.error(`Temporary account needing inspection: ${userId}`);
    }
  }

  cookieJar.clear();
}

if (checksPassed && !process.exitCode) {
  console.log("PASS recommendation refresh HTTP smoke test.");
}