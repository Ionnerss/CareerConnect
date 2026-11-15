begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

-- Database fixtures. The auth trigger creates profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'd8100000-0000-4000-8000-000000000001',
    'recommendation-publication-seeker@example.com',
    '{"full_name":"Publication Test Seeker"}'::jsonb
  ),
  (
    'd8200000-0000-4000-8000-000000000001',
    'recommendation-publication-recruiter@example.com',
    '{"full_name":"Publication Test Recruiter"}'::jsonb
  );

update public.profiles
set role = 'recruiter'
where id = 'd8200000-0000-4000-8000-000000000001';

insert into public.job (
  id, recruiter_id, title, firm_name, location,
  work_mode, employment_type, required_skills,
  salary, experience, description, status
)
values
  (
    'd8300000-0000-4000-8000-000000000001',
    'd8200000-0000-4000-8000-000000000001',
    'Open test job',
    'Test company',
    'Montréal, QC',
    'On-site',
    'Full-time',
    'Java',
    50000,
    1,
    'An open posting for publication tests.',
    'open'
  ),
  (
    'd8300000-0000-4000-8000-000000000002',
    'd8200000-0000-4000-8000-000000000001',
    'Closed test job',
    'Test company',
    'Montréal, QC',
    'Hybrid',
    'Full-time',
    'SQL',
    55000,
    1,
    'A closed posting that must not be published.',
    'closed'
  );

-- Each run is created before generation starts. Explicit timestamps make
-- the older/newer ordering unambiguous in this test.
insert into public.recommendation_runs (
  id, user_id, status, seeker_input_hash, scoring_version,
  considered_jobs, started_at, created_at
)
values
  (
    'd8400000-0000-4000-8000-000000000001',
    'd8100000-0000-4000-8000-000000000001',
    'running', 'publication-seeker-hash', 'test-scoring-v1',
    0, now(), '2026-11-12 10:00:00+00'
  ),
  (
    'd8400000-0000-4000-8000-000000000002',
    'd8100000-0000-4000-8000-000000000001',
    'running', 'publication-seeker-hash', 'test-scoring-v1',
    1, now(), '2026-11-12 10:01:00+00'
  ),
  (
    'd8400000-0000-4000-8000-000000000003',
    'd8100000-0000-4000-8000-000000000001',
    'running', 'publication-seeker-hash', 'test-scoring-v1',
    2, now(), '2026-11-12 10:02:00+00'
  ),
  (
    'd8400000-0000-4000-8000-000000000004',
    'd8100000-0000-4000-8000-000000000001',
    'running', 'publication-seeker-hash', 'test-scoring-v1',
    0, now(), '2026-11-12 10:03:00+00'
  ),
  (
    'd8400000-0000-4000-8000-000000000005',
    'd8100000-0000-4000-8000-000000000001',
    'running', 'publication-seeker-hash', 'test-scoring-v1',
    0, now(), '2026-11-12 10:04:00+00'
  );

-- Case 1: a successful run may contain no recommendations.
set local role service_role;

select is(
  public.publish_recommendation_run(
    'd8400000-0000-4000-8000-000000000001',
    '[]'::jsonb
  ),
  'd8400000-0000-4000-8000-000000000001'::uuid,
  'the trusted role can publish an empty run'
);

reset role;

select is(
  (
    select result_count
    from public.recommendation_runs
    where id = 'd8400000-0000-4000-8000-000000000001'
      and status = 'succeeded'
      and ranking_mode is null
  ),
  0,
  'an empty success records zero results and no ranking mode'
);

-- Case 2: one valid result is saved with its historical count.
-- skill_match is null because the application type permits that value.
set local role service_role;

