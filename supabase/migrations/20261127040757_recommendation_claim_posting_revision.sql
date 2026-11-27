ALTER TABLE public.recommendation_refresh_state
  ADD COLUMN claimed_posting_revision bigint
    CHECK (claimed_posting_revision >= 0),
  ADD COLUMN completed_posting_revision bigint NOT NULL DEFAULT -1
    CHECK (completed_posting_revision >= -1);

-- Existing claims have no recorded posting snapshot.
-- Release them so the next worker can capture one safely.
UPDATE public.recommendation_refresh_state
SET claim_token = NULL,
    claimed_revision = NULL,
    lease_expires_at = NULL;

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

  -- Claims and publication use the same lock order:
  -- profile, refresh state, posting state.
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

  RETURN QUERY
  UPDATE public.recommendation_refresh_state AS refresh_state
  SET claim_token = gen_random_uuid(),
      claimed_revision = refresh_state.requested_revision,
      claimed_posting_revision = v_posting_revision,
      lease_expires_at =
        v_now + make_interval(secs => p_lease_seconds)
  WHERE refresh_state.user_id = p_user_id
  RETURNING
    refresh_state.claim_token,
    refresh_state.claimed_revision,
    refresh_state.lease_expires_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_recommendation_refresh_publication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_state public.recommendation_refresh_state%ROWTYPE;
  v_posting_revision bigint;
BEGIN
  -- Existing manual runs do not yet use refresh claims.
  IF NEW.refresh_claim_token IS NULL
     AND NEW.refresh_revision IS NULL THEN
    RETURN NEW;
  END IF;

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

  -- Hold a shared lock until publication commits.
  -- Posting revision changes must wait for this transaction.
  SELECT posting_state.revision
  INTO v_posting_revision
  FROM public.recommendation_posting_state AS posting_state
  WHERE posting_state.singleton = true
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recommendation posting state is missing';
  END IF;

  IF v_state.claimed_posting_revision
     IS DISTINCT FROM v_posting_revision THEN
    RAISE EXCEPTION 'Recommendation postings changed during processing'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.recommendation_refresh_state
  SET completed_revision = NEW.refresh_revision,
      completed_posting_revision = v_posting_revision,
      claim_token = NULL,
      claimed_revision = NULL,
      claimed_posting_revision = NULL,
      lease_expires_at = NULL
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.claim_recommendation_refresh(uuid, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.claim_recommendation_refresh(uuid, integer)
  TO service_role;

REVOKE ALL
  ON FUNCTION public.guard_recommendation_refresh_publication()
  FROM PUBLIC, anon, authenticated;