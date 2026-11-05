begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

-- Creating auth users also creates their profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'a1111111-1111-4111-8111-111111111111',
    'mfa-resume-a@example.com',
    '{"full_name":"MFA Test A"}'::jsonb
  ),
  (
    'b2222222-2222-4222-8222-222222222222',
    'mfa-resume-b@example.com',
    '{"full_name":"MFA Test B"}'::jsonb
  );

insert into public.resumes (id, user_id, file_path, file_name)
values
  (
    'a3333333-3333-4333-8333-333333333333',
    'a1111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111/a.pdf',
    'a.pdf'
  ),
  (
    'b4444444-4444-4444-8444-444444444444',
    'b2222222-2222-4222-8222-222222222222',
    'b2222222-2222-4222-8222-222222222222/b.pdf',
    'b.pdf'
  );

-- A has a verified factor. B has no factor.
-- This fixture tests database policy; it is not an MFA enrollment.
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
  'a5555555-5555-4555-8555-555555555555',
  'a1111111-1111-4111-8111-111111111111',
  'Database test factor',
  'totp',
  'verified',
  now(),
  now(),
  'JBSWY3DPEHPK3PXP'
);

select is(
  (
    select count(*)::integer
    from auth.mfa_factors
    where user_id = 'a1111111-1111-4111-8111-111111111111'
      and status = 'verified'
  ),
  1,
  'user A has a verified MFA factor'
);

-- B: no enrolled factor, AAL1.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  auth.uid(),
  'b2222222-2222-4222-8222-222222222222'::uuid,
  'the test is running as user B'
);

select is(
  (
    select count(*)::integer
    from public.resumes
    where id = 'b4444444-4444-4444-8444-444444444444'
  ),
  1,
  'user B without MFA can read their own resume at AAL1'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = 'b2222222-2222-4222-8222-222222222222'
  ),
  1,
  'user B without MFA can read their own profile at AAL1'
);

-- A: verified factor, but this session has not completed MFA.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  auth.uid(),
  'a1111111-1111-4111-8111-111111111111'::uuid,
  'the test is running as user A'
);

select is(
  (
    select count(*)::integer
    from public.resumes
    where id = 'a3333333-3333-4333-8333-333333333333'
  ),
  0,
  'user A with a verified factor cannot read their resume at AAL1'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = 'a1111111-1111-4111-8111-111111111111'
  ),
  0,
  'user A with a verified factor cannot read their profile at AAL1'
);

-- Simulate an AAL2 JWT for the same user.
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  auth.jwt() ->> 'aal',
  'aal2',
  'user A’s simulated session is now AAL2'
);

select is(
  (
    select count(*)::integer
    from public.resumes
    where id = 'a3333333-3333-4333-8333-333333333333'
  ),
  1,
  'user A can read their own resume at AAL2'
);

select is(
  (
    select count(*)::integer
    from public.profiles
    where id = 'a1111111-1111-4111-8111-111111111111'
  ),
  1,
  'user A can read their own profile at AAL2'
);

select is(
  (
    select count(*)::integer
    from public.resumes
    where id = 'b4444444-4444-4444-8444-444444444444'
  ),
  0,
  'AAL2 does not let user A read user B’s resume'
);

select * from finish();
rollback;