begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(3);

-- Creating auth users also creates their profiles through the
-- on_auth_user_created trigger.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'resume-test-a@example.com',
    '{"full_name":"Resume Test A"}'::jsonb
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'resume-test-b@example.com',
    '{"full_name":"Resume Test B"}'::jsonb
  );

insert into public.resumes (id, user_id, file_path, file_name)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111/a.pdf',
    'a.pdf'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222/b.pdf',
    'b.pdf'
  );

-- Simulate user A's authenticated request.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  auth.uid(),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'the test is running as user A'
);

select is(
  (select count(*)::integer
   from public.resumes
   where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1,
  'user A can read their own resume'
);

select is(
  (select count(*)::integer
   from public.resumes
   where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0,
  'user A cannot read user B’s resume'
);

select * from finish();
rollback;