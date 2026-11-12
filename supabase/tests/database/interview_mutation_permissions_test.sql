begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

-- Check the effective privileges first.
select ok(
  not has_function_privilege(
    'anon', 'public.expire_pending_interviews()', 'EXECUTE'
  ),
  'anonymous users cannot invoke interview expiration'
);

select ok(
  not has_function_privilege(
    'authenticated', 'public.expire_pending_interviews()', 'EXECUTE'
  ),
  'authenticated users cannot invoke interview expiration'
);

select ok(
  not has_function_privilege(
    'service_role', 'public.expire_pending_interviews()', 'EXECUTE'
  ),
  'service_role is not an additional expiration entry point'
);

select ok(
  has_function_privilege(
    'postgres', 'public.expire_pending_interviews()', 'EXECUTE'
  ),
  'the postgres cron role can invoke interview expiration'
);

select ok(
  not has_table_privilege(
    'authenticated', 'public.interviews', 'UPDATE'
  ),
  'authenticated users have no table-wide interview UPDATE'
);

select ok(
  not has_column_privilege(
    'authenticated', 'public.interviews', 'status', 'UPDATE'
  ),
  'authenticated users cannot directly update interview status'
);

-- Prepare an applicant and recruiter.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'e9100000-0000-4000-8000-000000000001',
    'interview-permissions-applicant@example.com',
    '{"full_name":"Interview Test Applicant"}'::jsonb
  ),
  (
    'ea200000-0000-4000-8000-000000000001',
    'interview-permissions-recruiter@example.com',
    '{"full_name":"Interview Test Recruiter"}'::jsonb
  );

update public.profiles
set role = 'recruiter'
where id = 'ea200000-0000-4000-8000-000000000001';

insert into public.resumes (id, user_id, file_path, file_name)
values (
  'e9100000-0000-4000-8000-000000000002',
  'e9100000-0000-4000-8000-000000000001',
  'e9100000-0000-4000-8000-000000000001/a.pdf',
  'a.pdf'
);

insert into public.job (
  id, recruiter_id, title, description, location, status
)
values (
  'ea200000-0000-4000-8000-000000000002',
  'ea200000-0000-4000-8000-000000000001',
  'Interview Test Job',
  'Job for interview permission tests',
  'Montreal, QC',
  'open'
);

-- The application insertion trigger checks auth.uid().
select set_config(
  'request.jwt.claims',
  '{"sub":"e9100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.applications (
  id, job_id, applicant_id, resume_id
)
values (
  'e9100000-0000-4000-8000-000000000003',
  'ea200000-0000-4000-8000-000000000002',
  'e9100000-0000-4000-8000-000000000001',
  'e9100000-0000-4000-8000-000000000002'
);

insert into public.interviews (
  id,
  application_id,
  recruiter_id,
  applicant_id,
  scheduled_at,
  response_deadline,
  status
)
values (
  'eb300000-0000-4000-8000-000000000001',
  'e9100000-0000-4000-8000-000000000003',
  'ea200000-0000-4000-8000-000000000001',
  'e9100000-0000-4000-8000-000000000001',
  now() + interval '7 days',
  now() + interval '2 days',
  'pending'
);

-- The recruiter must use a checked function, even for their own row.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"ea200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select throws_ok(
  $$
    update public.interviews
    set status = 'cancelled'
    where id = 'eb300000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table interviews',
  'a recruiter cannot directly change interview status'
);

select throws_ok(
  $$
    update public.interviews
    set scheduled_at = now() + interval '30 days'
    where id = 'eb300000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table interviews',
  'a recruiter cannot directly change other interview fields'
);

-- The authorized recruiter can still reschedule through the function.
select lives_ok(
  $$
    select public.reschedule_interview(
      'eb300000-0000-4000-8000-000000000001',
      now() + interval '10 days',
      now() + interval '3 days'
    )
  $$,
  'the owning recruiter can reschedule through the checked function'
);

select is(
  (
    select status
    from public.interviews
    where id = 'eb300000-0000-4000-8000-000000000001'
  ),
  'pending',
  'rescheduling leaves a new invitation pending'
);

-- The applicant can still respond through the function.
select set_config(
  'request.jwt.claims',
  '{"sub":"e9100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select lives_ok(
  $$
    select public.respond_to_interview(
      'eb300000-0000-4000-8000-000000000001',
      'accepted'
    )
  $$,
  'the applicant can accept through the checked function'
);

select is(
  (
    select status
    from public.interviews
    where id = 'eb300000-0000-4000-8000-000000000001'
  ),
  'accepted',
  'the applicant response persists'
);

-- The owning recruiter can cancel an accepted interview.
select set_config(
  'request.jwt.claims',
  '{"sub":"ea200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select lives_ok(
  $$
    select public.cancel_interview(
      'eb300000-0000-4000-8000-000000000001'
    )
  $$,
  'the owning recruiter can cancel through the checked function'
);

select is(
  (
    select status
    from public.interviews
    where id = 'eb300000-0000-4000-8000-000000000001'
  ),
  'cancelled',
  'the cancellation persists'
);

select * from finish();
rollback;