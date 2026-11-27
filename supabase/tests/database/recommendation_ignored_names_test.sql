BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(6);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  'ed100000-0000-4000-8000-000000000001',
  'refresh-ignored-names@example.com',
  '{"full_name":"Refresh Ignored Names"}'::jsonb
);

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id = 'ed100000-0000-4000-8000-000000000001';

INSERT INTO public.profile_education (
  id,
  profile_id,
  school,
  degree,
  field_of_study,
  start_date
)
VALUES (
  'ed200000-0000-4000-8000-000000000001',
  'ed100000-0000-4000-8000-000000000001',
  'Original University',
  'Bachelor of Engineering',
  'Software Engineering',
  DATE '2023-09-01'
);

INSERT INTO public.profile_experience (
  id,
  profile_id,
  company_name,
  job_role,
  start_date
)
VALUES (
  'ed300000-0000-4000-8000-000000000001',
  'ed100000-0000-4000-8000-000000000001',
  'Original Company',
  'Software Developer',
  DATE '2025-01-01'
);

-- Capture the revision after fixture creation.
CREATE TEMP TABLE ignored_names_baseline AS
SELECT requested_revision
FROM public.recommendation_refresh_state
WHERE user_id = 'ed100000-0000-4000-8000-000000000001';

-- Prevent a missing refresh-state row from making the tests meaningless.
SELECT is(
  (SELECT count(*) FROM ignored_names_baseline),
  1::bigint,
  'fixture creation records refresh state'
);

UPDATE public.profile_education
SET school = 'Renamed University'
WHERE id = 'ed200000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ed100000-0000-4000-8000-000000000001'
  ),
  (SELECT requested_revision FROM ignored_names_baseline),
  'changing only the school does not request a refresh'
);

UPDATE public.profile_experience
SET company_name = 'Renamed Company'
WHERE id = 'ed300000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ed100000-0000-4000-8000-000000000001'
  ),
  (SELECT requested_revision FROM ignored_names_baseline),
  'changing only the company name does not request a refresh'
);

-- Upserts can mention every column even when matching fields are unchanged.
UPDATE public.profile_education
SET school = 'Another University',
    degree = degree,
    field_of_study = field_of_study,
    start_date = start_date,
    end_date = end_date,
    description = description
WHERE id = 'ed200000-0000-4000-8000-000000000001';

UPDATE public.profile_experience
SET company_name = 'Another Company',
    job_role = job_role,
    start_date = start_date,
    end_date = end_date,
    description = description
WHERE id = 'ed300000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ed100000-0000-4000-8000-000000000001'
  ),
  (SELECT requested_revision FROM ignored_names_baseline),
  'full-field saves with only name changes do not request a refresh'
);

-- A relevant change must still trigger, including alongside a name change.
UPDATE public.profile_education
SET school = 'Final University',
    degree = 'Master of Engineering'
WHERE id = 'ed200000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ed100000-0000-4000-8000-000000000001'
  ),
  (SELECT requested_revision + 1 FROM ignored_names_baseline),
  'changing the degree still requests a refresh'
);

UPDATE public.profile_experience
SET company_name = 'Final Company',
    job_role = 'Senior Software Developer'
WHERE id = 'ed300000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ed100000-0000-4000-8000-000000000001'
  ),
  (SELECT requested_revision + 2 FROM ignored_names_baseline),
  'changing the job role still requests a refresh'
);

SELECT * FROM finish();

ROLLBACK;