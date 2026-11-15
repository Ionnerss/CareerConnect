begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(4);

-- Auth users create their corresponding profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'b8100000-0000-4000-8000-000000000001',
    'recommendation-constraints-seeker@example.com',
    '{"full_name":"Constraints Test Seeker"}'::jsonb
  ),
  (
    'b8200000-0000-4000-8000-000000000001',
    'recommendation-constraints-recruiter@example.com',
    '{"full_name":"Constraints Test Recruiter"}'::jsonb
  );

update public.profiles
set role = 'recruiter'
where id = 'b8200000-0000-4000-8000-000000000001';

-- Two valid jobs let us test duplicate rank separately from duplicate job.
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
values
  (
    'b8300000-0000-4000-8000-000000000001',
    'b8200000-0000-4000-8000-000000000001',
    'First test job',
    'Test company',
    'Montréal, QC',
    'On-site',
    'Full-time',
    'Java',
    50000,
    1,
    'First posting for recommendation constraints.',
    'open'
  ),
  (
    'b8300000-0000-4000-8000-000000000002',
    'b8200000-0000-4000-8000-000000000001',
    'Second test job',
    'Test company',
    'Montréal, QC',
    'Hybrid',
    'Full-time',
    'SQL',
    55000,
    1,
    'Second posting for recommendation constraints.',
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
  'b8400000-0000-4000-8000-000000000001',
  'b8100000-0000-4000-8000-000000000001',
  'succeeded',
  'code_only',
  'constraints-seeker-hash',
  'test-scoring-v1',
  2,
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
  'b8500000-0000-4000-8000-000000000001',
  'b8400000-0000-4000-8000-000000000001',
  'b8300000-0000-4000-8000-000000000001',
  1,
  75,
  75,
  '{}'::jsonb,
  '["Test reason"]'::jsonb,
  'constraints-seeker-hash',
  'first-job-hash',
  now()
);

-- 23503: foreign key violation.
select throws_ok(
  $$
    insert into public.recommendation_results (
      run_id, job_id, rank, score, match_score,
      skill_match, reasons,
      seeker_input_hash, job_input_hash, job_input_checked_at
    )
    values (
      'b8400000-0000-4000-8000-000000000099',
      'b8300000-0000-4000-8000-000000000002',
      2, 70, 70,
      '{}'::jsonb, '["Test reason"]'::jsonb,
      'constraints-seeker-hash', 'second-job-hash', now()
    )
  $$,
  '23503',
  null,
  'a result cannot reference a nonexistent run'
);

select throws_ok(
  $$
    insert into public.recommendation_results (
      run_id, job_id, rank, score, match_score,
      skill_match, reasons,
      seeker_input_hash, job_input_hash, job_input_checked_at
    )
    values (
      'b8400000-0000-4000-8000-000000000001',
      'b8300000-0000-4000-8000-000000000099',
      2, 70, 70,
      '{}'::jsonb, '["Test reason"]'::jsonb,
      'constraints-seeker-hash', 'missing-job-hash', now()
    )
  $$,
  '23503',
  null,
  'a result cannot reference a nonexistent job'
);

-- 23505: unique constraint violation.
-- Rank 2 is unused, so this tests duplicate job specifically.
select throws_ok(
  $$
    insert into public.recommendation_results (
      run_id, job_id, rank, score, match_score,
      skill_match, reasons,
      seeker_input_hash, job_input_hash, job_input_checked_at
    )
    values (
      'b8400000-0000-4000-8000-000000000001',
      'b8300000-0000-4000-8000-000000000001',
      2, 70, 70,
      '{}'::jsonb, '["Test reason"]'::jsonb,
      'constraints-seeker-hash', 'first-job-hash', now()
    )
  $$,
  '23505',
  null,
  'a job cannot appear twice in one run'
);

-- Job 2 is unused, so this tests duplicate rank specifically.
select throws_ok(
  $$
    insert into public.recommendation_results (
      run_id, job_id, rank, score, match_score,
      skill_match, reasons,
      seeker_input_hash, job_input_hash, job_input_checked_at
    )
    values (
      'b8400000-0000-4000-8000-000000000001',
      'b8300000-0000-4000-8000-000000000002',
      1, 70, 70,
      '{}'::jsonb, '["Test reason"]'::jsonb,
      'constraints-seeker-hash', 'second-job-hash', now()
    )
  $$,
  '23505',
  null,
  'two results in one run cannot share a rank'
);

select * from finish();

rollback;