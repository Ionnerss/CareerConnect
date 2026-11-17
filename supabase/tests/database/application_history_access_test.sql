begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

-- Creating auth users also creates their job-seeker profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'a8100000-0000-4000-8000-000000000001',
    'history-test-a@example.com',
    '{"full_name":"History Applicant A"}'::jsonb
  ),
  (
    'b8200000-0000-4000-8000-000000000001',
    'history-test-b@example.com',
    '{"full_name":"History Applicant B"}'::jsonb
  ),
  (
    'c8300000-0000-4000-8000-000000000001',
    'history-test-recruiter@example.com',
    '{"full_name":"History Test Recruiter"}'::jsonb
  );

update public.profiles
set role = 'recruiter'
where id = 'c8300000-0000-4000-8000-000000000001';

insert into public.resumes (id, user_id, file_path, file_name)
values
  (
    'a8100000-0000-4000-8000-000000000002',
    'a8100000-0000-4000-8000-000000000001',
    'a8100000-0000-4000-8000-000000000001/a.pdf',
    'a.pdf'
  ),
  (
    'b8200000-0000-4000-8000-000000000002',
    'b8200000-0000-4000-8000-000000000001',
    'b8200000-0000-4000-8000-000000000001/b.pdf',
    'b.pdf'
  );

insert into public.job (
  id, recruiter_id, title, description, location, status
)
values (
  'c8300000-0000-4000-8000-000000000002',
  'c8300000-0000-4000-8000-000000000001',
  'History Test Job',
  'Job for application history access tests',
  'Montreal, QC',
  'open'
);

-- The application trigger checks auth.uid(), including for fixture inserts.
select set_config(
  'request.jwt.claims',
  '{"sub":"a8100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.applications (
  id, job_id, applicant_id, resume_id, created_at
)
values (
  'a8100000-0000-4000-8000-000000000003',
  'c8300000-0000-4000-8000-000000000002',
  'a8100000-0000-4000-8000-000000000001',
  'a8100000-0000-4000-8000-000000000002',
  '2026-11-09T12:00:00Z'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"b8200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.applications (
  id, job_id, applicant_id, resume_id
)
values (
  'b8200000-0000-4000-8000-000000000003',
  'c8300000-0000-4000-8000-000000000002',
  'b8200000-0000-4000-8000-000000000001',
  'b8200000-0000-4000-8000-000000000002'
);

-- A has a verified factor. B has no factor.
insert into auth.mfa_factors (
  id,
  user_id,
  friendly_name,
  factor_type,
  status,
  created_at,
  updated_at,
  secret
)
values (
  'a8100000-0000-4000-8000-000000000004',
  'a8100000-0000-4000-8000-000000000001',
  'Application history test factor',
  'totp',
  'verified',
  now(),
  now(),
  'JBSWY3DPEHPK3PXP'
);

-- D is a recruiter unrelated to the fixture job.
insert into auth.users (id, email, raw_user_meta_data)
values (
  'd8400000-0000-4000-8000-000000000001',
  'history-test-unrelated-recruiter@example.com',
  '{"full_name":"Unrelated History Recruiter"}'::jsonb
);

update public.profiles
set role = 'recruiter'
where id = 'd8400000-0000-4000-8000-000000000001';

-- Supply a real storage row for A's cover-letter path.
insert into storage.buckets (id, name, public)
values ('cover_letters', 'cover_letters', false)
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name)
values (
  'cover_letters',
  'a8100000-0000-4000-8000-000000000001/'
  || 'a8100000-0000-4000-8000-000000000003/'
  || 'cover-letter.pdf'
);

-- Test direct database reads as applicant A at AAL1.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a8100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  auth.uid(),
  'a8100000-0000-4000-8000-000000000001'::uuid,
  'the database request is running as applicant A'
);

select is(
  (
    select count(*)::integer
    from public.applications
    where id = 'a8100000-0000-4000-8000-000000000003'
  ),
  0,
  'applicant A cannot read their own application at AAL1'
);

