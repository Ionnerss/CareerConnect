begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

-- Creating auth users also creates their profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'a8100000-0000-4000-8000-000000000001',
    'recommendation-test-a@example.com',
    '{"full_name":"Recommendation Test A"}'::jsonb
  ),
  (
    'a8200000-0000-4000-8000-000000000001',
    'recommendation-test-b@example.com',
    '{"full_name":"Recommendation Test B"}'::jsonb
  ),
  (
    'a8700000-0000-4000-8000-000000000001',
    'recommendation-test-recruiter@example.com',
    '{"full_name":"Recommendation Test Recruiter"}'::jsonb
  );

update public.profiles
set role = 'recruiter'
where id = 'a8700000-0000-4000-8000-000000000001';

-- Set up one recruiter-owned posting and one completed recommendation.
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
  'a8300000-0000-4000-8000-000000000001',
  'a8700000-0000-4000-8000-000000000001',
  'Test job',
  'Test company',
  'Montréal, QC',
  'On-site',
  'Full-time',
  'Java',
  50000,
  1,
  'A test posting for recommendation access.',
  'open'
);

insert into public.recommendation_runs (
  id,
  user_id,
  status,
  ranking_mode,
  seeker_input_hash,
  scoring_version,
  considered_jobs,
  result_count,
  summary_count,
  completed_at,
  inputs_checked_at
)
values (
  'a8400000-0000-4000-8000-000000000001',
  'a8100000-0000-4000-8000-000000000001',
  'succeeded',
  'code_only',
  'test-seeker-hash',
  'test-scoring-v1',
  1,
  1,
  0,
  now(),
  now()
);

insert into public.recommendation_results (
  id,
  run_id,
  job_id,
  rank,
  score,
  match_score,
  skill_match,
  reasons,
  seeker_input_hash,
  job_input_hash,
  job_input_checked_at
)
values (
  'a8500000-0000-4000-8000-000000000001',
  'a8400000-0000-4000-8000-000000000001',
  'a8300000-0000-4000-8000-000000000001',
  1,
  75,
  75,
  '{}'::jsonb,
  '["Matching test skills"]'::jsonb,
  'test-seeker-hash',
  'test-job-hash',
  now()
);

-- A has no verified MFA factor and is at AAL1.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a8100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  (select count(*)::integer from public.recommendation_runs),
  1,
  'A can read their own run without enrolled MFA'
);

select is(
  (select count(*)::integer from public.recommendation_results),
  1,
  'A can read their own result without enrolled MFA'
);

-- B cannot see either of A's rows.
select set_config(
  'request.jwt.claims',
  '{"sub":"a8200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  (select count(*)::integer from public.recommendation_runs),
  0,
  'B cannot read A’s run'
);

select is(
  (select count(*)::integer from public.recommendation_results),
  0,
  'B cannot read A’s result'
);

-- Install a verified factor for A as the database owner.
reset role;

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
  'a8600000-0000-4000-8000-000000000001',
  'a8100000-0000-4000-8000-000000000001',
  'Recommendation database test factor',
  'totp',
  'verified',
  now(),
  now(),
  'JBSWY3DPEHPK3PXP'
);

-- A has an enrolled factor but has not completed MFA in this session.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"a8100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  (select count(*)::integer from public.recommendation_runs),
  0,
  'A cannot read their run before completing enrolled MFA'
);

select is(
  (select count(*)::integer from public.recommendation_results),
  0,
  'A cannot read their result before completing enrolled MFA'
);

-- The same user completes MFA.
select set_config(
  'request.jwt.claims',
  '{"sub":"a8100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  (select count(*)::integer from public.recommendation_runs),
  1,
  'A can read their run at AAL2'
);

select is(
  (select count(*)::integer from public.recommendation_results),
  1,
  'A can read their result at AAL2'
);

-- Even the owner cannot write generated data using the authenticated role.
-- SQLSTATE 42501 means insufficient privilege.
select throws_ok(
  $$
    insert into public.recommendation_runs (
      user_id,
      seeker_input_hash,
      scoring_version
    )
    values (
      'a8100000-0000-4000-8000-000000000001',
      'another-hash',
      'test-scoring-v1'
    )
  $$,
  '42501'
);

select throws_ok(
  $$
    update public.recommendation_runs
    set status = 'failed'
    where id = 'a8400000-0000-4000-8000-000000000001'
  $$,
  '42501'
);

select throws_ok(
  $$
    delete from public.recommendation_runs
    where id = 'a8400000-0000-4000-8000-000000000001'
  $$,
  '42501'
);

select throws_ok(
  $$
    insert into public.recommendation_results (
      run_id,
      job_id,
      rank,
      score,
      match_score,
      skill_match,
      reasons,
      seeker_input_hash,
      job_input_hash,
      job_input_checked_at
    )
    values (
      'a8400000-0000-4000-8000-000000000001',
      'a8300000-0000-4000-8000-000000000001',
      2,
      70,
      70,
      '{}'::jsonb,
      '["Test reason"]'::jsonb,
      'test-seeker-hash',
      'test-job-hash',
      now()
    )
  $$,
  '42501'
);

select throws_ok(
  $$
    update public.recommendation_results
    set score = 100
    where id = 'a8500000-0000-4000-8000-000000000001'
  $$,
  '42501'
);

select throws_ok(
  $$
    delete from public.recommendation_results
    where id = 'a8500000-0000-4000-8000-000000000001'
  $$,
  '42501'
);

select * from finish();

rollback;