CREATE FUNCTION public.recover_recommendation_refreshes(
  p_limit integer DEFAULT 25,
  p_retry_seconds integer DEFAULT 60
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_candidate record;
  v_run_id uuid;
  v_state public.recommendation_refresh_state%ROWTYPE;
  v_has_state boolean;
  v_recovered integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Recovery limit must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;

  IF p_retry_seconds IS NULL
     OR p_retry_seconds < 1
     OR p_retry_seconds > 3600 THEN
    RAISE EXCEPTION 'Retry delay must be between 1 and 3600 seconds'
      USING ERRCODE = '22023';
  END IF;

  FOR v_candidate IN
    SELECT candidates.claim_token, candidates.user_id
    FROM (
      -- Expired claims, including claims with no reserved run.
      SELECT
        refresh_state.claim_token,
        refresh_state.user_id
      FROM public.recommendation_refresh_state AS refresh_state
      WHERE refresh_state.claim_token IS NOT NULL
        AND refresh_state.lease_expires_at <= clock_timestamp()

      UNION

      -- Running runs whose claim is expired or no longer current.
      SELECT
        run.refresh_claim_token AS claim_token,
        run.user_id
      FROM public.recommendation_runs AS run
      WHERE run.status = 'running'
        AND run.refresh_claim_token IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.recommendation_refresh_state AS refresh_state
          WHERE refresh_state.user_id = run.user_id
            AND refresh_state.claim_token = run.refresh_claim_token
            AND refresh_state.lease_expires_at > clock_timestamp()
        )
    ) AS candidates
    ORDER BY candidates.claim_token, candidates.user_id
    LIMIT p_limit
  LOOP
    -- Follow publication's run-then-owner-then-state lock order.
    SELECT run.id
    INTO v_run_id
    FROM public.recommendation_runs AS run
    WHERE run.refresh_claim_token = v_candidate.claim_token
    FOR UPDATE SKIP LOCKED;

    -- If a run exists but was locked, leave it to a later sweep.
    IF NOT FOUND AND EXISTS (
      SELECT 1
      FROM public.recommendation_runs AS run
      WHERE run.refresh_claim_token = v_candidate.claim_token
    ) THEN
      CONTINUE;
    END IF;

    PERFORM profile.id
    FROM public.profiles AS profile
    WHERE profile.id = v_candidate.user_id
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT refresh_state.*
    INTO v_state
    FROM public.recommendation_refresh_state AS refresh_state
    WHERE refresh_state.user_id = v_candidate.user_id
    FOR UPDATE SKIP LOCKED;

    v_has_state := FOUND;

    IF NOT v_has_state AND EXISTS (
      SELECT 1
      FROM public.recommendation_refresh_state AS refresh_state
      WHERE refresh_state.user_id = v_candidate.user_id
    ) THEN
      CONTINUE;
    END IF;

    IF v_has_state
       AND v_state.claim_token = v_candidate.claim_token THEN
      -- Recheck expiry after acquiring locks.
      IF v_state.lease_expires_at > clock_timestamp() THEN
        CONTINUE;
      END IF;

      IF public.fail_recommendation_refresh(
        v_candidate.claim_token,
        'generation_failed',
        p_retry_seconds
      ) THEN
        v_recovered := v_recovered + 1;
      END IF;
    ELSE
      -- The claim was replaced or removed. Only fail the old run.
      UPDATE public.recommendation_runs
      SET status = 'failed',
          failure_code = 'generation_failed',
          completed_at = clock_timestamp()
      WHERE refresh_claim_token = v_candidate.claim_token
        AND status = 'running';

      IF FOUND THEN
        v_recovered := v_recovered + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_recovered;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.recover_recommendation_refreshes(integer, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.recover_recommendation_refreshes(integer, integer)
  TO service_role;