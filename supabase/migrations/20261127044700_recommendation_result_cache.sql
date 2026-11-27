ALTER TABLE public.recommendation_runs
  ADD COLUMN input_fingerprint text
    CHECK (
      input_fingerprint IS NULL
      OR input_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  ADD COLUMN content_generated_at timestamptz;

CREATE FUNCTION public.reuse_recommendation_run(
  p_run_id uuid,
  p_summary_count integer,
  p_max_age_seconds integer DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_run public.recommendation_runs%ROWTYPE;
  v_source public.recommendation_runs%ROWTYPE;
  v_generated_at timestamptz;
  v_results jsonb;
  v_count bigint;
BEGIN
  IF p_summary_count IS NULL
     OR p_summary_count < 0
     OR p_summary_count > 10 THEN
    RAISE EXCEPTION 'Summary count must be between 0 and 10'
      USING ERRCODE = '22023';
  END IF;

  IF p_max_age_seconds IS NULL
     OR p_max_age_seconds < 1
     OR p_max_age_seconds > 86400 THEN
    RAISE EXCEPTION 'Cache age must be between 1 and 86400 seconds'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_run
  FROM public.recommendation_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND OR v_run.status <> 'running' THEN
    RAISE EXCEPTION 'Run is not available for cache reuse'
      USING ERRCODE = '22023';
  END IF;

  IF v_run.input_fingerprint IS NULL
     OR v_run.refresh_claim_token IS NULL THEN
    RETURN false;
  END IF;

  -- Coordinate with publication for this owner.
  PERFORM profile.id
  FROM public.profiles AS profile
  WHERE profile.id = v_run.user_id
  FOR UPDATE;

  SELECT *
  INTO v_source
  FROM public.recommendation_runs
  WHERE user_id = v_run.user_id
    AND status = 'succeeded'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_source.input_fingerprint
       IS DISTINCT FROM v_run.input_fingerprint
     OR v_source.seeker_input_hash
       IS DISTINCT FROM v_run.seeker_input_hash
     OR ROW(
       v_source.scoring_version,
       v_source.jev_model_version,
       v_source.jev_prompt_version,
       v_source.summary_model_version,
       v_source.summary_prompt_version
     ) IS DISTINCT FROM ROW(
       v_run.scoring_version,
       v_run.jev_model_version,
       v_run.jev_prompt_version,
       v_run.summary_model_version,
       v_run.summary_prompt_version
     ) THEN
    RETURN false;
  END IF;

  v_generated_at :=
    coalesce(v_source.content_generated_at, v_source.completed_at);

  IF v_generated_at IS NULL
     OR v_generated_at > clock_timestamp()
     OR v_generated_at <
       clock_timestamp() - make_interval(secs => p_max_age_seconds) THEN
    RETURN false;
  END IF;

  -- Avoid indefinitely reusing degraded provider output.
  IF v_source.result_count > 0 AND (
    v_source.ranking_mode IS DISTINCT FROM 'ai'
    OR v_source.summary_count <
      least(p_summary_count, v_source.result_count)
  ) THEN
    RETURN false;
  END IF;

  SELECT
    count(*),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'job_id', result.job_id,
          'rank', result.rank,
          'score', result.score,
          'match_score', result.match_score,
          'fit', result.fit,
          'fit_error', result.fit_error,
          'skill_match', result.skill_match,
          'reasons', result.reasons,
          'summary', result.summary,
          'seeker_input_hash', result.seeker_input_hash,
          'job_input_hash', result.job_input_hash,
          'job_input_checked_at', clock_timestamp(),
          'fit_generated_at', result.fit_generated_at
        )
        ORDER BY result.rank
      ),
      '[]'::jsonb
    )
  INTO v_count, v_results
  FROM public.recommendation_results AS result
  WHERE result.run_id = v_source.id;

  -- A deleted job may have removed historical result rows.
  IF v_count <> v_source.result_count THEN
    RETURN false;
  END IF;

  UPDATE public.recommendation_runs
  SET content_generated_at = v_generated_at
  WHERE id = p_run_id;

  -- Reuse still goes through all current publication guards.
  PERFORM public.publish_recommendation_run(p_run_id, v_results);

  RETURN true;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.reuse_recommendation_run(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.reuse_recommendation_run(uuid, integer, integer)
  TO service_role;