select is(
  public.publish_recommendation_run(
    'd8400000-0000-4000-8000-000000000002',
    '[
      {
        "job_id": "d8300000-0000-4000-8000-000000000001",
        "rank": 1,
        "score": 75,
        "match_score": 75,
        "fit": null,
        "fit_error": null,
        "skill_match": null,
        "reasons": ["Matching test skills"],
        "summary": null,
        "seeker_input_hash": "publication-seeker-hash",
        "job_input_hash": "open-job-hash",
        "job_input_checked_at": "2026-11-12T10:01:00Z",
        "fit_generated_at": null
      }
    ]'::jsonb
  ),
  'd8400000-0000-4000-8000-000000000002'::uuid,
  'the trusted role can publish one valid code-scored result'
);

reset role;

select is(
  (
    select result_count
    from public.recommendation_runs
    where id = 'd8400000-0000-4000-8000-000000000002'
      and status = 'succeeded'
      and ranking_mode = 'code_only'
  ),
  1,
  'the run records one published result'
);

select is(
  (
    select count(*)::integer
    from public.recommendation_results
    where run_id = 'd8400000-0000-4000-8000-000000000002'
      and job_id = 'd8300000-0000-4000-8000-000000000001'
      and skill_match is null
  ),
  1,
  'the result was saved, including a nullable skill match'
);

-- Case 3: the second job is closed. The first insert must roll back too.
set local role service_role;

select throws_ok(
  $$
    select public.publish_recommendation_run(
      'd8400000-0000-4000-8000-000000000003',
      '[
        {
          "job_id": "d8300000-0000-4000-8000-000000000001",
          "rank": 1,
          "score": 75,
          "match_score": 75,
          "fit": null,
          "skill_match": null,
          "reasons": ["Valid first result"],
          "seeker_input_hash": "publication-seeker-hash",
          "job_input_hash": "open-job-hash",
          "job_input_checked_at": "2026-11-12T10:02:00Z"
        },
        {
          "job_id": "d8300000-0000-4000-8000-000000000002",
          "rank": 2,
          "score": 70,
          "match_score": 70,
          "fit": null,
          "skill_match": null,
          "reasons": ["Must fail because the job is closed"],
          "seeker_input_hash": "publication-seeker-hash",
          "job_input_hash": "closed-job-hash",
          "job_input_checked_at": "2026-11-12T10:02:00Z"
        }
      ]'::jsonb
    )
  $$,
  '22023',
  null,
  'a closed second job rejects the entire publication'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.recommendation_results
    where run_id = 'd8400000-0000-4000-8000-000000000003'
  ),
  0,
  'the valid first result was rolled back'
);

select is(
  (
    select status
    from public.recommendation_runs
    where id = 'd8400000-0000-4000-8000-000000000003'
  ),
  'running',
  'the failed publication did not mark its run successful'
);

-- Case 4: a normal signed-in client cannot invoke the function.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"d8100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select throws_ok(
  $$
    select public.publish_recommendation_run(
      'd8400000-0000-4000-8000-000000000004',
      '[]'::jsonb
    )
  $$,
  '42501',
  null,
  'authenticated clients cannot publish runs'
);

reset role;

-- Case 5: the newer run succeeds before the older one finishes.
set local role service_role;

select is(
  public.publish_recommendation_run(
    'd8400000-0000-4000-8000-000000000005',
    '[]'::jsonb
  ),
  'd8400000-0000-4000-8000-000000000005'::uuid,
  'the newer run publishes successfully'
);

select throws_ok(
  $$
    select public.publish_recommendation_run(
      'd8400000-0000-4000-8000-000000000004',
      '[]'::jsonb
    )
  $$,
  '22023',
  null,
  'the older run cannot publish after a newer success'
);

reset role;

select is(
  (
    select id
    from public.recommendation_runs
    where user_id = 'd8100000-0000-4000-8000-000000000001'
      and status = 'succeeded'
    order by created_at desc, id desc
    limit 1
  ),
  'd8400000-0000-4000-8000-000000000005'::uuid,
  'the newest successful run remains current'
);

select * from finish();

rollback;