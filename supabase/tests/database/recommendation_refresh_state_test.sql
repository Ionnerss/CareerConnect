BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(10);

-- The existing auth trigger creates the corresponding profiles.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    'e9100000-0000-4000-8000-000000000001',
    'refresh-state-seeker@example.com',
    '{"full_name":"Refresh State Seeker"}'::jsonb
  ),
  (
    'e9200000-0000-4000-8000-000000000001',
    'refresh-state-recruiter@example.com',
    '{"full_name":"Refresh State Recruiter"}'::jsonb
  );

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id = 'e9100000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET role = 'recruiter'
WHERE id = 'e9200000-0000-4000-8000-000000000001';

SET LOCAL ROLE service_role;

-- 1. First change creates revision 1.
SELECT is(
  public.mark_recommendation_inputs_changed(
    'e9100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'the first input change creates revision 1'
);

-- 2. Another change advances the same seeker's revision.
SELECT is(
  public.mark_recommendation_inputs_changed(
    'e9100000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'a subsequent input change advances the revision'
);

-- 3. Multiple changes still produce one state row.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.recommendation_refresh_state
    WHERE user_id = 'e9100000-0000-4000-8000-000000000001'
  ),
  1,
  'the seeker has one refresh-state row'
);

-- 4. The new revision is actually persisted.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'e9100000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'the latest requested revision is stored'
);

-- 5. Recruiters cannot become refresh owners.
SELECT throws_ok(
  $$
    SELECT public.mark_recommendation_inputs_changed(
      'e9200000-0000-4000-8000-000000000001'
    )
  $$,
  '22023',
  'Refresh owner must be an existing job seeker',
  'a recruiter is rejected'
);

-- 6. Missing accounts cannot become refresh owners.
SELECT throws_ok(
  $$
    SELECT public.mark_recommendation_inputs_changed(
      'e9300000-0000-4000-8000-000000000001'
    )
  $$,
  '22023',
  'Refresh owner must be an existing job seeker',
  'a missing account is rejected'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e9100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

-- 7. Even the signed-in owner cannot invoke this trusted-server function.
SELECT throws_ok(
  $$
    SELECT public.mark_recommendation_inputs_changed(
      'e9100000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  NULL,
  'authenticated clients cannot invoke the change function'
);

-- 8. Clients cannot bypass the function with a direct write.
SELECT throws_ok(
  $$
    UPDATE public.recommendation_refresh_state
    SET requested_revision = 100
    WHERE user_id = 'e9100000-0000-4000-8000-000000000001'
  $$,
  '42501',
  NULL,
  'authenticated clients cannot modify refresh state directly'
);

RESET ROLE;
SET LOCAL ROLE anon;

-- 9. Anonymous clients cannot record input changes.
SELECT throws_ok(
  $$
    SELECT public.mark_recommendation_inputs_changed(
      'e9100000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  NULL,
  'anonymous clients cannot invoke the change function'
);

RESET ROLE;

DELETE FROM public.profiles
WHERE id = 'e9100000-0000-4000-8000-000000000001';

-- 10. Deleted profiles leave no refresh-state row.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.recommendation_refresh_state
    WHERE user_id = 'e9100000-0000-4000-8000-000000000001'
  ),
  0,
  'deleting the profile removes its refresh state'
);

SELECT * FROM finish();

ROLLBACK;