select is(
  (
    select count(*)::integer
    from public.applications
    where id = 'b8200000-0000-4000-8000-000000000003'
  ),
  0,
  'applicant A cannot read B’s application at AAL1'
);

-- A can read their own application after completing MFA.
select set_config(
  'request.jwt.claims',
  '{"sub":"a8100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.applications
    where id = 'a8100000-0000-4000-8000-000000000003'
  ),
  1,
  'applicant A can read their own application at AAL2'
);

select is(
  (
    select count(*)::integer
    from public.applications
    where id = 'b8200000-0000-4000-8000-000000000003'
  ),
  0,
  'AAL2 does not let applicant A read B’s application'
);

-- B has no enrolled factor and remains at AAL1.
select set_config(
  'request.jwt.claims',
  '{"sub":"b8200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.applications
    where id = 'b8200000-0000-4000-8000-000000000003'
  ),
  1,
  'applicant B without an enrolled factor can read their own application at AAL1'
);

select is(
  (
    select count(*)::integer
    from public.applications
    where id = 'a8100000-0000-4000-8000-000000000003'
  ),
  0,
  'applicant B cannot read applicant A’s application'
);

-- C owns the job receiving both applications.
select set_config(
  'request.jwt.claims',
  '{"sub":"c8300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.applications
    where id in (
      'a8100000-0000-4000-8000-000000000003',
      'b8200000-0000-4000-8000-000000000003'
    )
  ),
  2,
  'the recruiter who owns the job can read both applications'
);

-- D owns no job connected to either application.
select set_config(
  'request.jwt.claims',
  '{"sub":"d8400000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  (
    select count(*)::integer
    from public.applications
    where id in (
      'a8100000-0000-4000-8000-000000000003',
      'b8200000-0000-4000-8000-000000000003'
    )
  ),
  0,
  'an unrelated recruiter cannot read either application'
);

-- A has completed MFA. The timestamp update must be denied independently
-- of the MFA requirement.
select set_config(
  'request.jwt.claims',
  '{"sub":"a8100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select throws_ok(
  $$
    update public.applications
    set created_at = '2026-10-09T12:00:00Z'
    where id = 'a8100000-0000-4000-8000-000000000003'
  $$,
  '42501',
  'permission denied for table applications',
  'applicant A cannot rewrite their application submission timestamp'
);

select is(
  (
    select created_at
    from public.applications
    where id = 'a8100000-0000-4000-8000-000000000003'
  ),
  '2026-11-09T12:00:00Z'::timestamptz,
  'A’s application submission timestamp remains unchanged'
);

-- Recruiter C owns the job. The narrower grant must still allow
-- a legitimate status update and its status-change trigger.
select set_config(
  'request.jwt.claims',
  '{"sub":"c8300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select lives_ok(
  $$
    update public.applications
    set status = 'Interview'
    where id = 'a8100000-0000-4000-8000-000000000003'
  $$,
  'the owning recruiter can update an application status'
);

select is(
  (
    select status
    from public.applications
    where id = 'a8100000-0000-4000-8000-000000000003'
  ),
  'Interview',
  'the recruiter status update persists'
);

-- Applicant A has completed MFA. They can attach their own
-- existing cover-letter object using the permitted column.
select set_config(
  'request.jwt.claims',
  '{"sub":"a8100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select lives_ok(
  $$
    update public.applications
    set cover_letter_path =
      'a8100000-0000-4000-8000-000000000001/'
      || 'a8100000-0000-4000-8000-000000000003/'
      || 'cover-letter.pdf'
    where id = 'a8100000-0000-4000-8000-000000000003'
  $$,
  'applicant A can attach their own existing cover letter'
);

select is(
  (
    select cover_letter_path
    from public.applications
    where id = 'a8100000-0000-4000-8000-000000000003'
  ),
  'a8100000-0000-4000-8000-000000000001/'
    || 'a8100000-0000-4000-8000-000000000003/'
    || 'cover-letter.pdf',
  'the cover-letter path persists'
);

select * from finish();
rollback;