BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(14);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    'f8100000-0000-4000-8000-000000000001',
    'refresh-participation-a@example.com',
    '{"full_name":"Refresh Participation A"}'::jsonb
  ),
  (
    'f8100000-0000-4000-8000-000000000002',
    'refresh-participation-b@example.com',
    '{"full_name":"Refresh Participation B"}'::jsonb
  );

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id IN (
  'f8100000-0000-4000-8000-000000000001',
  'f8100000-0000-4000-8000-000000000002'
);

-- B has pending work but has never opted in.
SELECT public.mark_recommendation_inputs_changed(
  'f8100000-0000-4000-8000-000000000002'
);

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f8100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

-- 1.
SELECT is(
  public.set_recommendation_background_refresh(true),
  true,
  'a seeker can enable background refresh'
);

-- 2.
SELECT is(
  (
    SELECT enabled
    FROM public.recommendation_refresh_preferences
    WHERE user_id = 'f8100000-0000-4000-8000-000000000001'
  ),
  true,
  'the seeker can read their enabled preference'
);

RESET ROLE;

-- 3.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'f8100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'enabling refresh creates pending work'
);

SET LOCAL ROLE authenticated;

SELECT public.set_recommendation_background_refresh(true);

RESET ROLE;

-- 4.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'f8100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'saving the same enabled preference preserves the revision'
);

SET LOCAL ROLE service_role;

-- 5.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.list_due_recommendation_refreshes(25)
    WHERE user_id IN (
      'f8100000-0000-4000-8000-000000000001',
      'f8100000-0000-4000-8000-000000000002'
    )
  ),
  1,
  'only the opted-in seeker is selected'
);

SELECT *
FROM public.claim_recommendation_refresh(
  'f8100000-0000-4000-8000-000000000001',
  300
);

-- 6.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.list_due_recommendation_refreshes(25)
    WHERE user_id = 'f8100000-0000-4000-8000-000000000001'
  ),
  0,
  'an active lease removes the seeker from due work'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

-- 7.
SELECT is(
  public.set_recommendation_background_refresh(false),
  false,
  'a seeker can disable background refresh'
);

RESET ROLE;

-- 8.
SELECT ok(
  (
    SELECT
      requested_revision = 2
      AND claim_token IS NULL
      AND claimed_revision IS NULL
      AND claimed_posting_revision IS NULL
      AND lease_expires_at IS NULL
    FROM public.recommendation_refresh_state
    WHERE user_id = 'f8100000-0000-4000-8000-000000000001'
  ),
  'disabling refresh invalidates and releases the active claim'
);

SET LOCAL ROLE service_role;

-- 9.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.list_due_recommendation_refreshes(25)
    WHERE user_id = 'f8100000-0000-4000-8000-000000000001'
  ),
  0,
  'disabled seekers are excluded from due work'
);

-- 10.
SELECT throws_ok(
  $$
    SELECT public.claim_recommendation_refresh(
      'f8100000-0000-4000-8000-000000000001',
      300
    )
  $$,
  '22023',
  'Background recommendation refresh is disabled',
  'an explicitly disabled seeker cannot receive a new claim'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

SELECT public.set_recommendation_background_refresh(true);

RESET ROLE;

-- 11.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'f8100000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'reenabling refresh requests a new revision'
);

SET LOCAL ROLE service_role;

-- 12.
SELECT throws_ok(
  $$
    SELECT public.list_due_recommendation_refreshes(0)
  $$,
  '22023',
  'Refresh batch limit must be between 1 and 100',
  'invalid batch limits are rejected'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

-- 13.
SELECT throws_ok(
  $$
    UPDATE public.recommendation_refresh_preferences
    SET enabled = false
    WHERE user_id = 'f8100000-0000-4000-8000-000000000002'
  $$,
  '42501',
  NULL,
  'clients cannot directly modify refresh preferences'
);

RESET ROLE;
SET LOCAL ROLE anon;

-- 14.
SELECT throws_ok(
  $$
    SELECT public.set_recommendation_background_refresh(true)
  $$,
  '42501',
  NULL,
  'anonymous clients cannot enable background refresh'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;