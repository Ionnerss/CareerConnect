ALTER TABLE public.recommendation_runs
  ADD COLUMN refresh_claim_token uuid,
  ADD COLUMN refresh_revision bigint,

  ADD CONSTRAINT recommendation_runs_refresh_claim_check
    CHECK (
      (
        refresh_claim_token IS NULL
        AND refresh_revision IS NULL
      )
      OR
      (
        refresh_claim_token IS NOT NULL
        AND refresh_revision IS NOT NULL
        AND refresh_revision > 0
      )
    );

CREATE FUNCTION public.guard_recommendation_refresh_publication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_state public.recommendation_refresh_state%ROWTYPE;
BEGIN
  -- Existing manual runs do not yet use refresh claims.
  IF NEW.refresh_claim_token IS NULL
     AND NEW.refresh_revision IS NULL THEN
    RETURN NEW;
  END IF;

  -- Match the owner-then-state lock order used by claim and
  -- input-change functions.
  SELECT profile.role
  INTO v_role
  FROM public.profiles AS profile
  WHERE profile.id = NEW.user_id
  FOR UPDATE;

  IF v_role IS DISTINCT FROM 'job_seeker' THEN
    RAISE EXCEPTION 'Refresh owner must be an existing job seeker'
      USING ERRCODE = '22023';
  END IF;

  SELECT refresh_state.*
  INTO v_state
  FROM public.recommendation_refresh_state AS refresh_state
  WHERE refresh_state.user_id = NEW.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refresh state is missing'
      USING ERRCODE = '22023';
  END IF;

  IF v_state.claim_token IS DISTINCT FROM NEW.refresh_claim_token
     OR v_state.claimed_revision IS DISTINCT FROM NEW.refresh_revision THEN
    RAISE EXCEPTION 'Refresh claim is no longer owned by this run'
      USING ERRCODE = '22023';
  END IF;

  IF v_state.lease_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Refresh claim has expired'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.refresh_revision IS DISTINCT FROM v_state.requested_revision THEN
    RAISE EXCEPTION 'Recommendation inputs changed during processing'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.recommendation_refresh_state
  SET completed_revision = NEW.refresh_revision,
      claim_token = NULL,
      claimed_revision = NULL,
      lease_expires_at = NULL
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.guard_recommendation_refresh_publication()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_recommendation_refresh_publication
BEFORE INSERT OR UPDATE ON public.recommendation_runs
FOR EACH ROW
WHEN (NEW.status = 'succeeded')
EXECUTE FUNCTION public.guard_recommendation_refresh_publication();