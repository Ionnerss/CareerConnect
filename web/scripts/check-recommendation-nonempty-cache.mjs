import assert from "node:assert/strict";

function checked(result, label) {
  if (result.error) {
    throw new Error(
      `${label} failed (${result.error.code ?? "unknown"}).`,
    );
  }

  return result.data;
}

export async function verifyNonemptyRecommendationCache({
  admin,
  userId,
  jobId,
  savedRecommendations,
  refreshStatus,
  invokeWorker,
}) {
  // The preceding resilience test recorded these inputs through the
  // real worker. Copy only input/version metadata into fixture runs.
  const metadata = checked(
    await admin
      .from("recommendation_runs")
      .select(
        "considered_jobs, seeker_input_hash, input_fingerprint, scoring_version, jev_model_version, jev_prompt_version, summary_model_version, summary_prompt_version",
      )
      .eq("user_id", userId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .single(),
    "Read worker-recorded input metadata",
  );

  assert.match(
    metadata.input_fingerprint,
    /^[0-9a-f]{64}$/,
  );

  async function reserveFixtureRun(generatedAt = null) {
    checked(
      await admin.rpc(
        "mark_recommendation_inputs_changed",
        {
          p_user_id: userId,
        },
      ),
      "Request a new test revision",
    );

    const claims = checked(
      await admin.rpc("claim_recommendation_refresh", {
        p_user_id: userId,
        p_lease_seconds: 300,
      }),
      "Claim the test revision",
    );

    assert.equal(claims.length, 1);

    const claim = claims[0];

    const run = checked(
      await admin
        .from("recommendation_runs")
        .insert({
          user_id: userId,
          status: "running",
          started_at: new Date().toISOString(),
          ...metadata,
          refresh_claim_token: claim.claim_token,
          refresh_revision: claim.claimed_revision,
          content_generated_at: generatedAt,
        })
        .select("id")
        .single(),
      "Reserve fixture run",
    );

    return {
      id: run.id,
      claim,
    };
  }

  async function requireNoProviderUsage() {
    const usage = checked(
      await admin
        .from("recommendation_provider_user_usage")
        .select("provider, calls")
        .eq("user_id", userId),
      "Read nonempty-cache provider usage",
    );

    assert.deepEqual(
      usage,
      [],
      "Cache checks must not consume provider reservations.",
    );

    const leases = checked(
      await admin
        .from("recommendation_provider_call_leases")
        .select("token")
        .eq("user_id", userId),
      "Read nonempty-cache provider leases",
    );

    assert.deepEqual(leases, []);
  }

  await requireNoProviderUsage();

  // Seed a result through the real publication function and guards.
  // Scores, summary, and per-job hash are controlled test fixtures.
  const generatedAt = new Date(
    Date.now() - 5 * 60_000,
  ).toISOString();

  const source = await reserveFixtureRun(generatedAt);

  const summary =
    "Controlled cache fixture: verify reuse without a provider call.";

  const publishedId = checked(
    await admin.rpc("publish_recommendation_run", {
      p_run_id: source.id,
      p_results: [
        {
          job_id: jobId,
          rank: 1,
          score: 80,
          match_score: 75,
          fit: {
            score: 80,
            minConfidence: 0.9,
            lowConfidence: false,
            levels: {
              skills: 3,
              level: 2,
              interest: 2,
            },
          },
          fit_error: null,
          fit_generated_at: generatedAt,
          skill_match: null,
          reasons: [
            "Controlled nonempty cache fixture",
          ],
          summary,
          seeker_input_hash: metadata.seeker_input_hash,
          job_input_hash: "e".repeat(64),
          job_input_checked_at: new Date().toISOString(),
        },
      ],
    }),
    "Publish controlled nonempty source",
  );

  assert.equal(publishedId, source.id);

  const seeded = await savedRecommendations();
  const seededStatus = await refreshStatus();

  assert.equal(seeded.run?.id, source.id);
  assert.equal(seeded.run.ranking_mode, "ai");
  assert.equal(seeded.run.result_count, 1);
  assert.equal(seeded.run.summary_count, 1);
  assert.equal(seeded.recommendations.length, 1);
  assert.equal(seeded.recommendations[0].job.id, jobId);
  assert.equal(seeded.recommendations[0].summary, summary);

  assert.equal(
    Date.parse(seededStatus.generated_at),
    Date.parse(generatedAt),
  );

  // Simulate another refresh event for unchanged recommendation
  // inputs. The real worker must reuse the nonempty source.
  checked(
    await admin.rpc(
      "mark_recommendation_inputs_changed",
      {
        p_user_id: userId,
      },
    ),
    "Request unchanged-input refresh",
  );

  const tick = await invokeWorker();

  assert.equal(tick.stats.claimed, 1);
  assert.equal(tick.stats.succeeded, 1);
  assert.equal(tick.stats.failed, 0);

  const cached = await savedRecommendations();
  const cachedStatus = await refreshStatus();

  assert.ok(cached.run?.id);
  assert.notEqual(cached.run.id, source.id);

  assert.deepEqual(
    cached.recommendations,
    seeded.recommendations,
    "Cache reuse must preserve all visible recommendation content.",
  );

  assert.equal(cachedStatus.stale, false);

  assert.equal(
    Date.parse(cachedStatus.generated_at),
    Date.parse(generatedAt),
    "Reusing nonempty results must preserve their generation age.",
  );

  assert.ok(
    Date.parse(cachedStatus.checked_at) >
      Date.parse(seededStatus.checked_at),
    "Reusing results must record a new input check.",
  );

  const cachedRun = checked(
    await admin
      .from("recommendation_runs")
      .select("input_fingerprint, content_generated_at")
      .eq("id", cached.run.id)
      .single(),
    "Read nonempty cached run",
  );

  assert.equal(
    cachedRun.input_fingerprint,
    metadata.input_fingerprint,
  );

  assert.equal(
    Date.parse(cachedRun.content_generated_at),
    Date.parse(generatedAt),
  );

  await requireNoProviderUsage();

  console.log(
    "PASS nonempty cache reuse without provider reservations.",
  );

  // Capture another claim, then change the profile before attempting
  // cached publication with that claim.
  const stale = await reserveFixtureRun();

  try {
    const before = checked(
      await admin
        .from("recommendation_refresh_state")
        .select("completed_revision, requested_revision")
        .eq("user_id", userId)
        .single(),
      "Read state before profile mutation",
    );

    checked(
      await admin
        .from("profiles")
        .update({
          location: "Changed during cache publication test",
        })
        .eq("id", userId)
        .select("id")
        .single(),
      "Change profile after capturing the claim",
    );

    const reused = await admin.rpc(
      "reuse_recommendation_run",
      {
        p_run_id: stale.id,
        p_summary_count: 1,
        p_max_age_seconds: 900,
      },
    );

    assert.equal(reused.error?.code, "22023");

    assert.match(
      reused.error?.message ?? "",
      /Recommendation inputs changed during processing/,
    );

    // Cache reuse updates generation metadata and inserts copied rows
    // before publication completes. Rejection must roll all of it back.
    const rejected = checked(
      await admin
        .from("recommendation_runs")
        .select("status, content_generated_at")
        .eq("id", stale.id)
        .single(),
      "Read rejected cache run",
    );

    assert.equal(rejected.status, "running");
    assert.equal(rejected.content_generated_at, null);

    const rows = checked(
      await admin
        .from("recommendation_results")
        .select("id")
        .eq("run_id", stale.id),
      "Check rejected cache result rollback",
    );

    assert.deepEqual(rows, []);

    const after = checked(
      await admin
        .from("recommendation_refresh_state")
        .select(
          "completed_revision, requested_revision, claim_token",
        )
        .eq("user_id", userId)
        .single(),
      "Read state after rejected publication",
    );

    assert.equal(
      after.completed_revision,
      before.completed_revision,
    );

    assert.ok(
      BigInt(after.requested_revision) >
        BigInt(before.requested_revision),
    );

    assert.equal(
      after.claim_token,
      stale.claim.claim_token,
    );

    assert.equal((await refreshStatus()).stale, true);

    assert.deepEqual(
      await savedRecommendations(),
      cached,
      "Rejected publication must preserve the last successful response.",
    );

    await requireNoProviderUsage();

    console.log(
      "PASS stale cache publication rollback and last-good preservation.",
    );
  } finally {
    const released = checked(
      await admin.rpc("fail_recommendation_refresh", {
        p_claim_token: stale.claim.claim_token,
        p_failure_code: "publication_failed",
        p_retry_seconds: 1,
      }),
      "Release the deliberately stale test attempt",
    );

    assert.equal(released, true);
  }
}