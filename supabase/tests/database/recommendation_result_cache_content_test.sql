BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(10);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    'f7100000-0000-4000-8000-000000000001',
    'cache-content-seeker@example.com',
    '{"full_name":"Cache Content Seeker"}'::jsonb
  ),
  (
    'f7100000-0000-4000-8000-000000000002',
    'cache-content-recruiter@example.com',
    '{"full_name":"Cache Content Recruiter"}'::jsonb
  );

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id = 'f7100000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET role = 'recruiter'
WHERE id = 'f7100000-0000-4000-8000-000000000002';

INSERT INTO public.job (
  id,
  recruiter_id,
  title,
  description,
  location,
  status
)
VALUES (
  'f7200000-0000-4000-8000-000000000001',
  'f7100000-0000-4000-8000-000000000002',
  'Java Cache Test Job',
  'Build Java services.',
  'Montreal',
  'open'
);

CREATE TEMP TABLE cache_content_runs (
  label text PRIMARY KEY,
  run_id uuid NOT NULL
);

CREATE TEMP TABLE cache_content_payloads (
  label text PRIMARY KEY,
  result jsonb NOT NULL
);

GRANT SELECT, INSERT ON cache_content_runs TO service_role;
GRANT SELECT ON cache_content_payloads TO service_role;

INSERT INTO cache_content_payloads (label, result)
VALUES (
  'complete',
  jsonb_build_object(
    'job_id', 'f7200000-0000-4000-8000-000000000001',
    'rank', 1,
    'score', 85,
    'match_score', 80,
    'fit', jsonb_build_object(
      'score', 88,
      'minConfidence', 0.9,
      'lowConfidence', false,
      'levels', jsonb_build_object(
        'skills', 3,
        'level', 2,
        'interest', 3
      )
    ),
    'fit_error', NULL,
    'fit_generated_at', clock_timestamp() - interval '60 seconds',
    'skill_match', jsonb_build_object(
      'percent', 100,
      'matched', jsonb_build_array('Java'),
      'missing', '[]'::jsonb
    ),
    'reasons', jsonb_build_array('Your profile lists Java'),
    'summary', 'Your Java skills match this posting.',
    'seeker_input_hash', 'cache-content-seeker-hash',
    'job_input_hash', 'cache-content-job-hash',
    'job_input_checked_at', clock_timestamp()
  )
);

-- Fixture helper: start a new claimed run.
-- The fingerprint stays constant because these tests simulate source
-- events whose normalized matching inputs remain unchanged.
CREATE FUNCTION pg_temp.new_cache_content_run(
  p_label text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_run_id uuid;
BEGIN
  -- Expire a preceding cache-miss fixture's claim, if present.
  UPDATE public.recommendation_refresh_state
  SET lease_expires_at = clock_timestamp() - interval '1 second'
  WHERE user_id = 'f7100000-0000-4000-8000-000000000001'
    AND claim_token IS NOT NULL;

  PERFORM public.mark_recommendation_inputs_changed(
    'f7100000-0000-4000-8000-000000000001'
  );

  INSERT INTO public.recommendation_runs (
    user_id,
    status,
    seeker_input_hash,
    scoring_version,
    jev_model_version,
    jev_prompt_version,
    summary_model_version,
    summary_prompt_version,
    started_at,
    created_at,
    refresh_claim_token,
    refresh_revision,
    input_fingerprint,
    content_generated_at
  )
  SELECT
    'f7100000-0000-4000-8000-000000000001',
    'running',
    'cache-content-seeker-hash',
    'test-scoring-v1',
    'test-jev-model',
    'test-jev-prompt',
    'test-summary-model',
    'test-summary-prompt',
    clock_timestamp(),
    clock_timestamp(),
    claim_token,
    claimed_revision,
    repeat('a', 64),
    clock_timestamp() - interval '60 seconds'
  FROM public.claim_recommendation_refresh(
    'f7100000-0000-4000-8000-000000000001',
    300
  )
  RETURNING id INTO v_run_id;

  IF v_run_id IS NULL THEN
    RAISE EXCEPTION 'Test fixture could not claim refresh work';
  END IF;

  INSERT INTO pg_temp.cache_content_runs (label, run_id)
  VALUES (p_label, v_run_id);

  RETURN v_run_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION pg_temp.new_cache_content_run(text)
  TO service_role;

SET LOCAL ROLE service_role;

-- Generate the initial successful, nonempty source run.
SELECT pg_temp.new_cache_content_run('source');

SELECT public.publish_recommendation_run(
  (
    SELECT run_id
    FROM cache_content_runs
    WHERE label = 'source'
  ),
  (
    SELECT jsonb_build_array(result)
    FROM cache_content_payloads
    WHERE label = 'complete'
  )
);

SELECT pg_temp.new_cache_content_run('hit');

-- 1. Reuse actual recommendation content.
SELECT is(
  public.reuse_recommendation_run(
    (
      SELECT run_id
      FROM cache_content_runs
      WHERE label = 'hit'
    ),
    1,
    900
  ),
  true,
  'a complete nonempty result can be reused'
);

-- 2. Compare the copied content with its source.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.recommendation_results AS copied
    JOIN public.recommendation_results AS original
      ON original.job_id = copied.job_id
    WHERE copied.run_id = (
      SELECT run_id FROM cache_content_runs WHERE label = 'hit'
    )
      AND original.run_id = (
        SELECT run_id FROM cache_content_runs WHERE label = 'source'
      )
      AND ROW(
        copied.rank,
        copied.score,
        copied.match_score,
        copied.fit,
        copied.fit_error,
        copied.fit_generated_at,
        copied.skill_match,
        copied.reasons,
        copied.summary,
        copied.seeker_input_hash,
        copied.job_input_hash
      ) IS NOT DISTINCT FROM ROW(
        original.rank,
        original.score,
        original.match_score,
        original.fit,
        original.fit_error,
        original.fit_generated_at,
        original.skill_match,
        original.reasons,
        original.summary,
        original.seeker_input_hash,
        original.job_input_hash
      )
  ),
  'reuse preserves ranking, explanations, ratings, and rating timestamps'
);

