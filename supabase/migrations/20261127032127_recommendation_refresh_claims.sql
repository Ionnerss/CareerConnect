ALTER TABLE public.recommendation_refresh_state
  ADD COLUMN completed_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN claim_token uuid,
  ADD COLUMN claimed_revision bigint,
  ADD COLUMN lease_expires_at timestamptz,

  ADD CONSTRAINT recommendation_refresh_completed_revision_check
    CHECK (
      completed_revision >= 0
      AND completed_revision <= requested_revision
    ),

  ADD CONSTRAINT recommendation_refresh_claim_check
    CHECK (
      (
        claim_token IS NULL
        AND claimed_revision IS NULL
        AND lease_expires_at IS NULL
      )
      OR
      (
        claim_token IS NOT NULL
        AND claimed_revision IS NOT NULL
        AND lease_expires_at IS NOT NULL
        AND claimed_revision > completed_revision
        AND claimed_revision <= requested_revision
      )
    );

CREATE FUNCTION public.claim_recommendation_refresh(
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
  v_now timestamptz;
BEGIN
  IF p_lease_seconds IS NULL
     OR p_lease_seconds < 1
     OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'Lease duration must be between 1 and 3600 seconds'
      USING ERRCODE = '22023';
  END IF;

  -- Match the lock order used when recording input changes:
  -- owner first, then refresh state.
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

  -- No recorded input changes means there is no work to claim.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_state.requested_revision <= v_state.completed_revision THEN
    RETURN;
  END IF;

  -- Read the clock after acquiring locks, since waiting for a lock
  -- may have consumed part or all of an existing lease.
  v_now := clock_timestamp();

  IF v_state.claim_token IS NOT NULL
     AND v_state.lease_expires_at > v_now THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.recommendation_refresh_state AS refresh_state
  SET claim_token = gen_random_uuid(),
      claimed_revision = refresh_state.requested_revision,
      lease_expires_at =
        v_now + make_interval(secs => p_lease_seconds)
  WHERE refresh_state.user_id = p_user_id
  RETURNING
    refresh_state.claim_token,
    refresh_state.claimed_revision,
    refresh_state.lease_expires_at;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.claim_recommendation_refresh(uuid, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.claim_recommendation_refresh(uuid, integer)
  TO service_role;