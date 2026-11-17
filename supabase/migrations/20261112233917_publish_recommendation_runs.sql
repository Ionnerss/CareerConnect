ALTER TABLE public.recommendation_results
  ALTER COLUMN skill_match DROP NOT NULL;

-- Only the server's service role may create runs and publish results.
GRANT SELECT, INSERT, UPDATE ON public.recommendation_runs TO service_role;
GRANT SELECT, INSERT ON public.recommendation_results TO service_role;

CREATE OR REPLACE FUNCTION public.publish_recommendation_run(
  p_run_id uuid,
  p_results jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_run public.recommendation_runs%ROWTYPE;
  v_role text;
  v_result jsonb;
  v_position integer;
  v_count integer;
  v_fit_count integer := 0;
  v_summary_count integer := 0;
  v_rank integer;
  v_score integer;
  v_match_score integer;
  v_job_id uuid;
  v_fit jsonb;
  v_skill_match jsonb;
  v_reasons jsonb;
  v_summary text;
BEGIN
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RAISE EXCEPTION 'Results must be an array'
      USING ERRCODE = '22023';
  END IF;

  v_count := jsonb_array_length(p_results);

  -- Lock the run and its owner while deciding whether it may publish.
  SELECT *
  INTO v_run
  FROM public.recommendation_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND OR v_run.status <> 'running' THEN
    RAISE EXCEPTION 'Run is not available for publication'
      USING ERRCODE = '22023';
  END IF;

  SELECT role
  INTO v_role
  FROM public.profiles
  WHERE id = v_run.user_id
  FOR UPDATE;

  IF v_role IS DISTINCT FROM 'job_seeker' THEN
    RAISE EXCEPTION 'Run owner is not a job seeker'
      USING ERRCODE = '22023';
  END IF;

  IF nullif(btrim(v_run.seeker_input_hash), '') IS NULL
     OR nullif(btrim(v_run.scoring_version), '') IS NULL THEN
    RAISE EXCEPTION 'Run version metadata is incomplete'
      USING ERRCODE = '22023';
  END IF;

  -- The profile lock serializes publication for this seeker. An older
  -- attempt cannot publish after a newer successful attempt.
  IF EXISTS (
    SELECT 1
    FROM public.recommendation_runs newer
    WHERE newer.user_id = v_run.user_id
      AND newer.status = 'succeeded'
      AND (newer.created_at, newer.id) > (v_run.created_at, v_run.id)
  ) THEN
    RAISE EXCEPTION 'A newer run has already succeeded'
      USING ERRCODE = '22023';
  END IF;

  -- A retry must not append rows left by an earlier attempt.
  IF EXISTS (
    SELECT 1
    FROM public.recommendation_results existing
    WHERE existing.run_id = p_run_id
  ) THEN
    RAISE EXCEPTION 'Run already has results'
      USING ERRCODE = '22023';
  END IF;

  FOR v_position IN 0 .. v_count - 1 LOOP
    v_result := p_results -> v_position;

    IF jsonb_typeof(v_result) <> 'object' THEN
      RAISE EXCEPTION 'Each result must be an object'
        USING ERRCODE = '22023';
    END IF;

    v_rank := (v_result ->> 'rank')::integer;
    v_score := (v_result ->> 'score')::integer;
    v_match_score := (v_result ->> 'match_score')::integer;
    v_job_id := (v_result ->> 'job_id')::uuid;
    v_fit := NULLIF(v_result -> 'fit', 'null'::jsonb);
    v_skill_match := NULLIF(v_result -> 'skill_match', 'null'::jsonb);
    v_reasons := v_result -> 'reasons';
    v_summary := v_result ->> 'summary';

    IF v_rank IS DISTINCT FROM v_position + 1
       OR v_score IS NULL OR v_score NOT BETWEEN 0 AND 100
       OR v_match_score IS NULL OR v_match_score NOT BETWEEN 0 AND 100
       OR v_job_id IS NULL
       OR jsonb_typeof(v_reasons) IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_reasons) = 0
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(v_reasons) AS reason(value)
         WHERE jsonb_typeof(reason.value) <> 'string'
            OR btrim(reason.value #>> '{}') = ''
       )
       OR (
         v_skill_match IS NOT NULL
         AND jsonb_typeof(v_skill_match) <> 'object'
       )
       OR (
         v_fit IS NOT NULL
         AND jsonb_typeof(v_fit) <> 'object'
       )
       OR (v_result ->> 'seeker_input_hash') IS DISTINCT FROM v_run.seeker_input_hash
       OR nullif(btrim(v_result ->> 'job_input_hash'), '') IS NULL
       OR (v_result ->> 'job_input_checked_at') IS NULL
    THEN
      RAISE EXCEPTION 'Invalid recommendation result'
        USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.job j
      WHERE j.id = v_job_id
        AND j.status = 'open'
    ) THEN
      RAISE EXCEPTION 'Recommendation job is not open'
        USING ERRCODE = '22023';
    END IF;

    IF v_fit IS NOT NULL THEN
      v_fit_count := v_fit_count + 1;
    END IF;

    IF v_summary IS NOT NULL THEN
      v_summary_count := v_summary_count + 1;
    END IF;

    INSERT INTO public.recommendation_results (
      run_id,
      job_id,
      rank,
      score,
      match_score,
      fit,
      fit_error,
      skill_match,
      reasons,
      summary,
      seeker_input_hash,
      job_input_hash,
      job_input_checked_at,
      fit_generated_at
    )
    VALUES (
      p_run_id,
      v_job_id,
      v_rank,
      v_score,
      v_match_score,
      v_fit,
      v_result ->> 'fit_error',
      v_skill_match,
      v_reasons,
      v_summary,
      v_run.seeker_input_hash,
      v_result ->> 'job_input_hash',
      (v_result ->> 'job_input_checked_at')::timestamptz,
      (v_result ->> 'fit_generated_at')::timestamptz
    );
  END LOOP;

  IF v_fit_count > 0
     AND (
       nullif(btrim(v_run.jev_model_version), '') IS NULL
       OR nullif(btrim(v_run.jev_prompt_version), '') IS NULL
     ) THEN
    RAISE EXCEPTION 'Jev version metadata is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_summary_count > 0
     AND (
       nullif(btrim(v_run.summary_model_version), '') IS NULL
       OR nullif(btrim(v_run.summary_prompt_version), '') IS NULL
     ) THEN
    RAISE EXCEPTION 'Summary version metadata is required'
      USING ERRCODE = '22023';
  END IF;

  -- Check what actually reached the table, including an empty result set.
  IF (
    SELECT count(*)
    FROM public.recommendation_results
    WHERE run_id = p_run_id
  ) <> v_count THEN
    RAISE EXCEPTION 'Published result count does not match'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.recommendation_runs
  SET status = 'succeeded',
      ranking_mode = CASE
        WHEN v_count = 0 THEN NULL
        WHEN v_fit_count = 0 THEN 'code_only'
        WHEN v_fit_count = v_count THEN 'ai'
        ELSE 'mixed'
      END,
      result_count = v_count,
      summary_count = v_summary_count,
      completed_at = clock_timestamp(),
      inputs_checked_at = clock_timestamp(),
      failure_code = NULL
  WHERE id = p_run_id;

  RETURN p_run_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.publish_recommendation_run(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.publish_recommendation_run(uuid, jsonb)
  TO service_role;