-- 3. Reuse must not restart the content freshness clock.
SELECT is(
  (
    SELECT content_generated_at
    FROM public.recommendation_runs
    WHERE id = (
      SELECT run_id FROM cache_content_runs WHERE label = 'hit'
    )
  ),
  (
    SELECT content_generated_at
    FROM public.recommendation_runs
    WHERE id = (
      SELECT run_id FROM cache_content_runs WHERE label = 'source'
    )
  ),
  'reused content retains its original generation time'
);

SELECT pg_temp.new_cache_content_run('miss');

-- 4. Source content is already over one second old.
SELECT is(
  public.reuse_recommendation_run(
    (
      SELECT run_id FROM cache_content_runs WHERE label = 'miss'
    ),
    1,
    1
  ),
  false,
  'expired content requires generation'
);

UPDATE public.recommendation_runs
SET scoring_version = 'test-scoring-v2'
WHERE id = (
  SELECT run_id FROM cache_content_runs WHERE label = 'miss'
);

-- 5. Version checks also protect against a wrongly supplied fingerprint.
SELECT is(
  public.reuse_recommendation_run(
    (
      SELECT run_id FROM cache_content_runs WHERE label = 'miss'
    ),
    1,
    900
  ),
  false,
  'different scoring versions prevent reuse'
);

UPDATE public.recommendation_runs
SET scoring_version = 'test-scoring-v1',
    input_fingerprint = repeat('b', 64)
WHERE id = (
  SELECT run_id FROM cache_content_runs WHERE label = 'miss'
);

-- 6.
SELECT is(
  public.reuse_recommendation_run(
    (
      SELECT run_id FROM cache_content_runs WHERE label = 'miss'
    ),
    1,
    900
  ),
  false,
  'different fingerprints prevent reuse'
);

-- Publish a successful code-only fallback as the newest source.
SELECT pg_temp.new_cache_content_run('fallback-source');

SELECT public.publish_recommendation_run(
  (
    SELECT run_id
    FROM cache_content_runs
    WHERE label = 'fallback-source'
  ),
  (
    SELECT jsonb_build_array(
      result || jsonb_build_object(
        'fit', NULL,
        'fit_generated_at', NULL,
        'fit_error', 'timeout',
        'summary', NULL
      )
    )
    FROM cache_content_payloads
    WHERE label = 'complete'
  )
);

SELECT pg_temp.new_cache_content_run('fallback-candidate');

-- 7. Do not fall back to an older successful AI run for caching.
SELECT is(
  public.reuse_recommendation_run(
    (
      SELECT run_id
      FROM cache_content_runs
      WHERE label = 'fallback-candidate'
    ),
    1,
    900
  ),
  false,
  'the latest code-only result requires another generation attempt'
);

-- Publish AI ratings without the requested summary.
SELECT pg_temp.new_cache_content_run('no-summary-source');

SELECT public.publish_recommendation_run(
  (
    SELECT run_id
    FROM cache_content_runs
    WHERE label = 'no-summary-source'
  ),
  (
    SELECT jsonb_build_array(
      result || jsonb_build_object('summary', NULL)
    )
    FROM cache_content_payloads
    WHERE label = 'complete'
  )
);

SELECT pg_temp.new_cache_content_run('no-summary-candidate');

-- 8.
SELECT is(
  public.reuse_recommendation_run(
    (
      SELECT run_id
      FROM cache_content_runs
      WHERE label = 'no-summary-candidate'
    ),
    1,
    900
  ),
  false,
  'missing requested summaries prevent cache reuse'
);

-- Restore a complete successful source.
SELECT pg_temp.new_cache_content_run('fresh-source');

SELECT public.publish_recommendation_run(
  (
    SELECT run_id
    FROM cache_content_runs
    WHERE label = 'fresh-source'
  ),
  (
    SELECT jsonb_build_array(result)
    FROM cache_content_payloads
    WHERE label = 'complete'
  )
);

SELECT pg_temp.new_cache_content_run('stale-candidate');

-- Change inputs after the claim was captured.
SELECT public.mark_recommendation_inputs_changed(
  'f7100000-0000-4000-8000-000000000001'
);

-- 9. Cache hits must still pass the publication guard.
SELECT throws_ok(
  $$
    SELECT public.reuse_recommendation_run(
      (
        SELECT run_id
        FROM cache_content_runs
        WHERE label = 'stale-candidate'
      ),
      1,
      900
    )
  $$,
  '22023',
  'Recommendation inputs changed during processing',
  'a cache hit cannot publish through an outdated claim'
);

RESET ROLE;

-- Deletion cascades away the historical recommendation row.
DELETE FROM public.job
WHERE id = 'f7200000-0000-4000-8000-000000000001';

SET LOCAL ROLE service_role;

SELECT pg_temp.new_cache_content_run('deleted-job-candidate');

-- 10. Historical result_count must agree with rows still present.
SELECT is(
  public.reuse_recommendation_run(
    (
      SELECT run_id
      FROM cache_content_runs
      WHERE label = 'deleted-job-candidate'
    ),
    1,
    900
  ),
  false,
  'deleted source result rows prevent cache reuse'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;