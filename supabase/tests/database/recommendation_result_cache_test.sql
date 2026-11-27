BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(6);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  'f6100000-0000-4000-8000-000000000001',
  'result-cache-seeker@example.com',
  '{"full_name":"Result Cache Seeker"}'::jsonb
);

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id = 'f6100000-0000-4000-8000-000000000001';

SET LOCAL ROLE service_role;

SELECT public.mark_recommendation_inputs_changed(
  'f6100000-0000-4000-8000-000000000001'
);

INSERT INTO public.recommendation_runs (
  id,
  user_id,
  status,
  seeker_input_hash,
  scoring_version,
  started_at,
  created_at,
  refresh_claim_token,
  refresh_revision,
  input_fingerprint
)
SELECT
  'f6200000-0000-4000-8000-000000000001',
  'f6100000-0000-4000-8000-000000000001',
  'running',
  'cache-test-seeker-hash',
  'test-scoring-v1',
  clock_timestamp(),
  '2026-11-01 10:00:00+00',
  claim_token,
  claimed_revision,
  repeat('a', 64)
FROM public.claim_recommendation_refresh(
  'f6100000-0000-4000-8000-000000000001',
  300
);

SELECT public.publish_recommendation_run(
  'f6200000-0000-4000-8000-000000000001',
  '[]'::jsonb
);

-- Simulate a new source event with unchanged normalized inputs.
SELECT public.mark_recommendation_inputs_changed(
  'f6100000-0000-4000-8000-000000000001'
);

INSERT INTO public.recommendation_runs (
  id,
  user_id,
  status,
  seeker_input_hash,
  scoring_version,
  started_at,
  created_at,
  refresh_claim_token,
  refresh_revision,
  input_fingerprint
)
SELECT
  'f6200000-0000-4000-8000-000000000002',
  'f6100000-0000-4000-8000-000000000001',
  'running',
  'cache-test-seeker-hash',
  'test-scoring-v1',
  clock_timestamp(),
  '2026-11-01 10:01:00+00',
  claim_token,
  claimed_revision,
  repeat('a', 64)
FROM public.claim_recommendation_refresh(
  'f6100000-0000-4000-8000-000000000001',
  300
);

-- 1.
SELECT is(
  public.reuse_recommendation_run(
    'f6200000-0000-4000-8000-000000000002',
    0,
    900
  ),
  true,
  'matching unchanged inputs reuse a successful empty result'
);

-- 2.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.recommendation_runs
    WHERE id = 'f6200000-0000-4000-8000-000000000002'
      AND status = 'succeeded'
      AND result_count = 0
  )
  AND EXISTS (
    SELECT 1
    FROM public.recommendation_refresh_state
    WHERE user_id = 'f6100000-0000-4000-8000-000000000001'
      AND completed_revision = 2
      AND claim_token IS NULL
  ),
  'cache publication succeeds and completes its claim'
);

-- 3.
SELECT is(
  (
    SELECT content_generated_at
    FROM public.recommendation_runs
    WHERE id = 'f6200000-0000-4000-8000-000000000002'
  ),
  (
    SELECT completed_at
    FROM public.recommendation_runs
    WHERE id = 'f6200000-0000-4000-8000-000000000001'
  ),
  'cache reuse preserves the original generation time'
);

SELECT public.mark_recommendation_inputs_changed(
  'f6100000-0000-4000-8000-000000000001'
);

INSERT INTO public.recommendation_runs (
  id,
  user_id,
  status,
  seeker_input_hash,
  scoring_version,
  started_at,
  created_at,
  refresh_claim_token,
  refresh_revision,
  input_fingerprint
)
SELECT
  'f6200000-0000-4000-8000-000000000003',
  'f6100000-0000-4000-8000-000000000001',
  'running',
  'cache-test-seeker-hash',
  'test-scoring-v1',
  clock_timestamp(),
  '2026-11-01 10:02:00+00',
  claim_token,
  claimed_revision,
  repeat('b', 64)
FROM public.claim_recommendation_refresh(
  'f6100000-0000-4000-8000-000000000001',
  300
);

-- 4.
SELECT is(
  public.reuse_recommendation_run(
    'f6200000-0000-4000-8000-000000000003',
    0,
    900
  ),
  false,
  'a different fingerprint requires generation'
);

-- 5.
SELECT is(
  (
    SELECT status
    FROM public.recommendation_runs
    WHERE id = 'f6200000-0000-4000-8000-000000000003'
  ),
  'running',
  'a cache miss leaves the run available for generation'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

-- 6.
SELECT throws_ok(
  $$
    SELECT public.reuse_recommendation_run(
      'f6200000-0000-4000-8000-000000000003',
      0,
      900
    )
  $$,
  '42501',
  NULL,
  'browser clients cannot invoke cache publication'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;