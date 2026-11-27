BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(11);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    'fe300000-0000-4000-8000-000000000001',
    'refresh-status-a@example.com',
    '{"full_name":"Refresh Status A"}'::jsonb
  ),
  (
    'fe300000-0000-4000-8000-000000000002',
    'refresh-status-b@example.com',
    '{"full_name":"Refresh Status B"}'::jsonb
  );

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id IN (
  'fe300000-0000-4000-8000-000000000001',
  'fe300000-0000-4000-8000-000000000002'
);

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"fe300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

-- 1.
SELECT is(
  public.get_recommendation_refresh_status() ->> 'status',
  'never_requested',
  'a seeker without refresh state has never requested queued work'
);

SELECT public.set_recommendation_background_refresh(true);

-- 2.
SELECT is(
  public.get_recommendation_refresh_status() ->> 'status',
  'queued',
  'enabling refresh reports queued work'
);

RESET ROLE;
SET LOCAL ROLE service_role;

SELECT *
FROM public.claim_recommendation_refresh(
  'fe300000-0000-4000-8000-000000000001',
  300
);

RESET ROLE;
SET LOCAL ROLE authenticated;

-- 3.
SELECT is(
  public.get_recommendation_refresh_status() ->> 'status',
  'running',
  'an active lease reports running work'
);

RESET ROLE;
SET LOCAL ROLE service_role;

SELECT public.fail_recommendation_refresh(
  (
    SELECT claim_token
    FROM public.recommendation_refresh_state
    WHERE user_id = 'fe300000-0000-4000-8000-000000000001'
  ),
  'generation_failed',
  60
);

RESET ROLE;
SET LOCAL ROLE authenticated;

-- 4.
SELECT is(
  public.get_recommendation_refresh_status() ->> 'status',
  'retry_wait',
  'a delayed retry reports its waiting state'
);

RESET ROLE;

UPDATE public.recommendation_refresh_state
SET attempt_count = max_attempts
WHERE user_id = 'fe300000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;

-- 5.
SELECT is(
  public.get_recommendation_refresh_status() ->> 'status',
  'failed',
  'exhausted attempts report failure'
);

RESET ROLE;

SELECT public.mark_recommendation_inputs_changed(
  'fe300000-0000-4000-8000-000000000001'
);

SET LOCAL ROLE authenticated;

-- 6.
SELECT is(
  public.get_recommendation_refresh_status() ->> 'status',
  'queued',
  'new inputs report queued work instead of the old exhausted attempt'
);

SELECT public.set_recommendation_background_refresh(false);

-- 7.
SELECT is(
  public.get_recommendation_refresh_status() ->> 'status',
  'disabled',
  'opting out reports disabled background refresh'
);

SELECT public.request_recommendation_refresh();

-- 8.
SELECT is(
  public.get_recommendation_refresh_status() ->> 'status',
  'queued',
  'an explicit manual request reports queued work after opt-out'
);

RESET ROLE;
SET LOCAL ROLE service_role;

INSERT INTO public.recommendation_runs (
  id,
  user_id,
  status,
  seeker_input_hash,
  scoring_version,
  started_at,
  refresh_claim_token,
  refresh_revision,
  content_generated_at
)
SELECT
  'fe400000-0000-4000-8000-000000000001',
  'fe300000-0000-4000-8000-000000000001',
  'running',
  'refresh-status-seeker-hash',
  'test-scoring-v1',
  clock_timestamp(),
  claim_token,
  claimed_revision,
  clock_timestamp() - interval '60 seconds'
FROM public.claim_recommendation_refresh(
  'fe300000-0000-4000-8000-000000000001',
  300
);

SELECT public.publish_recommendation_run(
  'fe400000-0000-4000-8000-000000000001',
  '[]'::jsonb
);

RESET ROLE;
SET LOCAL ROLE authenticated;

-- 9.
SELECT ok(
  (
    public.get_recommendation_refresh_status() ->> 'checked_at'
  )::timestamptz >
  (
    public.get_recommendation_refresh_status() ->> 'generated_at'
  )::timestamptz,
  'status distinguishes content generation from its latest check'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"fe300000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);

-- 10.
SELECT ok(
  public.get_recommendation_refresh_status() ->> 'status'
    = 'never_requested'
  AND public.get_recommendation_refresh_status() ->> 'generated_at'
    IS NULL,
  'another seeker cannot read the first seeker refresh state'
);

RESET ROLE;
SET LOCAL ROLE anon;

-- 11.
SELECT throws_ok(
  $$
    SELECT public.get_recommendation_refresh_status()
  $$,
  '42501',
  NULL,
  'anonymous clients cannot read refresh status'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;