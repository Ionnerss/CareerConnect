CREATE TABLE public.recommendation_refresh_state (
  user_id uuid PRIMARY KEY
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  requested_revision bigint NOT NULL DEFAULT 1
    CHECK (requested_revision > 0),

  requested_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.recommendation_refresh_state
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.recommendation_refresh_state
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
  ON public.recommendation_refresh_state
  TO service_role;

CREATE FUNCTION public.mark_recommendation_inputs_changed(
  p_user_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_revision bigint;
BEGIN
  -- Serialize changes for this owner and coordinate with
  -- profile deletion or role changes.
  SELECT role
  INTO v_role
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_role IS DISTINCT FROM 'job_seeker' THEN
    RAISE EXCEPTION 'Refresh owner must be an existing job seeker'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.recommendation_refresh_state AS refresh_state (
    user_id,
    requested_revision,
    requested_at
  )
  VALUES (
    p_user_id,
    1,
    clock_timestamp()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET requested_revision = refresh_state.requested_revision + 1,
      requested_at = clock_timestamp()
  RETURNING requested_revision INTO v_revision;

  RETURN v_revision;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.mark_recommendation_inputs_changed(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.mark_recommendation_inputs_changed(uuid)
  TO service_role;