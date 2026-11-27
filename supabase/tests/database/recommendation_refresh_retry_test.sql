BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(12);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  'f2100000-0000-4000-8000-000000000001',
  'refresh-retry-seeker@example.com',
  '{"full_name":"Refresh Retry Seeker"}'::jsonb
);

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id = 'f2100000-0000-4000-8000-000000000001';

CREATE TEMP TABLE retry_claims (
  attempt integer PRIMARY KEY,
  claim_token uuid,
  claimed_revision bigint,
  lease_expires_at timestamptz
);

GRANT SELECT, INSERT ON retry_claims TO service_role;

SET LOCAL ROLE service_role;

SELECT public.mark_recommendation_inputs_changed(
  'f2100000-0000-4000-8000-000000000001'
);

INSERT INTO retry_claims
SELECT 1, claim.*
FROM public.claim_recommendation_refresh(
  'f2100000-0000-4000-8000-000000000001',
  300
) AS claim;

-- 1.
SELECT is(
  (SELECT count(*)::integer FROM retry_claims WHERE attempt = 1),
  1,
  'the first attempt receives a claim'
);

-- 2.
SELECT is(
  (
    SELECT attempt_count
    FROM public.recommendation_refresh_state
    WHERE user_id = 'f2100000-0000-4000-8000-000000000001'
  ),
  1,
  'issuing the first claim consumes one attempt'
);

-- Create its running run so failure handling exercises both tables.
INSERT INTO public.recommendation_runs (
  user_id,
  status,
  seeker_input_hash,
  scoring_version,
  started_at,
  refresh_claim_token,
  refresh_revision
)
SELECT
  'f2100000-0000-4000-8000-000000000001',
  'running',
  'retry-test-seeker-hash',
  'test-scoring-v1',
  clock_timestamp(),
  claim_token,
  claimed_revision
FROM retry_claims
WHERE attempt = 1;

-- Perform the state change before querying its effects.
DO $test$
DECLARE
  v_released boolean;
BEGIN
  v_released := public.fail_recommendation_refresh(
    (SELECT claim_token FROM retry_claims WHERE attempt = 1),
    'generation_failed',
    60
  );

  IF v_released IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected the current claim to be released';
  END IF;
END;
$test$;

-- 3. Verify the run and refresh state after the function completes.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.recommendation_runs
    WHERE refresh_claim_token = (
      SELECT claim_token
      FROM retry_claims
      WHERE attempt = 1
    )
      AND status = 'failed'
      AND failure_code = 'generation_failed'
  )
  AND EXISTS (
    SELECT 1
    FROM public.recommendation_refresh_state
    WHERE user_id = 'f2100000-0000-4000-8000-000000000001'
      AND claim_token IS NULL
      AND claimed_revision IS NULL
      AND claimed_posting_revision IS NULL
      AND lease_expires_at IS NULL
      AND last_failure_code = 'generation_failed'
      AND next_attempt_at > clock_timestamp()
  ),
  'failure releases the claim, schedules a retry, and marks its run failed'
);

-- 4.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.claim_recommendation_refresh(
      'f2100000-0000-4000-8000-000000000001',
      300
    )
  ),
  0,
  'the retry delay blocks an immediate new claim'
);

UPDATE public.recommendation_refresh_state
SET next_attempt_at = clock_timestamp() - interval '1 second'
WHERE user_id = 'f2100000-0000-4000-8000-000000000001';

INSERT INTO retry_claims
SELECT 2, claim.*
FROM public.claim_recommendation_refresh(
  'f2100000-0000-4000-8000-000000000001',
  300
) AS claim;

-- 5.
SELECT is(
  (SELECT count(*)::integer FROM retry_claims WHERE attempt = 2),
  1,
  'the next attempt can claim after the delay'
);

-- 6.
SELECT is(
  public.fail_recommendation_refresh(
    (SELECT claim_token FROM retry_claims WHERE attempt = 1),
    'generation_failed',
    60
  ),
  false,
  'an old token cannot release the replacement claim'
);

-- 7.
SELECT ok(
  public.fail_recommendation_refresh(
    (SELECT claim_token FROM retry_claims WHERE attempt = 2),
    'generation_failed',
    120
  ),
  'the second attempt can report its own failure'
);

UPDATE public.recommendation_refresh_state
SET next_attempt_at = clock_timestamp() - interval '1 second'
WHERE user_id = 'f2100000-0000-4000-8000-000000000001';

INSERT INTO retry_claims
SELECT 3, claim.*
FROM public.claim_recommendation_refresh(
  'f2100000-0000-4000-8000-000000000001',
  300
) AS claim;

-- 8.
SELECT ok(
  public.fail_recommendation_refresh(
    (SELECT claim_token FROM retry_claims WHERE attempt = 3),
    'generation_failed',
    240
  ),
  'the third attempt can report its own failure'
);

UPDATE public.recommendation_refresh_state
SET next_attempt_at = clock_timestamp() - interval '1 second'
WHERE user_id = 'f2100000-0000-4000-8000-000000000001';

-- 9.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.claim_recommendation_refresh(
      'f2100000-0000-4000-8000-000000000001',
      300
    )
  ),
  0,
  'the attempt limit blocks further retries of unchanged inputs'
);

SELECT public.mark_recommendation_inputs_changed(
  'f2100000-0000-4000-8000-000000000001'
);

INSERT INTO retry_claims
SELECT 4, claim.*
FROM public.claim_recommendation_refresh(
  'f2100000-0000-4000-8000-000000000001',
  300
) AS claim;

-- 10.
SELECT is(
  (SELECT count(*)::integer FROM retry_claims WHERE attempt = 4),
  1,
  'new inputs receive a fresh attempt allowance'
);

-- 11.
SELECT is(
  (
    SELECT attempt_count
    FROM public.recommendation_refresh_state
    WHERE user_id = 'f2100000-0000-4000-8000-000000000001'
  ),
  1,
  'the attempt counter resets for new inputs'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

-- 12.
SELECT throws_ok(
  $$
    SELECT public.fail_recommendation_refresh(
      'f2200000-0000-4000-8000-000000000001',
      'generation_failed',
      60
    )
  $$,
  '42501',
  NULL,
  'browser clients cannot release worker claims'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;