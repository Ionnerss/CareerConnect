import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { verifyNonemptyRecommendationCache } from "./check-recommendation-nonempty-cache.mjs";

function checked(result, label) {
  if (result.error) {
    throw new Error(
      `${label} failed (${result.error.code ?? "unknown"}).`,
    );
  }

  return result.data;
}

export async function verifyRecommendationRefreshResilience({
  admin,
  seekerClient,
  userId,
  published,
  completedStatus,
  savedRecommendations,
  refreshStatus,
  invokeWorker,
}) {
  async function readState() {
    return checked(
      await admin
        .from("recommendation_refresh_state")
        .select("*")
        .eq("user_id", userId)
        .single(),
      "Read resilience-test state",
    );
  }

  async function readRuns() {
    return checked(
      await admin
        .from("recommendation_runs")
        .select(
          "id, status, completed_at, failure_code, input_fingerprint, content_generated_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
      "Read resilience-test runs",
    );
  }

  async function requireNoProviderUsage() {
    const usage = checked(
      await admin
        .from("recommendation_provider_user_usage")
        .select("provider, calls")
        .eq("user_id", userId),
      "Read test seeker's provider usage",
    );

    assert.deepEqual(
      usage,
      [],
      "This test must not consume provider reservations.",
    );

    const leases = checked(
      await admin
        .from("recommendation_provider_call_leases")
        .select("token")
        .eq("user_id", userId),
      "Read test seeker's provider leases",
    );

    assert.deepEqual(leases, []);
  }

  async function makeRetryDue() {
    // Test fixture adjustment only. Preserve the attempt counter,
    // requested revision, and configured retry limit.
    checked(
      await admin
        .from("recommendation_refresh_state")
        .update({
          next_attempt_at: "1970-01-01T00:00:00.000Z",
        })
        .eq("user_id", userId)
        .select("user_id")
        .single(),
      "Advance only the test seeker's retry fixture",
    );
  }

  const policies = checked(
    await admin
      .from("recommendation_provider_policies")
      .select("provider, enabled"),
    "Read provider policies",
  );

  assert.deepEqual(
    policies.map((policy) => policy.provider).sort(),
    ["groq", "jev"],
  );

  assert.ok(
    policies.every((policy) => policy.enabled === false),
    "Run this test with both local provider policies disabled.",
  );

  await requireNoProviderUsage();

  const original = (await readRuns()).find(
    (run) => run.id === published.run.id,
  );

  assert.ok(original);
  assert.equal(original.status, "succeeded");
  assert.match(original.input_fingerprint, /^[0-9a-f]{64}$/);

  // Opting in requests another refresh without changing the
  // recommendation inputs. This should reuse the successful result.
  checked(
    await seekerClient.rpc(
      "set_recommendation_background_refresh",
      {
        p_enabled: true,
      },
    ),
    "Enable the temporary seeker's background refresh",
  );

  const pending = await refreshStatus();

  assert.equal(pending.background_enabled, true);
  assert.equal(pending.stale, true);

  const cacheTick = await invokeWorker();

  assert.equal(cacheTick.stats.claimed, 1);
  assert.equal(cacheTick.stats.succeeded, 1);
  assert.equal(cacheTick.stats.failed, 0);

  const cached = await savedRecommendations();
  const cachedStatus = await refreshStatus();

  assert.ok(cached.run?.id);
  assert.notEqual(cached.run.id, published.run.id);

  assert.deepEqual(
    cached.recommendations,
    published.recommendations,
  );

  assert.equal(cachedStatus.stale, false);

  assert.equal(
    Date.parse(cachedStatus.generated_at),
    Date.parse(completedStatus.generated_at),
    "Cache reuse must preserve the original generation time.",
  );

  assert.ok(
    Date.parse(cachedStatus.checked_at) >
      Date.parse(completedStatus.checked_at),
    "Cache reuse must record a new input check.",
  );

  const cachedRun = (await readRuns()).find(
    (run) => run.id === cached.run.id,
  );

  assert.ok(cachedRun);

  assert.equal(
    cachedRun.input_fingerprint,
    original.input_fingerprint,
  );

  assert.ok(
    cachedRun.content_generated_at,
    "Cache reuse must store the original generation time.",
  );

  assert.equal(
    Date.parse(cachedRun.content_generated_at),
    Date.parse(completedStatus.generated_at),
  );

  await requireNoProviderUsage();

  console.log(
    "PASS unchanged-input cache reuse and generation age.",
  );

    const fixtureJobId = randomUUID();
    let fixtureRecruiterId = null;

    try {
        const recruiter = checked(
        await admin.auth.admin.createUser({
            email: `recommendation-smoke-recruiter-${randomUUID()}@example.test`,
            password: randomUUID() + randomUUID(),
            email_confirm: true,
            user_metadata: {
            full_name: "Local smoke recruiter",
            },
        }),
        "Create temporary recruiter",
        );

        assert.ok(
        recruiter.user?.id,
        "Recruiter creation returned no user.",
        );

        fixtureRecruiterId = recruiter.user.id;

        checked(
        await admin
            .from("profiles")
            .update({
            role: "recruiter",
            })
            .eq("id", fixtureRecruiterId)
            .select("id")
            .single(),
        "Set temporary recruiter role",
        );

        checked(
        await admin.from("job").insert({
            id: fixtureJobId,
            recruiter_id: fixtureRecruiterId,
            title: "Recommendation smoke test developer",
            firm_name: "Local smoke fixture",
            description:
            "Temporary posting for recommendation failure verification.",
            required_skills: null,
            location: "Montreal",
            work_mode: "Remote",
            employment_type: "Full-time",
            experience: 0,
            status: "open",
        }),
        "Create temporary posting",
        );

    checked(
      await admin
        .from("profile_preferences")
        .upsert(
          {
            profile_id: userId,
            desired_role: "Recommendation smoke test developer",
          },
          {
            onConflict: "profile_id",
          },
        ),
      "Make the temporary seeker profile nonempty",
    );

    assert.equal((await refreshStatus()).stale, true);
    assert.equal((await readState()).max_attempts, 3);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (attempt > 1) {
        await makeRetryDue();
      }

      const tick = await invokeWorker();

      assert.equal(tick.stats.claimed, 1);
      assert.equal(tick.stats.failed, 1);
      assert.equal(tick.stats.succeeded, 0);
      assert.equal(tick.stats.cleanup_errors, 0);

      const state = await readState();
      const status = await refreshStatus();
      const saved = await savedRecommendations();
      const runs = await readRuns();

      const failures = runs.filter(
        (run) => run.status === "failed",
      );

      assert.equal(state.attempt_count, attempt);
      assert.equal(
        state.last_failure_code,
        "generation_failed",
      );

      assert.equal(state.claim_token, null);
      assert.equal(state.lease_expires_at, null);

      assert.ok(
        BigInt(state.requested_revision) >
          BigInt(state.completed_revision),
        "Failed work must remain incomplete.",
      );

      assert.equal(status.stale, true);
      assert.equal(
        status.status,
        attempt < 3 ? "retry_wait" : "failed",
      );

      assert.deepEqual(
        saved,
        cached,
        "Failed work must preserve the last successful saved response.",
      );

      assert.equal(runs.length, 2 + attempt);
      assert.equal(failures.length, attempt);
      assert.equal(runs[0].status, "failed");
      assert.equal(
        runs[0].failure_code,
        "generation_failed",
      );

      // Both timestamps come from the database failure-recording
      // function, avoiding dependence on the terminal's clock.
      const expectedDelayMs = 60_000 * 2 ** (attempt - 1);

      const recordedDelayMs =
        Date.parse(state.next_attempt_at) -
        Date.parse(runs[0].completed_at);

      assert.ok(
        recordedDelayMs >= expectedDelayMs - 10 &&
          recordedDelayMs <= expectedDelayMs + 5_000,
        `Unexpected backoff after attempt ${attempt}.`,
      );

      await requireNoProviderUsage();

      // A worker tick during backoff must not start another attempt.
      const blockedTick = await invokeWorker();

      assert.equal(blockedTick.stats.selected, 0);
      assert.equal(blockedTick.stats.claimed, 0);
      assert.equal(
        (await readRuns()).length,
        2 + attempt,
      );
    }

    // Even after its retry timestamp passes, exhausted work must
    // remain blocked until an explicit retry or new source revision.
    await makeRetryDue();

    const exhaustedTick = await invokeWorker();

    assert.equal(exhaustedTick.stats.selected, 0);
    assert.equal(exhaustedTick.stats.claimed, 0);
    assert.equal((await readState()).attempt_count, 3);
    assert.equal((await refreshStatus()).status, "failed");
    assert.equal((await readRuns()).length, 5);

    assert.deepEqual(
      await savedRecommendations(),
      cached,
    );

    console.log(
      "PASS last-good preservation, backoff, and retry exhaustion.",
    );
    await verifyNonemptyRecommendationCache({
      admin,
      userId,
      jobId: fixtureJobId,
      savedRecommendations,
      refreshStatus,
      invokeWorker,
    });
    } finally {
    try {
      checked(
        await admin
          .from("job")
          .delete()
          .eq("id", fixtureJobId),
        "Delete temporary posting",
      );
    } finally {
      if (fixtureRecruiterId) {
        checked(
          await admin.auth.admin.deleteUser(
            fixtureRecruiterId,
          ),
          "Delete temporary recruiter",
        );
      }
    }
  }
}