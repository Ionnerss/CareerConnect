begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

-- Test-only users. The auth trigger creates their profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'f1111111-1111-4111-8111-111111111111',
    'mfa-function-recruiter@example.com',
    '{"full_name":"MFA Recruiter"}'::jsonb
  ),
  (
    'f2222222-2222-4222-8222-222222222222',
    'mfa-function-applicant@example.com',
    '{"full_name":"MFA Applicant"}'::jsonb
  ),
  (
    'f3333333-3333-4333-8333-333333333333',
    'mfa-function-unrelated@example.com',
    '{"full_name":"Unrelated Recruiter"}'::jsonb
  );

update public.profiles
set role = 'recruiter'
where id in (
  'f1111111-1111-4111-8111-111111111111',
  'f3333333-3333-4333-8333-333333333333'
);

insert into public.resumes (id, user_id, file_path, file_name)
values (
  'f4444444-4444-4444-8444-444444444444',
  'f2222222-2222-4222-8222-222222222222',
  'f2222222-2222-4222-8222-222222222222/test.pdf',
  'test.pdf'
);

insert into public.job (
  id, recruiter_id, title, description, location, status
)
values (
  'f5555555-5555-4555-8555-555555555555',
  'f1111111-1111-4111-8111-111111111111',
  'MFA Function Test Job',
  'Disposable job for the MFA function regression test',
  'Montréal, QC',
  'open'
);

-- Recruiter A has a verified factor; the other users do not.
-- This is a database-policy fixture, not a TOTP enrollment flow.
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
  'f6666666-6666-4666-8666-666666666666',
  'f1111111-1111-4111-8111-111111111111',
  'Function regression test factor',
  'totp',
  'verified',
  now(),
  now(),
  'JBSWY3DPEHPK3PXP'
);

-- Applicant B submits a valid application at AAL1.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"f2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.applications (job_id, applicant_id, resume_id)
values (
  'f5555555-5555-4555-8555-555555555555',
  'f2222222-2222-4222-8222-222222222222',
  'f4444444-4444-4444-8444-444444444444'
);

-- Switch to recruiter A's password-only session.
select set_config(
  'request.jwt.claims',
  '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  auth.uid(),
  'f1111111-1111-4111-8111-111111111111'::uuid,
  'request is running as the MFA-enrolled recruiter'
);

select is(
  auth.jwt() ->> 'aal',
  'aal1',
  'the recruiter session has not completed MFA'
);

select is(
  (
    select count(*)::integer
    from public.applications
    where job_id = 'f5555555-5555-4555-8555-555555555555'
      and applicant_id = 'f2222222-2222-4222-8222-222222222222'
  ),
  0,
  'AAL1 recruiter cannot read the protected application table'
);

-- This is expected to FAIL on the current function.
select is(
  public.recruiter_can_view_profile(
    'f2222222-2222-4222-8222-222222222222'
  ),
  false,
  'AAL1 recruiter cannot infer the applicant relationship through the function'
);

-- After MFA, legitimate recruiter access must still work.
select set_config(
  'request.jwt.claims',
  '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  public.recruiter_can_view_profile(
    'f2222222-2222-4222-8222-222222222222'
  ),
  true,
  'AAL2 recruiter can identify an applicant to their own job'
);

-- MFA must not grant another recruiter access to this relationship.
select set_config(
  'request.jwt.claims',
  '{"sub":"f3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  public.recruiter_can_view_profile(
    'f2222222-2222-4222-8222-222222222222'
  ),
  false,
  'unrelated recruiter cannot identify this applicant'
);

select * from finish();
rollback;