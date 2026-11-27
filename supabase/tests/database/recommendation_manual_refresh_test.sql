BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(11);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  'fd100000-0000-4000-8000-000000000001',
  'manual-refresh-seeker@example.com',
  '{"full_name":"Manual Refresh Seeker"}'::jsonb
);

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id = 'fd100000-0000-4000-8000-000000000001';

CREATE TEMP TABLE manual_refresh_claim (
  claim_token uuid,
  claimed_revision bigint,
  lease_expires_at timestamptz
);

GRANT SELECT, INSERT ON manual_refresh_claim TO service_role;

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"fd100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

-- Explicitly disable background refresh.
SELECT public.set_recommendation_background_refresh(false);

-- 1. Manual requests remain available.
SELECT is(
  public.request_recommendation_refresh(),
  'queued',
  'a seeker can request refresh with background refresh disabled'
);

RESET ROLE;

-- 2. The request is pending without enabling background processing.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.recommendation_refresh_state
    WHERE user_id = 'fd100000-0000-4000-8000-000000000001'
      AND manual_refresh_pending = true
      AND requested_revision = 1
  )
  AND EXISTS (
    SELECT 1
    FROM public.recommendation_refresh_preferences
    WHERE user_id = 'fd100000-0000-4000-8000-000000000001'
      AND enabled = false
  ),
  'manual refresh queues work without enabling background refresh'
);

SET LOCAL ROLE authenticated;

-- 3.
SELECT is(
  public.request_recommendation_refresh(),
  'already_pending',
  'a repeated request joins pending work'
);

RESET ROLE;

-- 4.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'fd100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'duplicate requests preserve the requested revision'
);

SET LOCAL ROLE service_role;

-- 5. The batch selector includes the explicit manual request.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.list_due_recommendation_refreshes(25)
    WHERE user_id = 'fd100000-0000-4000-8000-000000000001'
  ),
  1,
  'manual work is selected despite background opt-out'
);

INSERT INTO manual_refresh_claim
SELECT *
FROM public.claim_recommendation_refresh(
  'fd100000-0000-4000-8000-000000000001',
  300
);

-- 6.
SELECT is(
  (SELECT count(*)::integer FROM manual_refresh_claim),
  1,
  'the worker can claim the manual request'
);

INSERT INTO public.recommendation_runs (
  id,
  user_id,
  status,
  seeker_input_hash,
  scoring_version,
  started_at,
  refresh_claim_token,
  refresh_revision
)
SELECT
  'fd200000-0000-4000-8000-000000000001',
  'fd100000-0000-4000-8000-000000000001',
  'running',
  'manual-refresh-seeker-hash',
  'test-scoring-v1',
  clock_timestamp(),
  claim_token,
  claimed_revision
FROM manual_refresh_claim;

-- 7.
SELECT is(
  public.publish_recommendation_run(
    'fd200000-0000-4000-8000-000000000001',
    '[]'::jsonb
  ),
  'fd200000-0000-4000-8000-000000000001'::uuid,
  'the manual run publishes successfully'
);

-- 8.
SELECT ok(
  (
    SELECT
      manual_refresh_pending = false
      AND completed_revision = requested_revision
      AND claim_token IS NULL
    FROM public.recommendation_refresh_state
    WHERE user_id = 'fd100000-0000-4000-8000-000000000001'
  ),
  'publication completes and clears the manual request'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

-- 9.
SELECT is(
  public.request_recommendation_refresh(),
  'rate_limited',
  'the cooldown prevents an immediate new refresh'
);

RESET ROLE;

UPDATE public.recommendation_refresh_state
SET last_manual_refresh_at =
  clock_timestamp() - interval '61 seconds'
WHERE user_id = 'fd100000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;

-- 10.
SELECT is(
  public.request_recommendation_refresh(),
  'queued',
  'a new refresh can be requested after the cooldown'
);

RESET ROLE;
SET LOCAL ROLE anon;

-- 11.
SELECT throws_ok(
  $$
    SELECT public.request_recommendation_refresh()
  $$,
  '42501',
  NULL,
  'anonymous clients cannot request refresh work'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;