-- Recommendation generation attempts.
CREATE TABLE public.recommendation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  ranking_mode text
    CHECK (ranking_mode IN ('ai', 'mixed', 'code_only')),

  -- Identifies the inputs and scoring implementation used for this run.
  seeker_input_hash text NOT NULL,
  scoring_version text NOT NULL,
  jev_model_version text,
  jev_prompt_version text,
  summary_model_version text,
  summary_prompt_version text,

  considered_jobs integer NOT NULL DEFAULT 0
    CHECK (considered_jobs >= 0),
  result_count integer
    CHECK (result_count >= 0),
  summary_count integer
    CHECK (summary_count >= 0),
  failure_code text,

  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  -- When the job/profile inputs used by this result were checked.
  inputs_checked_at timestamptz,

  CONSTRAINT recommendation_runs_completion_check CHECK (
    (
      status = 'succeeded'
      AND completed_at IS NOT NULL
      AND inputs_checked_at IS NOT NULL
      AND result_count IS NOT NULL
      AND summary_count IS NOT NULL
      AND summary_count <= result_count
      AND failure_code IS NULL
      AND (
        (result_count = 0 AND ranking_mode IS NULL)
        OR (result_count > 0 AND ranking_mode IS NOT NULL)
      )
    )
    OR (
      status <> 'succeeded'
      AND ranking_mode IS NULL
      AND result_count IS NULL
      AND summary_count IS NULL
    )
  )
);

-- One recommended job within one generation attempt.
CREATE TABLE public.recommendation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL
    REFERENCES public.recommendation_runs(id) ON DELETE CASCADE,
  job_id uuid NOT NULL
    REFERENCES public.job(id) ON DELETE CASCADE,

  rank integer NOT NULL CHECK (rank > 0),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  match_score integer NOT NULL CHECK (match_score BETWEEN 0 AND 100),

  -- NULL means Jev did not produce a usable rating for this job.
  fit jsonb,
  fit_error text,
  skill_match jsonb NOT NULL,
  reasons jsonb NOT NULL
    CHECK (jsonb_typeof(reasons) = 'array'),
  summary text,

  -- A result can reuse a successful rating only when these and the
  -- run's model/prompt versions still describe the current inputs.
  seeker_input_hash text NOT NULL,
  job_input_hash text NOT NULL,
  job_input_checked_at timestamptz NOT NULL,
  fit_generated_at timestamptz,

  CONSTRAINT recommendation_results_unique_job
    UNIQUE (run_id, job_id),
  CONSTRAINT recommendation_results_unique_rank
    UNIQUE (run_id, rank),
  CONSTRAINT recommendation_results_fit_check CHECK (
    (fit IS NULL AND fit_generated_at IS NULL)
    OR (fit IS NOT NULL AND fit_generated_at IS NOT NULL AND fit_error IS NULL)
  )
);

CREATE INDEX recommendation_runs_latest_success_idx
  ON public.recommendation_runs (user_id, created_at DESC, id DESC)
  WHERE status = 'succeeded';

CREATE INDEX recommendation_runs_pending_idx
  ON public.recommendation_runs (created_at, id)
  WHERE status IN ('pending', 'running');

CREATE INDEX recommendation_results_run_rank_idx
  ON public.recommendation_results (run_id, rank);

-- Future cache lookup: find prior ratings for this user's job.
CREATE INDEX recommendation_results_job_run_idx
  ON public.recommendation_results (job_id, run_id);

ALTER TABLE public.recommendation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_results ENABLE ROW LEVEL SECURITY;

-- New public-schema tables must not inherit broad client privileges.
REVOKE ALL ON public.recommendation_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.recommendation_results FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.recommendation_runs TO authenticated;
GRANT SELECT ON public.recommendation_results TO authenticated;

CREATE POLICY "Job seekers read own recommendation runs"
  ON public.recommendation_runs
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT private.careerconnect_mfa_allowed())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.role = 'job_seeker'
    )
  );

CREATE POLICY "Job seekers read own recommendation results"
  ON public.recommendation_results
  FOR SELECT TO authenticated
  USING (
    (SELECT private.careerconnect_mfa_allowed())
    AND EXISTS (
      SELECT 1
      FROM public.recommendation_runs r
      WHERE r.id = run_id
        AND r.user_id = (SELECT auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = r.user_id AND p.role = 'job_seeker'
        )
    )
  );