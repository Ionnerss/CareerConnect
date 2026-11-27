BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(12);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  'eb100000-0000-4000-8000-000000000001',
  'refresh-profile-details@example.com',
  '{"full_name":"Refresh Profile Details"}'::jsonb
);

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id = 'eb100000-0000-4000-8000-000000000001';

-- Establish an empty fixture regardless of whether signup
-- creates a default preferences row.
DELETE FROM public.profile_preferences
WHERE profile_id = 'eb100000-0000-4000-8000-000000000001';

DELETE FROM public.recommendation_refresh_state
WHERE user_id = 'eb100000-0000-4000-8000-000000000001';

-- Education.

INSERT INTO public.profile_education (
  profile_id,
  school,
  degree,
  field_of_study,
  start_date,
  end_date,
  description
)
VALUES (
  'eb100000-0000-4000-8000-000000000001',
  'Test University',
  'Bachelor',
  'Computer Science',
  '2023-09-01',
  NULL,
  'Algorithms and software development.'
);

-- 1.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'adding education requests a refresh'
);

UPDATE public.profile_education
SET field_of_study = 'Software Engineering'
WHERE profile_id = 'eb100000-0000-4000-8000-000000000001';

-- 2.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'editing education advances the revision'
);

UPDATE public.profile_education
SET field_of_study = field_of_study
WHERE profile_id = 'eb100000-0000-4000-8000-000000000001';

-- 3.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'saving identical education does not advance the revision'
);

DELETE FROM public.profile_education
WHERE profile_id = 'eb100000-0000-4000-8000-000000000001';

-- 4.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'deleting education advances the revision'
);

-- Experience.

INSERT INTO public.profile_experience (
  profile_id,
  company_name,
  job_role,
  start_date,
  end_date,
  description
)
VALUES (
  'eb100000-0000-4000-8000-000000000001',
  'Test Company',
  'Developer Intern',
  '2025-05-01',
  '2025-08-31',
  'Built and tested web application features.'
);

-- 5.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  4::bigint,
  'adding experience advances the revision'
);

UPDATE public.profile_experience
SET job_role = 'Backend Developer Intern'
WHERE profile_id = 'eb100000-0000-4000-8000-000000000001';

-- 6.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  5::bigint,
  'editing experience advances the revision'
);

UPDATE public.profile_experience
SET job_role = job_role
WHERE profile_id = 'eb100000-0000-4000-8000-000000000001';

-- 7.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  5::bigint,
  'saving identical experience does not advance the revision'
);

DELETE FROM public.profile_experience
WHERE profile_id = 'eb100000-0000-4000-8000-000000000001';

-- 8.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  6::bigint,
  'deleting experience advances the revision'
);

-- Preferences.

INSERT INTO public.profile_preferences (
  profile_id,
  desired_role,
  desired_position,
  desired_salary,
  work_mode
)
VALUES (
  'eb100000-0000-4000-8000-000000000001',
  'Backend Developer',
  'internship',
  50000,
  'hybrid'
);

-- 9.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  7::bigint,
  'adding preferences advances the revision'
);

-- Match the application's upsert behavior with identical values.
INSERT INTO public.profile_preferences (
  profile_id,
  desired_role,
  desired_position,
  desired_salary,
  work_mode
)
VALUES (
  'eb100000-0000-4000-8000-000000000001',
  'Backend Developer',
  'internship',
  50000,
  'hybrid'
)
ON CONFLICT (profile_id) DO UPDATE
SET desired_role = EXCLUDED.desired_role,
    desired_position = EXCLUDED.desired_position,
    desired_salary = EXCLUDED.desired_salary,
    work_mode = EXCLUDED.work_mode;

-- 10.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  7::bigint,
  'an identical preferences upsert does not advance the revision'
);

INSERT INTO public.profile_preferences (
  profile_id,
  desired_role,
  desired_position,
  desired_salary,
  work_mode
)
VALUES (
  'eb100000-0000-4000-8000-000000000001',
  'Backend Developer',
  'internship',
  50000,
  'remote'
)
ON CONFLICT (profile_id) DO UPDATE
SET desired_role = EXCLUDED.desired_role,
    desired_position = EXCLUDED.desired_position,
    desired_salary = EXCLUDED.desired_salary,
    work_mode = EXCLUDED.work_mode;

-- 11.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  8::bigint,
  'a changed preferences upsert advances the revision once'
);

DELETE FROM public.profile_preferences
WHERE profile_id = 'eb100000-0000-4000-8000-000000000001';

-- 12.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'eb100000-0000-4000-8000-000000000001'
  ),
  9::bigint,
  'deleting preferences advances the revision'
);

SELECT * FROM finish();

ROLLBACK;