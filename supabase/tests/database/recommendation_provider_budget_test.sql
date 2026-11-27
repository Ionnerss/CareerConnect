BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(11);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    'fa100000-0000-4000-8000-000000000001',
    'provider-budget-a@example.com',
    '{"full_name":"Provider Budget A"}'::jsonb
  ),
  (
    'fa100000-0000-4000-8000-000000000002',
    'provider-budget-b@example.com',
    '{"full_name":"Provider Budget B"}'::jsonb
  );

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id IN (
  'fa100000-0000-4000-8000-000000000001',
  'fa100000-0000-4000-8000-000000000002'
);

CREATE TEMP TABLE provider_budget_tokens (
  label text PRIMARY KEY,
  token uuid
);

GRANT SELECT, INSERT ON provider_budget_tokens TO service_role;

SET LOCAL ROLE service_role;

-- 1. New policies start disabled.
SELECT is(
  public.reserve_recommendation_provider_call(
    'fa100000-0000-4000-8000-000000000001',
    'jev',
    60
  ),
  NULL::uuid,
  'a disabled provider grants no reservation'
);

RESET ROLE;

-- Test-only configuration, rolled back at the end.
UPDATE public.recommendation_provider_policies
SET enabled = true,
    daily_call_limit = 2,
    user_daily_call_limit = 1,
    concurrent_call_limit = 1
WHERE provider = 'jev';

SET LOCAL ROLE service_role;

INSERT INTO provider_budget_tokens (label, token)
VALUES (
  'a',
  public.reserve_recommendation_provider_call(
    'fa100000-0000-4000-8000-000000000001',
    'jev',
    60
  )
);

-- 2.
SELECT ok(
  (
    SELECT token IS NOT NULL
    FROM provider_budget_tokens
    WHERE label = 'a'
  ),
  'an eligible seeker receives a provider reservation'
);

-- 3. A holds the only concurrent slot.
SELECT is(
  public.reserve_recommendation_provider_call(
    'fa100000-0000-4000-8000-000000000002',
    'jev',
    60
  ),
  NULL::uuid,
  'the concurrent call limit blocks another reservation'
);

-- 4.
SELECT is(
  public.release_recommendation_provider_call(
    (SELECT token FROM provider_budget_tokens WHERE label = 'a')
  ),
  true,
  'releasing a reservation frees its concurrent slot'
);

-- 5. Releasing capacity does not refund A's daily allowance.
SELECT is(
  public.reserve_recommendation_provider_call(
    'fa100000-0000-4000-8000-000000000001',
    'jev',
    60
  ),
  NULL::uuid,
  'the per-user daily limit remains enforced after release'
);

INSERT INTO provider_budget_tokens (label, token)
VALUES (
  'b',
  public.reserve_recommendation_provider_call(
    'fa100000-0000-4000-8000-000000000002',
    'jev',
    60
  )
);

-- 6.
SELECT ok(
  (
    SELECT token IS NOT NULL
    FROM provider_budget_tokens
    WHERE label = 'b'
  ),
  'another seeker can use the remaining global allowance'
);

-- 7.
SELECT is(
  public.release_recommendation_provider_call(
    (SELECT token FROM provider_budget_tokens WHERE label = 'b')
  ),
  true,
  'the second reservation can be released'
);

RESET ROLE;

-- Remove the per-user restriction as the reason for the next rejection.
UPDATE public.recommendation_provider_policies
SET user_daily_call_limit = 10
WHERE provider = 'jev';

SET LOCAL ROLE service_role;

-- 8. Global allowance has already been consumed.
SELECT is(
  public.reserve_recommendation_provider_call(
    'fa100000-0000-4000-8000-000000000001',
    'jev',
    60
  ),
  NULL::uuid,
  'the global daily limit blocks further reservations'
);

-- 9. Rejected requests must not consume additional allowance.
SELECT is(
  (
    SELECT calls
    FROM public.recommendation_provider_daily_usage
    WHERE provider = 'jev'
      AND usage_day = (clock_timestamp() AT TIME ZONE 'UTC')::date
  ),
  2,
  'only granted reservations consume the daily allowance'
);

-- 10.
SELECT is(
  public.release_recommendation_provider_call(
    (SELECT token FROM provider_budget_tokens WHERE label = 'b')
  ),
  false,
  'releasing the same token again has no effect'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

-- 11.
SELECT throws_ok(
  $$
    SELECT public.reserve_recommendation_provider_call(
      'fa100000-0000-4000-8000-000000000001',
      'jev',
      60
    )
  $$,
  '42501',
  NULL,
  'browser clients cannot reserve provider capacity'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;