begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(4);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'c8100000-0000-4000-8000-000000000001',
    'recommendation-retention-seeker@example.com',
    '{"full_name":"Retention Test Seeker"}'::jsonb
  ),
  (
    'c8200000-0000-4000-8000-000000000001',
    'recommendation-retention-recruiter@example.com',
    '{"full_name":"Retention Test Recruiter"}'::jsonb
  );

update public.profiles
set role = 'recruiter'
where id = 'c8200000-0000-4000-8000-000000000001';

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
  'c8300000-0000-4000-8000-000000000001',
  'c8200000-0000-4000-8000-000000000001',
  'Retention test job',
  'Test company',
  'Montréal, QC',
  'On-site',
  'Full-time',
  'Java',
  50000,
  1,
  'A posting used to test recommendation retention.',
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
  'c8400000-0000-4000-8000-000000000001',
  'c8100000-0000-4000-8000-000000000001',
  'succeeded',
  'code_only',
  'retention-seeker-hash',
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
  'c8500000-0000-4000-8000-000000000001',
  'c8400000-0000-4000-8000-000000000001',
  'c8300000-0000-4000-8000-000000000001',
  1,
  75,
  75,
  '{}'::jsonb,
  '["Test reason"]'::jsonb,
  'retention-seeker-hash',
  'retention-job-hash',
  now()
);

select is(
  (
    select count(*)::integer
    from public.recommendation_results
    where run_id = 'c8400000-0000-4000-8000-000000000001'
  ),
  1,
  'the completed run initially has one result'
);

delete from public.job
where id = 'c8300000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::integer
    from public.recommendation_results
    where run_id = 'c8400000-0000-4000-8000-000000000001'
  ),
  0,
  'deleting the job cascades to its recommendation result'
);

select is(
  (
    select result_count
    from public.recommendation_runs
    where id = 'c8400000-0000-4000-8000-000000000001'
  ),
  1,
  'result_count remains the historical published count'
);

select is(
  (
    select status
    from public.recommendation_runs
    where id = 'c8400000-0000-4000-8000-000000000001'
  ),
  'succeeded',
  'deleting a job does not erase the successful run'
);

select * from finish();

rollback;