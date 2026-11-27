BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(8);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    'ee100000-0000-4000-8000-000000000001',
    'posting-claim-seeker@example.com',
    '{"full_name":"Posting Claim Seeker"}'::jsonb
  ),
  (
    'ee200000-0000-4000-8000-000000000001',
    'posting-claim-recruiter@example.com',
    '{"full_name":"Posting Claim Recruiter"}'::jsonb
  );

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id = 'ee100000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET role = 'recruiter'
WHERE id = 'ee200000-0000-4000-8000-000000000001';

CREATE TEMP TABLE posting_claims (
  attempt integer PRIMARY KEY,
  claim_token uuid,
  claimed_revision bigint,
  lease_expires_at timestamptz
);

GRANT SELECT, INSERT ON posting_claims TO service_role;

SET LOCAL ROLE service_role;

SELECT public.mark_recommendation_inputs_changed(
  'ee100000-0000-4000-8000-000000000001'
);

INSERT INTO posting_claims
SELECT 1, claim.*
FROM public.claim_recommendation_refresh(
  'ee100000-0000-4000-8000-000000000001',
  300
) AS claim;

-- 1. Claiming captures the current posting revision.
SELECT is(
  (
    SELECT claimed_posting_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ee100000-0000-4000-8000-000000000001'
  ),
  (
    SELECT revision
    FROM public.recommendation_posting_state
    WHERE singleton = true
  ),
  'the claim captures the current posting revision'
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
  'ee400000-0000-4000-8000-000000000001',
  'ee100000-0000-4000-8000-000000000001',
  'running',
  'posting-claim-seeker-hash',
  'test-scoring-v1',
  clock_timestamp(),
  '2026-11-01 10:00:00+00',
  claim_token,
  claimed_revision
FROM posting_claims
WHERE attempt = 1;

RESET ROLE;

-- A new posting appears during generation.
INSERT INTO public.job (
  id,
  recruiter_id,
  title,
  description,
  location,
  status
)
VALUES (
  'ee300000-0000-4000-8000-000000000001',
  'ee200000-0000-4000-8000-000000000001',
  'Posting Claim Test Job',
  'A posting added during generation.',
  'Montreal',
  'open'
);

SET LOCAL ROLE service_role;

-- 2. The old snapshot must not publish.
SELECT throws_ok(
  $$
    SELECT public.publish_recommendation_run(
      'ee400000-0000-4000-8000-000000000001',
      '[]'::jsonb
    )
  $$,
  '22023',
  'Recommendation postings changed during processing',
  'a posting change rejects outdated publication'
);

-- 3. Rejected publication does not complete the work.
SELECT ok(
  (
    SELECT
      completed_revision = 0
      AND completed_posting_revision = -1
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ee100000-0000-4000-8000-000000000001'
  ),
  'rejected publication leaves both revisions incomplete'
);

-- Simulate expiry and replacement of the outdated worker.
UPDATE public.recommendation_refresh_state
SET lease_expires_at = clock_timestamp() - interval '1 second'
WHERE user_id = 'ee100000-0000-4000-8000-000000000001';

INSERT INTO posting_claims
SELECT 2, claim.*
FROM public.claim_recommendation_refresh(
  'ee100000-0000-4000-8000-000000000001',
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
  'ee400000-0000-4000-8000-000000000002',
  'ee100000-0000-4000-8000-000000000001',
  'running',
  'posting-claim-seeker-hash',
  'test-scoring-v1',
  clock_timestamp(),
  '2026-11-01 10:01:00+00',
  claim_token,
  claimed_revision
FROM posting_claims
WHERE attempt = 2;

-- 4. The replacement worker can publish its current snapshot.
SELECT is(
  public.publish_recommendation_run(
    'ee400000-0000-4000-8000-000000000002',
    '[]'::jsonb
  ),
  'ee400000-0000-4000-8000-000000000002'::uuid,
  'the worker with the current posting snapshot can publish'
);

-- 5. Success acknowledges the posting revision and releases the claim.
SELECT ok(
  (
    SELECT
      refresh_state.completed_posting_revision = posting_state.revision
      AND refresh_state.completed_revision =
        refresh_state.requested_revision
      AND refresh_state.claim_token IS NULL
      AND refresh_state.claimed_posting_revision IS NULL
    FROM public.recommendation_refresh_state AS refresh_state
    CROSS JOIN public.recommendation_posting_state AS posting_state
    WHERE refresh_state.user_id =
      'ee100000-0000-4000-8000-000000000001'
      AND posting_state.singleton = true
  ),
  'publication completes both revisions and clears the claim'
);

-- 6. Unchanged inputs have no pending work.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.claim_recommendation_refresh(
      'ee100000-0000-4000-8000-000000000001',
      300
    )
  ),
  0,
  'completed unchanged inputs cannot be claimed again'
);

RESET ROLE;

UPDATE public.job
SET description = 'The posting requirements have changed.'
WHERE id = 'ee300000-0000-4000-8000-000000000001';

SET LOCAL ROLE service_role;

INSERT INTO posting_claims
SELECT 3, claim.*
FROM public.claim_recommendation_refresh(
  'ee100000-0000-4000-8000-000000000001',
  300
) AS claim;

-- 7. A posting change alone creates claimable work.
SELECT is(
  (
    SELECT count(*)::integer
    FROM posting_claims
    WHERE attempt = 3
  ),
  1,
  'a posting change permits a new claim without a profile change'
);

-- 8. The new claim keeps the same seeker revision.
SELECT is(
  (
    SELECT claimed_revision
    FROM posting_claims
    WHERE attempt = 3
  ),
  1::bigint,
  'posting changes do not artificially increment the seeker revision'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;