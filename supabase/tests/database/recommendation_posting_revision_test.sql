BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(11);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  'ed100000-0000-4000-8000-000000000001',
  'posting-revision-recruiter@example.com',
  '{"full_name":"Posting Revision Recruiter"}'::jsonb
);

UPDATE public.profiles
SET role = 'recruiter'
WHERE id = 'ed100000-0000-4000-8000-000000000001';

-- Compare against the starting revision because the database
-- may already contain postings.
CREATE TEMP TABLE posting_revision_baseline AS
SELECT revision
FROM public.recommendation_posting_state
WHERE singleton = true;

INSERT INTO public.job (
  id,
  recruiter_id,
  title,
  description,
  location,
  status
)
VALUES (
  'ed200000-0000-4000-8000-000000000001',
  'ed100000-0000-4000-8000-000000000001',
  'Closed Revision Test Job',
  'A closed test posting.',
  'Montreal',
  'closed'
);

-- 1.
SELECT is(
  (
    SELECT current_state.revision - baseline.revision
    FROM public.recommendation_posting_state AS current_state
    CROSS JOIN posting_revision_baseline AS baseline
    WHERE current_state.singleton = true
  ),
  0::bigint,
  'inserting a closed posting does not advance the revision'
);

-- Submit the open posting through the recruiter client role.
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ed100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
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
  'ed200000-0000-4000-8000-000000000002',
  'ed100000-0000-4000-8000-000000000001',
  'Open Revision Test Job',
  'An open test posting.',
  'Montreal',
  'open'
);

RESET ROLE;

-- 2.
SELECT is(
  (
    SELECT current_state.revision - baseline.revision
    FROM public.recommendation_posting_state AS current_state
    CROSS JOIN posting_revision_baseline AS baseline
    WHERE current_state.singleton = true
  ),
  1::bigint,
  'a recruiter inserting an open posting advances the revision'
);

UPDATE public.job
SET title = title
WHERE id = 'ed200000-0000-4000-8000-000000000002';

-- 3.
SELECT is(
  (
    SELECT current_state.revision - baseline.revision
    FROM public.recommendation_posting_state AS current_state
    CROSS JOIN posting_revision_baseline AS baseline
    WHERE current_state.singleton = true
  ),
  1::bigint,
  'saving identical posting values does not advance the revision'
);

UPDATE public.job
SET status = 'closed'
WHERE id = 'ed200000-0000-4000-8000-000000000002';

-- 4.
SELECT is(
  (
    SELECT current_state.revision - baseline.revision
    FROM public.recommendation_posting_state AS current_state
    CROSS JOIN posting_revision_baseline AS baseline
    WHERE current_state.singleton = true
  ),
  2::bigint,
  'closing an open posting advances the revision'
);

UPDATE public.job
SET description = 'Updated while closed.'
WHERE id = 'ed200000-0000-4000-8000-000000000002';

-- 5.
SELECT is(
  (
    SELECT current_state.revision - baseline.revision
    FROM public.recommendation_posting_state AS current_state
    CROSS JOIN posting_revision_baseline AS baseline
    WHERE current_state.singleton = true
  ),
  2::bigint,
  'editing a posting that remains closed does not advance the revision'
);

UPDATE public.job
SET status = 'open'
WHERE id = 'ed200000-0000-4000-8000-000000000002';

-- 6.
SELECT is(
  (
    SELECT current_state.revision - baseline.revision
    FROM public.recommendation_posting_state AS current_state
    CROSS JOIN posting_revision_baseline AS baseline
    WHERE current_state.singleton = true
  ),
  3::bigint,
  'reopening a posting advances the revision'
);

UPDATE public.job
SET title = 'Updated Open Revision Test Job'
WHERE id = 'ed200000-0000-4000-8000-000000000002';

-- 7.
SELECT is(
  (
    SELECT current_state.revision - baseline.revision
    FROM public.recommendation_posting_state AS current_state
    CROSS JOIN posting_revision_baseline AS baseline
    WHERE current_state.singleton = true
  ),
  4::bigint,
  'editing an open posting advances the revision'
);

DELETE FROM public.job
WHERE id = 'ed200000-0000-4000-8000-000000000002';

-- 8.
SELECT is(
  (
    SELECT current_state.revision - baseline.revision
    FROM public.recommendation_posting_state AS current_state
    CROSS JOIN posting_revision_baseline AS baseline
    WHERE current_state.singleton = true
  ),
  5::bigint,
  'deleting an open posting advances the revision'
);

DELETE FROM public.job
WHERE id = 'ed200000-0000-4000-8000-000000000001';

-- 9.
SELECT is(
  (
    SELECT current_state.revision - baseline.revision
    FROM public.recommendation_posting_state AS current_state
    CROSS JOIN posting_revision_baseline AS baseline
    WHERE current_state.singleton = true
  ),
  5::bigint,
  'deleting a closed posting does not advance the revision'
);

SET LOCAL ROLE authenticated;

-- 10.
SELECT throws_ok(
  $$
    UPDATE public.recommendation_posting_state
    SET revision = revision + 1
    WHERE singleton = true
  $$,
  '42501',
  NULL,
  'browser clients cannot modify the posting revision directly'
);

RESET ROLE;
SET LOCAL ROLE service_role;

-- 11.
SELECT is(
  (
    SELECT count(*)::integer
    FROM public.recommendation_posting_state
  ),
  1,
  'the worker can read the single posting-state row'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;