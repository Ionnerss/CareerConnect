BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(8);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  (
    'ec100000-0000-4000-8000-000000000001',
    'refresh-application-a@example.com',
    '{"full_name":"Refresh Applicant A"}'::jsonb
  ),
  (
    'ec200000-0000-4000-8000-000000000001',
    'refresh-application-b@example.com',
    '{"full_name":"Refresh Applicant B"}'::jsonb
  ),
  (
    'ec300000-0000-4000-8000-000000000001',
    'refresh-application-recruiter@example.com',
    '{"full_name":"Refresh Recruiter"}'::jsonb
  );

UPDATE public.profiles
SET role = 'job_seeker'
WHERE id IN (
  'ec100000-0000-4000-8000-000000000001',
  'ec200000-0000-4000-8000-000000000001'
);

UPDATE public.profiles
SET role = 'recruiter'
WHERE id = 'ec300000-0000-4000-8000-000000000001';

INSERT INTO public.resumes (
  id,
  user_id,
  file_path,
  file_name,
  archived_at
)
VALUES (
  'ec400000-0000-4000-8000-000000000001',
  'ec100000-0000-4000-8000-000000000001',
  'ec100000-0000-4000-8000-000000000001/refresh-test.pdf',
  'refresh-test.pdf',
  NULL
);

INSERT INTO public.job (
  id,
  recruiter_id,
  title,
  description,
  location,
  status
)
VALUES (
  'ec500000-0000-4000-8000-000000000001',
  'ec300000-0000-4000-8000-000000000001',
  'Application Refresh Test Job',
  'An open posting for recommendation refresh tests.',
  'Montreal',
  'open'
);

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ec100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

INSERT INTO public.applications (
  job_id,
  applicant_id,
  resume_id
)
VALUES (
  'ec500000-0000-4000-8000-000000000001',
  'ec100000-0000-4000-8000-000000000001',
  'ec400000-0000-4000-8000-000000000001'
);

RESET ROLE;

-- 1. A normal submission requests a recommendation refresh.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ec100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'submitting an application requests a refresh'
);

-- 2. Another seeker's state is unaffected.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ec200000-0000-4000-8000-000000000001'
  ),
  0,
  'submitting an application does not affect another seeker'
);

-- Exercise a status change as the owning recruiter.
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ec300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

UPDATE public.applications
SET status = 'Rejected'
WHERE applicant_id = 'ec100000-0000-4000-8000-000000000001'
  AND job_id = 'ec500000-0000-4000-8000-000000000001';

RESET ROLE;

-- 3. Status does not change whether the seeker already applied.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ec100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'a status change does not request another refresh'
);

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ec100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

-- 4. Duplicate submissions are still rejected.
SELECT throws_ok(
  $$
    INSERT INTO public.applications (
      job_id,
      applicant_id,
      resume_id
    )
    VALUES (
      'ec500000-0000-4000-8000-000000000001',
      'ec100000-0000-4000-8000-000000000001',
      'ec400000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  NULL,
  'a duplicate application is rejected'
);

RESET ROLE;

-- 5. A rejected submission leaves refresh state unchanged.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ec100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'a failed submission does not advance the revision'
);

SELECT *
FROM public.claim_recommendation_refresh(
  'ec100000-0000-4000-8000-000000000001',
  300
);

-- Roll back a deletion inside a subtransaction.
-- Keep pgTAP assertions outside that subtransaction.
DO $test$
BEGIN
  BEGIN
    DELETE FROM public.applications
    WHERE applicant_id = 'ec100000-0000-4000-8000-000000000001'
      AND job_id = 'ec500000-0000-4000-8000-000000000001';

    RAISE EXCEPTION USING
      ERRCODE = 'ZX001',
      MESSAGE = 'Simulated transaction failure';
  EXCEPTION
    WHEN SQLSTATE 'ZX001' THEN
      NULL;
  END;
END;
$test$;

-- 6. Application and revision changes roll back together.
SELECT ok(
  (
    SELECT requested_revision = 1
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ec100000-0000-4000-8000-000000000001'
  )
  AND EXISTS (
    SELECT 1
    FROM public.applications
    WHERE applicant_id = 'ec100000-0000-4000-8000-000000000001'
      AND job_id = 'ec500000-0000-4000-8000-000000000001'
  ),
  'rolling back deletion also restores the refresh revision'
);

-- Trusted fixture operation exercising an actual deletion.
DELETE FROM public.applications
WHERE applicant_id = 'ec100000-0000-4000-8000-000000000001'
  AND job_id = 'ec500000-0000-4000-8000-000000000001';

-- 7. Deletion changes the eligible candidate set.
SELECT is(
  (
    SELECT requested_revision
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ec100000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'deleting an application requests another refresh'
);

-- 8. The worker's original claim remains intact.
SELECT ok(
  (
    SELECT
      claimed_revision = 1
      AND claim_token IS NOT NULL
      AND completed_revision = 0
    FROM public.recommendation_refresh_state
    WHERE user_id = 'ec100000-0000-4000-8000-000000000001'
  ),
  'application deletion preserves the active claim'
);

SELECT * FROM finish();

ROLLBACK;