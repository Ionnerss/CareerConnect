BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(15);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    'e9400000-0000-4000-8000-000000000001',
    'refresh-claims-seeker@example.com',
    '{"full_name":"Refresh Claims Seeker"}'::jsonb
  ),
  (
    'e9500000-0000-4000-8000-000000000001',
    'refresh-claims-recruiter@example.com',
    '{"full_name":"Refresh Claims Recruiter"}'::jsonb
  );

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id = 'e9400000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET role = 'recruiter'
WHERE id = 'e9500000-0000-4000-8000-000000000001';

CREATE TEMP TABLE captured_refresh_claims (
  claim_number integer PRIMARY KEY,
  claim_token uuid,
  claimed_revision bigint,
  lease_expires_at timestamptz
);

GRANT SELECT, INSERT
  ON captured_refresh_claims
  TO service_role;

SET LOCAL ROLE service_role;

-- 1. No recorded work means no claim.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.claim_recommendation_refresh(
      'e9400000-0000-4000-8000-000000000001',
      300
    )
  ),
  0,
  'no refresh state means no work is claimed'
);

SELECT public.mark_recommendation_inputs_changed(
  'e9400000-0000-4000-8000-000000000001'
);

INSERT INTO captured_refresh_claims
SELECT 1, claim.*
FROM public.claim_recommendation_refresh(
  'e9400000-0000-4000-8000-000000000001',
  300
) AS claim;

-- 2.
SELECT ok(
  (
    SELECT claim_token IS NOT NULL
    FROM captured_refresh_claims
    WHERE claim_number = 1
  ),
  'the first worker receives a claim token'
);

-- 3.
SELECT is(
  (
    SELECT claimed_revision
    FROM captured_refresh_claims
    WHERE claim_number = 1
  ),
  1::bigint,
  'the first worker claims revision 1'
);

-- 4.
SELECT ok(
  (
    SELECT lease_expires_at > clock_timestamp()
    FROM captured_refresh_claims
    WHERE claim_number = 1
  ),
  'the first claim has a future expiry'
);

-- 5.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.claim_recommendation_refresh(
      'e9400000-0000-4000-8000-000000000001',
      300
    )
  ),
  0,
  'an active lease prevents a duplicate claim'
);

-- 6.
SELECT is(
  public.mark_recommendation_inputs_changed(
    'e9400000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'an input change advances the requested revision'
);

-- 7.
SELECT ok(
  (
    SELECT
      refresh_state.claimed_revision = 1
      AND refresh_state.claim_token = first_claim.claim_token
    FROM public.recommendation_refresh_state AS refresh_state
    CROSS JOIN captured_refresh_claims AS first_claim
    WHERE refresh_state.user_id =
      'e9400000-0000-4000-8000-000000000001'
      AND first_claim.claim_number = 1
  ),
  'an input change preserves the active claim'
);

UPDATE public.recommendation_refresh_state
SET lease_expires_at = clock_timestamp() - interval '1 second'
WHERE user_id = 'e9400000-0000-4000-8000-000000000001';

INSERT INTO captured_refresh_claims
SELECT 2, claim.*
FROM public.claim_recommendation_refresh(
  'e9400000-0000-4000-8000-000000000001',
  300
) AS claim;

-- 8.
SELECT ok(
  (
    SELECT replacement.claim_token <> original.claim_token
    FROM captured_refresh_claims AS original
    CROSS JOIN captured_refresh_claims AS replacement
    WHERE original.claim_number = 1
      AND replacement.claim_number = 2
  ),
  'an expired claim is replaced with a different token'
);

-- 9.
SELECT is(
  (
    SELECT claimed_revision
    FROM captured_refresh_claims
    WHERE claim_number = 2
  ),
  2::bigint,
  'the replacement worker claims revision 2'
);

-- Simulate completion of both input snapshots.
UPDATE public.recommendation_refresh_state
SET completed_revision = requested_revision,
    completed_posting_revision = claimed_posting_revision,
    claim_token = NULL,
    claimed_revision = NULL,
    claimed_posting_revision = NULL,
    lease_expires_at = NULL
WHERE user_id = 'e9400000-0000-4000-8000-000000000001';

-- 10.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.claim_recommendation_refresh(
      'e9400000-0000-4000-8000-000000000001',
      300
    )
  ),
  0,
  'a completed revision cannot be claimed again'
);

-- 11.
SELECT throws_ok(
  $$
    SELECT public.claim_recommendation_refresh(
      'e9500000-0000-4000-8000-000000000001',
      300
    )
  $$,
  '22023',
  'Refresh owner must be an existing job seeker',
  'a recruiter cannot claim refresh work'
);

-- 12.
SELECT throws_ok(
  $$
    SELECT public.claim_recommendation_refresh(
      'e9600000-0000-4000-8000-000000000001',
      300
    )
  $$,
  '22023',
  'Refresh owner must be an existing job seeker',
  'a missing account cannot claim refresh work'
);

-- 13.
SELECT throws_ok(
  $$
    SELECT public.claim_recommendation_refresh(
      'e9400000-0000-4000-8000-000000000001',
      0
    )
  $$,
  '22023',
  'Lease duration must be between 1 and 3600 seconds',
  'a zero-length lease is rejected'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e9400000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

-- 14.
SELECT throws_ok(
  $$
    SELECT public.claim_recommendation_refresh(
      'e9400000-0000-4000-8000-000000000001',
      300
    )
  $$,
  '42501',
  NULL,
  'authenticated clients cannot claim refresh work'
);

RESET ROLE;
SET LOCAL ROLE anon;

-- 15.
SELECT throws_ok(
  $$
    SELECT public.claim_recommendation_refresh(
      'e9400000-0000-4000-8000-000000000001',
      300
    )
  $$,
  '42501',
  NULL,
  'anonymous clients cannot claim refresh work'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;