begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

-- Creating auth users also creates their profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '33333333-3333-4333-8333-333333333333',
    'application-test-a@example.com',
    '{"full_name":"Applicant A"}'::jsonb
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'application-test-b@example.com',
    '{"full_name":"Applicant B"}'::jsonb
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'application-test-recruiter@example.com',
    '{"full_name":"Test Recruiter"}'::jsonb
  );

update public.profiles
set role = 'recruiter'
where id = '55555555-5555-4555-8555-555555555555';

insert into public.resumes (id, user_id, file_path, file_name)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333/a.pdf',
    'a.pdf'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    '44444444-4444-4444-8444-444444444444',
    '44444444-4444-4444-8444-444444444444/b.pdf',
    'b.pdf'
  );

insert into public.job (
  id, recruiter_id, title, description, location, status
)
values
  (
    '66666666-6666-4666-8666-666666666666',
    '55555555-5555-4555-8555-555555555555',
    'Open Database Test Job',
    'Open job used to test application submission',
    'Montréal, QC',
    'open'
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '55555555-5555-4555-8555-555555555555',
    'Closed Database Test Job',
    'Closed job used to test application submission',
    'Montréal, QC',
    'closed'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  auth.uid(),
  '33333333-3333-4333-8333-333333333333'::uuid,
  'the test is running as applicant A'
);

select lives_ok(
  $$
    insert into public.applications (job_id, applicant_id, resume_id)
    values (
      '66666666-6666-4666-8666-666666666666',
      '33333333-3333-4333-8333-333333333333',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    )
  $$,
  'applicant A can apply to an open job with their own active resume'
);

select is(
  (
    select count(*)::integer
    from public.applications
    where job_id = '66666666-6666-4666-8666-666666666666'
      and applicant_id = '33333333-3333-4333-8333-333333333333'
  ),
  1,
  'the valid application was stored and is visible to applicant A'
);

select throws_ok(
  $$
    insert into public.applications (job_id, applicant_id, resume_id)
    values (
      '66666666-6666-4666-8666-666666666666',
      '33333333-3333-4333-8333-333333333333',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
    )
  $$,
  'P0001',
  'You must select your own active resume.',
  'applicant A cannot apply with applicant B’s resume'
);

select throws_ok(
  $$
    insert into public.applications (job_id, applicant_id, resume_id)
    values (
      '77777777-7777-4777-8777-777777777777',
      '33333333-3333-4333-8333-333333333333',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    )
  $$,
  'P0001',
  'You can only apply to an open job.',
  'applicant A cannot apply to a closed job'
);

-- This repeats the valid submission. Changing the resume would not
-- permit another application to the same job by the same applicant.
select throws_ok(
  $$
    insert into public.applications (job_id, applicant_id, resume_id)
    values (
      '66666666-6666-4666-8666-666666666666',
      '33333333-3333-4333-8333-333333333333',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "applications_applicant_job_unique"',
  'applicant A cannot apply to the same job twice'
);

select * from finish();
rollback;