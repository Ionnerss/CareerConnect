ALTER TABLE public.recommendation_refresh_state
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),

  ADD COLUMN max_attempts integer NOT NULL DEFAULT 3
    CHECK (max_attempts BETWEEN 1 AND 10),

  ADD COLUMN attempted_seeker_revision bigint
    CHECK (attempted_seeker_revision > 0),

  ADD COLUMN attempted_posting_revision bigint
    CHECK (attempted_posting_revision >= 0),

  ADD COLUMN next_attempt_at timestamptz NOT NULL
    DEFAULT '-infinity'::timestamptz,

  ADD COLUMN last_failure_code text
    CHECK (
      last_failure_code IN (
        'generation_failed',
        'publication_failed',
        'load_failed'
      )
    );

CREATE OR REPLACE FUNCTION public.claim_recommendation_refresh(
  p_user_id uuid,
  p_lease_seconds integer
)
RETURNS TABLE (
  claim_token uuid,
  claimed_revision bigint,
  lease_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_state public.recommendation_refresh_state%ROWTYPE;
  v_posting_revision bigint;
  v_now timestamptz;
  v_inputs_changed boolean;
BEGIN
  IF p_lease_seconds IS NULL
     OR p_lease_seconds < 1
     OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'Lease duration must be between 1 and 3600 seconds'
      USING ERRCODE = '22023';
  END IF;

  SELECT profile.role
  INTO v_role
  FROM public.profiles AS profile
  WHERE profile.id = p_user_id
  FOR UPDATE;

  IF v_role IS DISTINCT FROM 'job_seeker' THEN
    RAISE EXCEPTION 'Refresh owner must be an existing job seeker'
      USING ERRCODE = '22023';
  END IF;

  SELECT refresh_state.*
  INTO v_state
  FROM public.recommendation_refresh_state AS refresh_state
  WHERE refresh_state.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT posting_state.revision
  INTO v_posting_revision
  FROM public.recommendation_posting_state AS posting_state
  WHERE posting_state.singleton = true
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recommendation posting state is missing';
  END IF;

  IF v_state.requested_revision <= v_state.completed_revision
     AND v_state.completed_posting_revision = v_posting_revision THEN
    RETURN;
  END IF;

  v_now := clock_timestamp();

  IF v_state.claim_token IS NOT NULL
     AND v_state.lease_expires_at > v_now THEN
    RETURN;
  END IF;

  v_inputs_changed :=
    v_state.attempted_seeker_revision
      IS DISTINCT FROM v_state.requested_revision
    OR
    v_state.attempted_posting_revision
      IS DISTINCT FROM v_posting_revision;

  IF NOT v_inputs_changed THEN
    IF v_state.attempt_count >= v_state.max_attempts
       OR v_state.next_attempt_at > v_now THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  UPDATE public.recommendation_refresh_state AS refresh_state
  SET claim_token = gen_random_uuid(),
      claimed_revision = refresh_state.requested_revision,
      claimed_posting_revision = v_posting_revision,
      lease_expires_at =
        v_now + make_interval(secs => p_lease_seconds),
      attempt_count = CASE
        WHEN v_inputs_changed THEN 1
        ELSE refresh_state.attempt_count + 1
      END,
      attempted_seeker_revision = refresh_state.requested_revision,
      attempted_posting_revision = v_posting_revision,
      next_attempt_at = '-infinity'::timestamptz,
      last_failure_code = NULL
  WHERE refresh_state.user_id = p_user_id
  RETURNING
    refresh_state.claim_token,
    refresh_state.claimed_revision,
    refresh_state.lease_expires_at;
END;
$function$;

CREATE FUNCTION public.fail_recommendation_refresh(
  p_claim_token uuid,
  p_failure_code text,
  p_retry_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_state public.recommendation_refresh_state%ROWTYPE;
BEGIN
  IF p_failure_code IS NULL
     OR p_failure_code NOT IN (
       'generation_failed',
       'publication_failed',
       'load_failed'
     ) THEN
    RAISE EXCEPTION 'Invalid recommendation refresh failure code'
      USING ERRCODE = '22023';
  END IF;

  IF p_retry_seconds IS NULL
     OR p_retry_seconds < 1
     OR p_retry_seconds > 3600 THEN
    RAISE EXCEPTION 'Retry delay must be between 1 and 3600 seconds'
      USING ERRCODE = '22023';
  END IF;

  -- Match publication's run-then-owner-then-state lock order.
  PERFORM run.id
  FROM public.recommendation_runs AS run
  WHERE run.refresh_claim_token = p_claim_token
  FOR UPDATE;

  SELECT refresh_state.user_id
  INTO v_user_id
  FROM public.recommendation_refresh_state AS refresh_state
  WHERE refresh_state.claim_token = p_claim_token;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM profile.id
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id
  FOR UPDATE;

  SELECT refresh_state.*
  INTO v_state
  FROM public.recommendation_refresh_state AS refresh_state
  WHERE refresh_state.user_id = v_user_id
  FOR UPDATE;

  -- Recheck after locking: ownership may have changed while waiting.
  IF NOT FOUND
     OR v_state.claim_token IS DISTINCT FROM p_claim_token THEN
    RETURN false;
  END IF;

  UPDATE public.recommendation_runs
  SET status = 'failed',
      failure_code = p_failure_code,
      completed_at = clock_timestamp()
  WHERE refresh_claim_token = p_claim_token
    AND status = 'running';

  UPDATE public.recommendation_refresh_state
  SET claim_token = NULL,
      claimed_revision = NULL,
      claimed_posting_revision = NULL,
      lease_expires_at = NULL,
      next_attempt_at =
        clock_timestamp() + make_interval(secs => p_retry_seconds),
      last_failure_code = p_failure_code
  WHERE user_id = v_user_id;

  RETURN true;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.claim_recommendation_refresh(uuid, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.claim_recommendation_refresh(uuid, integer)
  TO service_role;

REVOKE ALL
  ON FUNCTION public.fail_recommendation_refresh(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.fail_recommendation_refresh(uuid, text, integer)
  TO service_role;