begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

-- The auth trigger creates the corresponding profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'db100000-0000-4000-8000-000000000001',
    'reschedule-dismissal-applicant@example.com',
    '{"full_name":"Reschedule Test Applicant"}'::jsonb
  ),
  (
    'db100000-0000-4000-8000-000000000002',
    'reschedule-dismissal-recruiter@example.com',
    '{"full_name":"Reschedule Test Recruiter"}'::jsonb
  );

update public.profiles
set role = 'recruiter'
where id = 'db100000-0000-4000-8000-000000000002';

insert into public.resumes (id, user_id, file_path, file_name)
values (
  'db200000-0000-4000-8000-000000000001',
  'db100000-0000-4000-8000-000000000001',
  'db100000-0000-4000-8000-000000000001/test.pdf',
  'test.pdf'
);

insert into public.job (
  id, recruiter_id, title, description, location, status
)
values (
  'db300000-0000-4000-8000-000000000001',
  'db100000-0000-4000-8000-000000000002',
  'Reschedule Dismissal Test Job',
  'Disposable job for notification rescheduling tests',
  'Montreal, QC',
  'open'
);

-- The application insertion trigger checks auth.uid().
select set_config(
  'request.jwt.claims',
  '{"sub":"db100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

insert into public.applications (
  id, job_id, applicant_id, resume_id
)
values (
  'db400000-0000-4000-8000-000000000001',
  'db300000-0000-4000-8000-000000000001',
  'db100000-0000-4000-8000-000000000001',
  'db200000-0000-4000-8000-000000000001'
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
  'db500000-0000-4000-8000-000000000001',
  'db400000-0000-4000-8000-000000000001',
  'db100000-0000-4000-8000-000000000002',
  'db100000-0000-4000-8000-000000000001',
  now() + interval '7 days',
  now() + interval '2 days',
  'pending'
);

-- First reschedule creates the deadline notification.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"db100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);

-- 1.
select lives_ok(
  $$
    select public.reschedule_interview(
      'db500000-0000-4000-8000-000000000001',
      now() + interval '10 days',
      now() + interval '3 days'
    )
  $$,
  'owning recruiter can perform the first reschedule'
);

-- Switch to the applicant.
select set_config(
  'request.jwt.claims',
  '{"sub":"db100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

-- 2.
select is(
  (
    select count(*)::integer
    from public.notifications
    where interview_id = 'db500000-0000-4000-8000-000000000001'
      and type = 'interview_deadline'
  ),
  1,
  'first reschedule creates exactly one deadline notification'
);

-- Retain the original ID in transaction-local test state.
select set_config(
  'test.original_deadline_notification_id',
  coalesce(
    (
      select id::text
      from public.notifications
      where interview_id = 'db500000-0000-4000-8000-000000000001'
        and type = 'interview_deadline'
      order by id
      limit 1
    ),
    ''
  ),
  true
);

-- 3. Dismiss using the same three fields as the app.
with updated as (
  update public.notifications
  set dismissed_at = now(),
      is_read = true,
      read_at = now()
  where id = nullif(
    current_setting('test.original_deadline_notification_id'),
    ''
  )::uuid
  returning id
)
select is(
  (select count(*)::integer from updated),
  1,
  'applicant can dismiss the deadline notification'
);

-- 4. Establish that dismissal actually persisted before rescheduling.
select ok(
  (
    select dismissed_at = now()
       and is_read
       and read_at is not null
    from public.notifications
    where id = nullif(
      current_setting('test.original_deadline_notification_id'),
      ''
    )::uuid
  ),
  'deadline notification is dismissed and read before rescheduling'
);

-- The recruiter proposes a different date.
select set_config(
  'request.jwt.claims',
  '{"sub":"db100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);

-- 5.
select lives_ok(
  $$
    select public.reschedule_interview(
      'db500000-0000-4000-8000-000000000001',
      now() + interval '14 days',
      now() + interval '5 days'
    )
  $$,
  'owning recruiter can reschedule after notification dismissal'
);

-- Verify the restored notification as its recipient.
select set_config(
  'request.jwt.claims',
  '{"sub":"db100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

-- 6.
select is(
  (
    select id
    from public.notifications
    where interview_id = 'db500000-0000-4000-8000-000000000001'
      and type = 'interview_deadline'
    order by id
    limit 1
  ),
  nullif(
    current_setting('test.original_deadline_notification_id'),
    ''
  )::uuid,
  'rescheduling restores the same deadline notification'
);

-- 7.
select ok(
  (
    select dismissed_at is null
    from public.notifications
    where id = nullif(
      current_setting('test.original_deadline_notification_id'),
      ''
    )::uuid
  ),
  'rescheduling clears dismissed_at'
);

-- 8.
select is(
  (
    select is_read
    from public.notifications
    where id = nullif(
      current_setting('test.original_deadline_notification_id'),
      ''
    )::uuid
  ),
  false,
  'restored deadline notification is unread'
);

-- 9.
select ok(
  (
    select read_at is null
    from public.notifications
    where id = nullif(
      current_setting('test.original_deadline_notification_id'),
      ''
    )::uuid
  ),
  'rescheduling clears read_at'
);

-- 10.
select is(
  (
    select deadline_at
    from public.notifications
    where id = nullif(
      current_setting('test.original_deadline_notification_id'),
      ''
    )::uuid
  ),
  now() + interval '5 days',
  'restored notification uses the new response deadline'
);

-- 11.
select is(
  (
    select count(*)::integer
    from public.notifications
    where interview_id = 'db500000-0000-4000-8000-000000000001'
      and type = 'interview_deadline'
  ),
  1,
  'rescheduling does not duplicate the deadline notification'
);

reset role;

select * from finish();
rollback;