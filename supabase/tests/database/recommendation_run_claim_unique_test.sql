BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(3);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  'f1100000-0000-4000-8000-000000000001',
  'unique-run-claim@example.com',
  '{"full_name":"Unique Run Claim"}'::jsonb
);

SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$
    INSERT INTO public.recommendation_runs (
      user_id,
      status,
      seeker_input_hash,
      scoring_version,
      started_at,
      refresh_claim_token,
      refresh_revision
    )
    VALUES (
      'f1100000-0000-4000-8000-000000000001',
      'running',
      'test-seeker-hash',
      'test-scoring-v1',
      clock_timestamp(),
      'f1200000-0000-4000-8000-000000000001',
      1
    )
  $$,
  'a claim can reserve its first run'
);

SELECT throws_ok(
  $$
    INSERT INTO public.recommendation_runs (
      user_id,
      status,
      seeker_input_hash,
      scoring_version,
      started_at,
      refresh_claim_token,
      refresh_revision
    )
    VALUES (
      'f1100000-0000-4000-8000-000000000001',
      'running',
      'test-seeker-hash',
      'test-scoring-v1',
      clock_timestamp(),
      'f1200000-0000-4000-8000-000000000001',
      1
    )
  $$,
  '23505',
  NULL,
  'the same claim cannot reserve another run'
);

SELECT lives_ok(
  $$
    INSERT INTO public.recommendation_runs (
      user_id,
      status,
      seeker_input_hash,
      scoring_version,
      started_at,
      refresh_claim_token,
      refresh_revision
    )
    VALUES (
      'f1100000-0000-4000-8000-000000000001',
      'running',
      'test-seeker-hash',
      'test-scoring-v1',
      clock_timestamp(),
      'f1200000-0000-4000-8000-000000000002',
      1
    )
  $$,
  'a replacement claim token can reserve a new run'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;