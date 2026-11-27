ALTER TABLE public.recommendation_refresh_state
  ADD COLUMN manual_refresh_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN last_manual_refresh_at timestamptz;

CREATE FUNCTION public.request_recommendation_refresh()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_role text;
  v_state public.recommendation_refresh_state%ROWTYPE;
  v_has_state boolean;
  v_posting_revision bigint;
  v_exhausted boolean;
  v_now timestamptz;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT coalesce(private.careerconnect_mfa_allowed(), false) THEN
    RAISE EXCEPTION 'Complete two-factor authentication to continue'
      USING ERRCODE = '42501';
  END IF;

  SELECT profile.role
  INTO v_role
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id
  FOR UPDATE;

  IF v_role IS DISTINCT FROM 'job_seeker' THEN
    RAISE EXCEPTION 'Only job seekers can request recommendations'
      USING ERRCODE = '42501';
  END IF;

  SELECT refresh_state.*
  INTO v_state
  FROM public.recommendation_refresh_state AS refresh_state
  WHERE refresh_state.user_id = v_user_id
  FOR UPDATE;

  v_has_state := FOUND;
  v_now := clock_timestamp();

  IF v_has_state THEN
    -- Join existing work without invalidating its claim.
    IF v_state.claim_token IS NOT NULL
       AND v_state.lease_expires_at > v_now THEN
      UPDATE public.recommendation_refresh_state
      SET manual_refresh_pending = true,
          last_manual_refresh_at = CASE
            WHEN manual_refresh_pending THEN last_manual_refresh_at
            ELSE v_now
          END
      WHERE user_id = v_user_id;

      RETURN 'already_pending';
    END IF;

    SELECT posting_state.revision
    INTO v_posting_revision
    FROM public.recommendation_posting_state AS posting_state
    WHERE posting_state.singleton = true
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Recommendation posting state is missing';
    END IF;

    v_exhausted :=
      v_state.attempt_count >= v_state.max_attempts
      AND v_state.attempted_seeker_revision =
        v_state.requested_revision
      AND v_state.attempted_posting_revision = v_posting_revision;

    IF v_state.manual_refresh_pending
       AND NOT coalesce(v_exhausted, false) THEN
      RETURN 'already_pending';
    END IF;

    IF v_state.last_manual_refresh_at >
       v_now - interval '60 seconds' THEN
      RETURN 'rate_limited';
    END IF;
  END IF;

  -- A new manual request advances the revision. This gives an explicit
  -- retry fresh attempt accounting while retaining provider usage limits.
  PERFORM public.mark_recommendation_inputs_changed(v_user_id);

  UPDATE public.recommendation_refresh_state
  SET manual_refresh_pending = true,
      last_manual_refresh_at = v_now
  WHERE user_id = v_user_id;

  RETURN 'queued';
END;
$function$;

REVOKE ALL
  ON FUNCTION public.request_recommendation_refresh()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.request_recommendation_refresh()
  TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_recommendation_refresh_participation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Successful publication completes the manual request too.
    IF NEW.claim_token IS NULL
       AND NEW.completed_revision = NEW.requested_revision
       AND NEW.completed_posting_revision = (
         SELECT posting_state.revision
         FROM public.recommendation_posting_state AS posting_state
         WHERE posting_state.singleton = true
       ) THEN
      NEW.manual_refresh_pending := false;
    END IF;
  END IF;

  IF NEW.claim_token IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.claim_token IS NOT DISTINCT FROM OLD.claim_token THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Explicit manual requests are allowed with background refresh off.
  IF NEW.manual_refresh_pending THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.recommendation_refresh_preferences AS preference
    WHERE preference.user_id = NEW.user_id
      AND preference.enabled = false
  ) THEN
    RAISE EXCEPTION 'Background recommendation refresh is disabled'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_due_recommendation_refreshes(
  p_limit integer DEFAULT 25
)
RETURNS TABLE (user_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Refresh batch limit must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT refresh_state.user_id
  FROM public.recommendation_refresh_state AS refresh_state
  LEFT JOIN public.recommendation_refresh_preferences AS preference
    ON preference.user_id = refresh_state.user_id
  JOIN public.profiles AS profile
    ON profile.id = refresh_state.user_id
   AND profile.role = 'job_seeker'
  CROSS JOIN public.recommendation_posting_state AS posting_state
  WHERE posting_state.singleton = true
    AND (
      coalesce(preference.enabled, false)
      OR refresh_state.manual_refresh_pending
    )
    AND (
      refresh_state.requested_revision >
        refresh_state.completed_revision
      OR refresh_state.completed_posting_revision
        IS DISTINCT FROM posting_state.revision
    )
    AND (
      refresh_state.claim_token IS NULL
      OR refresh_state.lease_expires_at <= clock_timestamp()
    )
    AND (
      refresh_state.attempted_seeker_revision
        IS DISTINCT FROM refresh_state.requested_revision
      OR refresh_state.attempted_posting_revision
        IS DISTINCT FROM posting_state.revision
      OR (
        refresh_state.attempt_count < refresh_state.max_attempts
        AND refresh_state.next_attempt_at <= clock_timestamp()
      )
    )
  ORDER BY
    refresh_state.next_attempt_at,
    refresh_state.requested_at,
    refresh_state.user_id
  LIMIT p_limit;
END;
$function$;

REVOKE ALL
  ON FUNCTION private.guard_recommendation_refresh_participation()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL
  ON FUNCTION public.list_due_recommendation_refreshes(integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.list_due_recommendation_refreshes(integer)
  TO service_role;