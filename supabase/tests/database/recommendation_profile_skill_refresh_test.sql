BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(11);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    'ea100000-0000-4000-8000-000000000001',
    'refresh-trigger-seeker@example.com',
    '{"full_name":"Refresh Trigger Seeker"}'::jsonb
  ),
  (
    'ea200000-0000-4000-8000-000000000001',
    'refresh-trigger-recruiter@example.com',
    '{"full_name":"Refresh Trigger Recruiter"}'::jsonb
  );

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id = 'ea100000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET role = 'recruiter'
WHERE id = 'ea200000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET location = 'Montreal'
WHERE id = 'ea100000-0000-4000-8000-000000000001';

-- 1. A location change creates the refresh state automatically.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ea100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'changing location requests a refresh'
);

UPDATE public.profiles
SET location = location
WHERE id = 'ea100000-0000-4000-8000-000000000001';

-- 2. Saving an identical value does not request extra work.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ea100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'an unchanged location does not advance the revision'
);

UPDATE public.profiles
SET full_name = 'Updated Display Name'
WHERE id = 'ea100000-0000-4000-8000-000000000001';

-- 3. Unrelated profile edits do not request work.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ea100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'changing a display name does not advance the revision'
);

-- Exercise a normal authenticated skill write. This account has
-- no enrolled factor, so its AAL1 session can edit its own skills.
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ea100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

INSERT INTO public.profile_skills (
  profile_id,
  name,
  proficiency
)
VALUES (
  'ea100000-0000-4000-8000-000000000001',
  'Java',
  'Beginner'
);

RESET ROLE;

-- 4. The normal client write invokes the trusted trigger.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ea100000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'adding a skill as its owner requests a refresh'
);

UPDATE public.profile_skills
SET proficiency = 'Advanced'
WHERE profile_id = 'ea100000-0000-4000-8000-000000000001'
  AND name = 'Java';

-- 5. A matching input change advances the revision.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ea100000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'changing skill proficiency requests another refresh'
);

UPDATE public.profile_skills
SET proficiency = proficiency
WHERE profile_id = 'ea100000-0000-4000-8000-000000000001'
  AND name = 'Java';

-- 6. An unchanged skill does not request extra work.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ea100000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'saving an unchanged skill does not advance the revision'
);

SELECT *
FROM public.claim_recommendation_refresh(
  'ea100000-0000-4000-8000-000000000001',
  300
);

DELETE FROM public.profile_skills
WHERE profile_id = 'ea100000-0000-4000-8000-000000000001'
  AND name = 'Java';

-- 7. Removing a skill changes the recommendation inputs too.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ea100000-0000-4000-8000-000000000001'
  ),
  4::bigint,
  'deleting a skill requests a refresh'
);

-- 8. The running worker's revision remains unchanged.
SELECT ok(
  (
    SELECT
      claimed_revision = 3
      AND claim_token IS NOT NULL
      AND completed_revision = 0
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ea100000-0000-4000-8000-000000000001'
  ),
  'an automatic refresh request preserves the active claim'
);

UPDATE public.profiles
SET location = 'Toronto'
WHERE id = 'ea200000-0000-4000-8000-000000000001';

-- 9. Recruiter profile changes do not queue seeker recommendations.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ea200000-0000-4000-8000-000000000001'
  ),
  0,
  'a recruiter location change does not request recommendations'
);

-- Add a dependent row so profile deletion also exercises the
-- skill-delete trigger during cascading cleanup.
INSERT INTO public.profile_skills (
  profile_id,
  name,
  proficiency
)
VALUES (
  'ea100000-0000-4000-8000-000000000001',
  'SQL',
  'Intermediate'
);

DELETE FROM public.profiles
WHERE id = 'ea100000-0000-4000-8000-000000000001';

-- 10. Cascading skill deletion must not recreate refresh state.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ea100000-0000-4000-8000-000000000001'
  ),
  0,
  'profile deletion removes refresh state without recreating it'
);

SET LOCAL ROLE authenticated;

-- 11. The trigger does not grant direct access to the worker RPC.
SELECT throws_ok(
  $$
    SELECT public.mark_recommendation_inputs_changed(
      'ea200000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  NULL,
  'browser clients still cannot invoke the worker function directly'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;