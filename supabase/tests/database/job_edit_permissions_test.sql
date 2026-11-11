begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

-- The auth trigger creates a profile for this disposable user.
insert into auth.users (id, email, raw_user_meta_data)
values (
  'a7100000-0000-4000-8000-000000000001',
  'job-edit-test-recruiter@example.com',
  '{"full_name":"Job Edit Test Recruiter"}'::jsonb
);

update public.profiles
set role = 'recruiter'
where id = 'a7100000-0000-4000-8000-000000000001';

insert into public.job (
  id,
  recruiter_id,
  title,
  firm_name,
  location,
  work_mode,
  employment_type,
  required_skills,
  salary,
  experience,
  description,
  status
)
values (
  'a7100000-0000-4000-8000-000000000002',
  'a7100000-0000-4000-8000-000000000001',
  'Original title',
  'Original company',
  'Montréal, QC',
  'On-site',
  'Full-time',
  'Java',
  50000,
  1,
  'Original description',
  'open'
);

select is(
  (
    select count(*)::integer
    from auth.mfa_factors
    where user_id = 'a7100000-0000-4000-8000-000000000001'
      and status = 'verified'
  ),
  0,
  'test recruiter has no verified MFA factor'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  'a7200000-0000-4000-8000-000000000001',
  'job-edit-test-recruiter-b@example.com',
  '{"full_name":"Job Edit Test Recruiter B"}'::jsonb
);

update public.profiles
set role = 'recruiter'
where id = 'a7200000-0000-4000-8000-000000000001';

insert into public.job (
  id, recruiter_id, title, firm_name, location,
  work_mode, employment_type, required_skills,
  salary, experience, description, status
)
values (
  'a7200000-0000-4000-8000-000000000002',
  'a7200000-0000-4000-8000-000000000001',
  'B original title',
  'B company',
  'Montréal, QC',
  'On-site',
  'Full-time',
  'SQL',
  55000,
  1,
  'B original description',
  'open'
);

-- Recruiter C has a verified MFA factor.
insert into auth.users (id, email, raw_user_meta_data)
values (
  'a7300000-0000-4000-8000-000000000001',
  'job-edit-test-recruiter-c@example.com',
  '{"full_name":"Job Edit Test Recruiter C"}'::jsonb
);

update public.profiles
set role = 'recruiter'
where id = 'a7300000-0000-4000-8000-000000000001';

insert into public.job (
  id, recruiter_id, title, firm_name, location,
  work_mode, employment_type, required_skills,
  salary, experience, description, status
)
values (
  'a7300000-0000-4000-8000-000000000002',
  'a7300000-0000-4000-8000-000000000001',
  'C original title',
  'C company',
  'Montréal, QC',
  'On-site',
  'Full-time',
  'Java',
  60000,
  2,
  'C original description',
  'open'
);

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
  'a7300000-0000-4000-8000-000000000003',
  'a7300000-0000-4000-8000-000000000001',
  'Job edit database test factor',
  'totp',
  'verified',
  now(),
  now(),
  'JBSWY3DPEHPK3PXP'
);

-- Simulate this recruiter's normal password-only session.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a7100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

-- Update the same ten columns sent by updateJobPosting().
select lives_ok(
  $$
    update public.job
    set
      title = 'Updated title',
      firm_name = 'Updated company',
      location = 'Québec, QC',
      work_mode = 'Hybrid',
      employment_type = 'Internship',
      required_skills = 'Java, SQL',
      salary = 65000,
      experience = 2,
      description = 'Updated description',
      status = 'closed'
    where id = 'a7100000-0000-4000-8000-000000000002'
      and recruiter_id = 'a7100000-0000-4000-8000-000000000001'
  $$,
  'authenticated recruiter can update every editable column at AAL1 without MFA enrollment'
);

select is(
  (
    select count(*)::integer
    from public.job
    where id = 'a7100000-0000-4000-8000-000000000002'
      and recruiter_id = 'a7100000-0000-4000-8000-000000000001'
      and title = 'Updated title'
      and firm_name = 'Updated company'
      and location = 'Québec, QC'
      and work_mode = 'Hybrid'
      and employment_type = 'Internship'
      and required_skills = 'Java, SQL'
      and salary = 65000
      and experience = 2
      and description = 'Updated description'
      and status = 'closed'
  ),
  1,
  'the owned posting persists all ten edited values'
);

-- B has no enrolled MFA factor and is signed in at AAL1.
select set_config(
  'request.jwt.claims',
  '{"sub":"a7200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

-- Deliberately filter only by A's job ID. RLS must prevent this update.
select lives_ok(
  $$
    update public.job
    set title = 'Unauthorized change by B'
    where id = 'a7100000-0000-4000-8000-000000000002'
  $$,
  'B can issue an update request against A’s job without a SQL error'
);

select is(
  (
    select title
    from public.job
    where id = 'a7100000-0000-4000-8000-000000000002'
  ),
  'Updated title',
  'B’s request did not change A’s job'
);

-- Control case: B must still be able to edit B's own job.
select lives_ok(
  $$
    update public.job
    set title = 'B updated title'
    where id = 'a7200000-0000-4000-8000-000000000002'
  $$,
  'B can update B’s own job'
);

select is(
  (
    select title
    from public.job
    where id = 'a7200000-0000-4000-8000-000000000002'
  ),
  'B updated title',
  'B’s own edit persists'
);

-- C has a verified factor but has not completed MFA in this session.
select set_config(
  'request.jwt.claims',
  '{"sub":"a7300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select lives_ok(
  $$
    update public.job
    set title = 'C unauthorized AAL1 title'
    where id = 'a7300000-0000-4000-8000-000000000002'
  $$,
  'C can issue an update request at AAL1'
);

select is(
  (
    select title
    from public.job
    where id = 'a7300000-0000-4000-8000-000000000002'
  ),
  'C original title',
  'verified-factor recruiter cannot change their job at AAL1'
);

-- Same user, now with an AAL2 session.
select set_config(
  'request.jwt.claims',
  '{"sub":"a7300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select lives_ok(
  $$
    update public.job
    set title = 'C authorized AAL2 title'
    where id = 'a7300000-0000-4000-8000-000000000002'
  $$,
  'C can update their own job after completing MFA'
);

select is(
  (
    select title
    from public.job
    where id = 'a7300000-0000-4000-8000-000000000002'
  ),
  'C authorized AAL2 title',
  'verified-factor recruiter’s AAL2 edit persists'
);

select * from finish();
rollback;