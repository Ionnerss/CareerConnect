CREATE TABLE public.recommendation_refresh_preferences (
  user_id uuid PRIMARY KEY
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.recommendation_refresh_preferences
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.recommendation_refresh_preferences
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.recommendation_refresh_preferences
  TO authenticated, service_role;

CREATE POLICY "Seekers read own refresh preferences"
  ON public.recommendation_refresh_preferences
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT private.careerconnect_mfa_allowed())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = user_id
        AND profile.role = 'job_seeker'
    )
  );

CREATE FUNCTION public.set_recommendation_background_refresh(
  p_enabled boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_role text;
  v_previous_enabled boolean;
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

  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'Enabled must be true or false'
      USING ERRCODE = '22023';
  END IF;

  SELECT profile.role
  INTO v_role
  FROM public.profiles AS profile
  WHERE profile.id = v_user_id
  FOR UPDATE;

  IF v_role IS DISTINCT FROM 'job_seeker' THEN
    RAISE EXCEPTION 'Only job seekers can configure background refresh'
      USING ERRCODE = '42501';
  END IF;

  SELECT preference.enabled
  INTO v_previous_enabled
  FROM public.recommendation_refresh_preferences AS preference
  WHERE preference.user_id = v_user_id
  FOR UPDATE;

  -- Repeated saves must not invalidate work or reset retry allowances.
  IF FOUND AND v_previous_enabled = p_enabled THEN
    RETURN p_enabled;
  END IF;

  INSERT INTO public.recommendation_refresh_preferences (
    user_id,
    enabled,
    updated_at
  )
  VALUES (
    v_user_id,
    p_enabled,
    clock_timestamp()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      updated_at = EXCLUDED.updated_at;

  IF p_enabled THEN
    PERFORM public.mark_recommendation_inputs_changed(v_user_id);
  ELSE
    -- Invalidate in-flight work and release its claim.
    -- Existing successful recommendations remain readable.
    UPDATE public.recommendation_refresh_state
    SET requested_revision = requested_revision + 1,
        requested_at = clock_timestamp(),
        claim_token = NULL,
        claimed_revision = NULL,
        claimed_posting_revision = NULL,
        lease_expires_at = NULL
    WHERE user_id = v_user_id;
  END IF;

  RETURN p_enabled;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.set_recommendation_background_refresh(boolean)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.set_recommendation_background_refresh(boolean)
  TO authenticated;

-- Prevent issuing a new claim after an explicit opt-out.
CREATE FUNCTION private.guard_recommendation_refresh_participation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.claim_token IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.claim_token IS NOT DISTINCT FROM OLD.claim_token THEN
      RETURN NEW;
    END IF;
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

REVOKE ALL
  ON FUNCTION private.guard_recommendation_refresh_participation()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_recommendation_refresh_participation
BEFORE INSERT OR UPDATE ON public.recommendation_refresh_state
FOR EACH ROW
EXECUTE FUNCTION private.guard_recommendation_refresh_participation();

CREATE FUNCTION public.list_due_recommendation_refreshes(
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
  JOIN public.recommendation_refresh_preferences AS preference
    ON preference.user_id = refresh_state.user_id
   AND preference.enabled = true
  JOIN public.profiles AS profile
    ON profile.id = refresh_state.user_id
   AND profile.role = 'job_seeker'
  CROSS JOIN public.recommendation_posting_state AS posting_state
  WHERE posting_state.singleton = true
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
  ON FUNCTION public.list_due_recommendation_refreshes(integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.list_due_recommendation_refreshes(integer)
  TO service_role;