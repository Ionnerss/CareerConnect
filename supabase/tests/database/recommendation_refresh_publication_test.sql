BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(10);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  'e9700000-0000-4000-8000-000000000001',
  'refresh-publication-seeker@example.com',
  '{"full_name":"Refresh Publication Seeker"}'::jsonb
);

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id = 'e9700000-0000-4000-8000-000000000001';

CREATE TEMP TABLE captured_publication_claims (
  claim_number integer PRIMARY KEY,
  claim_token uuid,
  claimed_revision bigint,
  lease_expires_at timestamptz
);

GRANT SELECT, INSERT
  ON captured_publication_claims
  TO service_role;

SET LOCAL ROLE service_role;

-- Establish a previous successful result that stale work must preserve.
INSERT INTO public.recommendation_runs (
  id,
  user_id,
  status,
  seeker_input_hash,
  scoring_version,
  started_at,
  created_at
)
VALUES (
  'e9800000-0000-4000-8000-000000000001',
  'e9700000-0000-4000-8000-000000000001',
  'running',
  'baseline-seeker-hash',
  'test-scoring-v1',
  clock_timestamp(),
  '2026-11-01 10:00:00+00'
);

SELECT public.publish_recommendation_run(
  'e9800000-0000-4000-8000-000000000001',
  '[]'::jsonb
);

SELECT public.mark_recommendation_inputs_changed(
  'e9700000-0000-4000-8000-000000000001'
);

INSERT INTO captured_publication_claims
SELECT 1, claim.*
FROM public.claim_recommendation_refresh(
  'e9700000-0000-4000-8000-000000000001',
  300
) AS claim;

INSERT INTO public.recommendation_runs (
  id,
  user_id,
  status,
  seeker_input_hash,
  scoring_version,
  started_at,
  created_at,
  refresh_claim_token,
  refresh_revision
)
SELECT
  'e9800000-0000-4000-8000-000000000002',
  'e9700000-0000-4000-8000-000000000001',
  'running',
  'revision-1-seeker-hash',
  'test-scoring-v1',
  clock_timestamp(),
  '2026-11-01 10:01:00+00',
  claim_token,
  claimed_revision
FROM captured_publication_claims
WHERE claim_number = 1;

-- Inputs change while the first worker is processing revision 1.
SELECT public.mark_recommendation_inputs_changed(
  'e9700000-0000-4000-8000-000000000001'
);

-- 1. Revision 1 must not publish after revision 2 is requested.
SELECT throws_ok(
  $$
    SELECT public.publish_recommendation_run(
      'e9800000-0000-4000-8000-000000000002',
      '[]'::jsonb
    )
  $$,
  '22023',
  'Recommendation inputs changed during processing',
  'a profile change prevents outdated publication'
);

-- 2. Failed publication leaves its run unsuccessful.
SELECT is(
  (
    SELECT status
    FROM public.recommendation_runs
    WHERE id = 'e9800000-0000-4000-8000-000000000002'
  ),
  'running',
  'the outdated run did not become successful'
);

-- 3. The previous success remains current.
SELECT is(
  (
    SELECT id
    FROM public.recommendation_runs
    WHERE user_id = 'e9700000-0000-4000-8000-000000000001'
      AND status = 'succeeded'
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  ),
  'e9800000-0000-4000-8000-000000000001'::uuid,
  'the previous successful run remains available'
);

-- 4. The new revision remains pending and completion did not advance.
SELECT ok(
  (
    SELECT requested_revision = 2 AND completed_revision = 0
    FROM public.recommendation_refresh_state
    WHERE user_id = 'e9700000-0000-4000-8000-000000000001'
  ),
  'the latest requested revision remains pending'
);

-- Expire the old claim and let a replacement worker claim revision 2.
UPDATE public.recommendation_refresh_state
SET lease_expires_at = clock_timestamp() - interval '1 second'
WHERE user_id = 'e9700000-0000-4000-8000-000000000001';

INSERT INTO captured_publication_claims
SELECT 2, claim.*
FROM public.claim_recommendation_refresh(
  'e9700000-0000-4000-8000-000000000001',
  300
) AS claim;

-- 5. The old token cannot publish after ownership changes.
SELECT throws_ok(
  $$
    SELECT public.publish_recommendation_run(
      'e9800000-0000-4000-8000-000000000002',
      '[]'::jsonb
    )
  $$,
  '22023',
  'Refresh claim is no longer owned by this run',
  'a replaced worker cannot publish with its old token'
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
  refresh_revision
)
SELECT
  'e9800000-0000-4000-8000-000000000003',
  'e9700000-0000-4000-8000-000000000001',
  'running',
  'revision-2-seeker-hash',
  'test-scoring-v1',
  clock_timestamp(),
  '2026-11-01 10:02:00+00',
  claim_token,
  claimed_revision
FROM captured_publication_claims
WHERE claim_number = 2;

-- Expire the replacement claim to test publication's expiry check.
UPDATE public.recommendation_refresh_state
SET lease_expires_at = clock_timestamp() - interval '1 second'
WHERE user_id = 'e9700000-0000-4000-8000-000000000001';

-- 6. Matching token and revision still require a valid lease.
SELECT throws_ok(
  $$
    SELECT public.publish_recommendation_run(
      'e9800000-0000-4000-8000-000000000003',
      '[]'::jsonb
    )
  $$,
  '22023',
  'Refresh claim has expired',
  'an expired worker cannot publish'
);

-- Restore the lease as test setup for the valid publication case.
UPDATE public.recommendation_refresh_state
SET lease_expires_at = clock_timestamp() + interval '5 minutes'
WHERE user_id = 'e9700000-0000-4000-8000-000000000001';

-- 7. A current, owned, unexpired run can publish.
SELECT is(
  public.publish_recommendation_run(
    'e9800000-0000-4000-8000-000000000003',
    '[]'::jsonb
  ),
  'e9800000-0000-4000-8000-000000000003'::uuid,
  'the current worker publishes successfully'
);

-- 8. Publication completes the processed revision.
SELECT is(
  (
    SELECT completed_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'e9700000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'successful publication completes revision 2'
);

-- 9. Publication releases all claim fields.
SELECT ok(
  (
    SELECT
      claim_token IS NULL
      AND claimed_revision IS NULL
      AND lease_expires_at IS NULL
    FROM public.recommendation_refresh_state
    WHERE user_id = 'e9700000-0000-4000-8000-000000000001'
  ),
  'successful publication clears the claim'
);

-- 10. Completed work cannot immediately be claimed again.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.claim_recommendation_refresh(
      'e9700000-0000-4000-8000-000000000001',
      300
    )
  ),
  0,
  'the completed revision has no pending work'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;