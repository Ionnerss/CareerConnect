CREATE FUNCTION public.get_recommendation_refresh_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_role text;
  v_state public.recommendation_refresh_state%ROWTYPE;
  v_has_state boolean;
  v_background_enabled boolean;
  v_posting_revision bigint;
  v_stale boolean;
  v_same_inputs boolean;
  v_status text;
  v_generated_at timestamptz;
  v_completed_at timestamptz;
  v_checked_at timestamptz;
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
  WHERE profile.id = v_user_id;

  IF v_role IS DISTINCT FROM 'job_seeker' THEN
    RAISE EXCEPTION 'Only job seekers can read refresh status'
      USING ERRCODE = '42501';
  END IF;

  SELECT preference.enabled
  INTO v_background_enabled
  FROM public.recommendation_refresh_preferences AS preference
  WHERE preference.user_id = v_user_id;

  v_background_enabled := coalesce(v_background_enabled, false);

  SELECT refresh_state.*
  INTO v_state
  FROM public.recommendation_refresh_state AS refresh_state
  WHERE refresh_state.user_id = v_user_id;

  v_has_state := FOUND;

  SELECT posting_state.revision
  INTO v_posting_revision
  FROM public.recommendation_posting_state AS posting_state
  WHERE posting_state.singleton = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recommendation posting state is missing';
  END IF;

  SELECT
    run.content_generated_at,
    run.completed_at,
    run.inputs_checked_at
  INTO
    v_generated_at,
    v_completed_at,
    v_checked_at
  FROM public.recommendation_runs AS run
  WHERE run.user_id = v_user_id
    AND run.status = 'succeeded'
  ORDER BY run.created_at DESC, run.id DESC
  LIMIT 1;

  IF v_has_state THEN
    v_stale :=
      v_state.requested_revision > v_state.completed_revision
      OR v_state.completed_posting_revision
        IS DISTINCT FROM v_posting_revision;

    v_same_inputs := coalesce(
      v_state.attempted_seeker_revision = v_state.requested_revision
      AND v_state.attempted_posting_revision = v_posting_revision,
      false
    );
  ELSE
    v_stale := NULL;
    v_same_inputs := false;
  END IF;

  v_status := CASE
    WHEN NOT v_has_state THEN
      'never_requested'

    WHEN v_state.claim_token IS NOT NULL
      AND v_state.lease_expires_at > clock_timestamp() THEN
      'running'

    WHEN NOT v_background_enabled
      AND NOT v_state.manual_refresh_pending THEN
      'disabled'

    WHEN NOT v_stale THEN
      'idle'

    WHEN v_same_inputs
      AND v_state.attempt_count >= v_state.max_attempts THEN
      'failed'

    WHEN v_same_inputs
      AND v_state.next_attempt_at > clock_timestamp() THEN
      'retry_wait'

    ELSE
      'queued'
  END;

  RETURN jsonb_build_object(
    'status', v_status,
    'stale', v_stale,
    'background_enabled', v_background_enabled,
    'manual_pending',
      coalesce(v_state.manual_refresh_pending, false),
    'attempt_count',
      CASE WHEN v_same_inputs THEN v_state.attempt_count ELSE 0 END,
    'max_attempts', coalesce(v_state.max_attempts, 3),
    'next_attempt_at',
      CASE
        WHEN v_status = 'retry_wait' THEN v_state.next_attempt_at
        ELSE NULL
      END,
    'last_failure_code',
      CASE
        WHEN v_same_inputs THEN v_state.last_failure_code
        ELSE NULL
      END,
    'generated_at', coalesce(v_generated_at, v_completed_at),
    'checked_at', v_checked_at
  );
END;
$function$;

REVOKE ALL
  ON FUNCTION public.get_recommendation_refresh_status()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.get_recommendation_refresh_status()
  TO authenticated;