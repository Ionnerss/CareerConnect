BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(9);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    'f4100000-0000-4000-8000-000000000001',
    'recovery-expired@example.com',
    '{"full_name":"Expired Worker"}'::jsonb
  ),
  (
    'f4100000-0000-4000-8000-000000000002',
    'recovery-replaced@example.com',
    '{"full_name":"Replaced Worker"}'::jsonb
  ),
  (
    'f4100000-0000-4000-8000-000000000003',
    'recovery-no-run@example.com',
    '{"full_name":"Worker Without Run"}'::jsonb
  );

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id IN (
  'f4100000-0000-4000-8000-000000000001',
  'f4100000-0000-4000-8000-000000000002',
  'f4100000-0000-4000-8000-000000000003'
);

CREATE TEMP TABLE recovery_claims (
  label text PRIMARY KEY,
  claim_token uuid,
  claimed_revision bigint,
  lease_expires_at timestamptz
);

GRANT SELECT, INSERT ON recovery_claims TO service_role;

SET LOCAL ROLE service_role;

SELECT public.mark_recommendation_inputs_changed(
  'f4100000-0000-4000-8000-000000000001'
);

SELECT public.mark_recommendation_inputs_changed(
  'f4100000-0000-4000-8000-000000000002'
);

SELECT public.mark_recommendation_inputs_changed(
  'f4100000-0000-4000-8000-000000000003'
);

INSERT INTO recovery_claims
SELECT 'expired', claim.*
FROM public.claim_recommendation_refresh(
  'f4100000-0000-4000-8000-000000000001',
  300
) AS claim;

INSERT INTO recovery_claims
SELECT 'old', claim.*
FROM public.claim_recommendation_refresh(
  'f4100000-0000-4000-8000-000000000002',
  300
) AS claim;

INSERT INTO recovery_claims
SELECT 'no-run', claim.*
FROM public.claim_recommendation_refresh(
  'f4100000-0000-4000-8000-000000000003',
  300
) AS claim;

-- Reserve runs for the first two claims only.
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
  CASE label
    WHEN 'expired' THEN
      'f4100000-0000-4000-8000-000000000001'::uuid
    ELSE
      'f4100000-0000-4000-8000-000000000002'::uuid
  END,
  'running',
  'recovery-test-hash',
  'test-scoring-v1',
  clock_timestamp(),
  claim_token,
  claimed_revision
FROM recovery_claims
WHERE label IN ('expired', 'old');

-- Simulate expiry for all three original workers.
UPDATE public.recommendation_refresh_state
SET lease_expires_at = clock_timestamp() - interval '1 second'
WHERE user_id IN (
  'f4100000-0000-4000-8000-000000000001',
  'f4100000-0000-4000-8000-000000000002',
  'f4100000-0000-4000-8000-000000000003'
);

-- A replacement worker claims the second seeker's work.
INSERT INTO recovery_claims
SELECT 'replacement', claim.*
FROM public.claim_recommendation_refresh(
  'f4100000-0000-4000-8000-000000000002',
  300
) AS claim;

-- 1. Limit how much one sweep processes.
SELECT is(
  public.recover_recommendation_refreshes(1, 60),
  1,
  'a sweep respects its candidate limit'
);

-- 2. The next sweep processes the remaining abandoned work.
SELECT is(
  public.recover_recommendation_refreshes(100, 60),
  2,
  'the remaining expired and abandoned work is recovered'
);

-- 3. Repeated recovery does not process completed cleanup again.
SELECT is(
  public.recover_recommendation_refreshes(100, 60),
  0,
  'repeating recovery has no additional effect'
);

-- 4. Both abandoned runs are failed.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.recommendation_runs
    WHERE refresh_claim_token IN (
      SELECT claim_token
      FROM recovery_claims
      WHERE label IN ('expired', 'old')
    )
      AND status = 'failed'
      AND failure_code = 'generation_failed'
  ),
  2,
  'expired and replaced workers have failed run records'
);

-- 5. Expired work is released with a retry delay.
SELECT ok(
  (
    SELECT
      claim_token IS NULL
      AND claimed_revision IS NULL
      AND claimed_posting_revision IS NULL
      AND lease_expires_at IS NULL
      AND next_attempt_at > clock_timestamp()
      AND attempt_count = 1
    FROM public.recommendation_refresh_state
    WHERE user_id = 'f4100000-0000-4000-8000-000000000001'
  ),
  'recovery releases an expired claim without resetting its attempt count'
);

-- 6. Claims abandoned before run reservation are recovered too.
SELECT ok(
  (
    SELECT
      claim_token IS NULL
      AND next_attempt_at > clock_timestamp()
      AND attempt_count = 1
    FROM public.recommendation_refresh_state
    WHERE user_id = 'f4100000-0000-4000-8000-000000000003'
  ),
  'recovery handles an expired claim with no run'
);

-- 7. Cleanup of an old run preserves its replacement claim.
SELECT ok(
  (
    SELECT
      refresh_state.claim_token = replacement.claim_token
      AND refresh_state.lease_expires_at > clock_timestamp()
      AND refresh_state.attempt_count = 2
    FROM public.recommendation_refresh_state AS refresh_state
    CROSS JOIN recovery_claims AS replacement
    WHERE refresh_state.user_id =
      'f4100000-0000-4000-8000-000000000002'
      AND replacement.label = 'replacement'
  ),
  'recovery preserves the replacement worker claim'
);

-- 8. Invalid sweep limits are rejected.
SELECT throws_ok(
  $$
    SELECT public.recover_recommendation_refreshes(0, 60)
  $$,
  '22023',
  'Recovery limit must be between 1 and 100',
  'a zero recovery limit is rejected'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

-- 9. Browser clients cannot perform worker recovery.
SELECT throws_ok(
  $$
    SELECT public.recover_recommendation_refreshes(25, 60)
  $$,
  '42501',
  NULL,
  'browser clients cannot recover worker claims'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;