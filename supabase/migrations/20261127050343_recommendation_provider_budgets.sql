CREATE TABLE public.recommendation_provider_policies (
  provider text PRIMARY KEY
    CHECK (provider IN ('jev', 'groq')),

  enabled boolean NOT NULL DEFAULT false,

  daily_call_limit integer NOT NULL DEFAULT 0
    CHECK (daily_call_limit >= 0),

  user_daily_call_limit integer NOT NULL DEFAULT 0
    CHECK (user_daily_call_limit >= 0),

  concurrent_call_limit integer NOT NULL DEFAULT 1
    CHECK (concurrent_call_limit BETWEEN 1 AND 20)
);

INSERT INTO public.recommendation_provider_policies (provider)
VALUES ('jev'), ('groq');

CREATE TABLE public.recommendation_provider_daily_usage (
  provider text NOT NULL
    REFERENCES public.recommendation_provider_policies(provider),

  usage_day date NOT NULL,

  calls integer NOT NULL DEFAULT 0
    CHECK (calls >= 0),

  PRIMARY KEY (provider, usage_day)
);

CREATE TABLE public.recommendation_provider_user_usage (
  provider text NOT NULL
    REFERENCES public.recommendation_provider_policies(provider),

  usage_day date NOT NULL,

  user_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  calls integer NOT NULL DEFAULT 0
    CHECK (calls >= 0),

  PRIMARY KEY (provider, usage_day, user_id)
);

CREATE TABLE public.recommendation_provider_call_leases (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  provider text NOT NULL
    REFERENCES public.recommendation_provider_policies(provider),

  user_id uuid NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,

  expires_at timestamptz NOT NULL
);

CREATE INDEX recommendation_provider_active_leases_idx
  ON public.recommendation_provider_call_leases (
    provider,
    expires_at
  );

ALTER TABLE public.recommendation_provider_policies
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recommendation_provider_daily_usage
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recommendation_provider_user_usage
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recommendation_provider_call_leases
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.recommendation_provider_policies,
  public.recommendation_provider_daily_usage,
  public.recommendation_provider_user_usage,
  public.recommendation_provider_call_leases
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON
  public.recommendation_provider_policies,
  public.recommendation_provider_daily_usage,
  public.recommendation_provider_user_usage,
  public.recommendation_provider_call_leases
TO service_role;

CREATE FUNCTION public.reserve_recommendation_provider_call(
  p_user_id uuid,
  p_provider text,
  p_lease_seconds integer DEFAULT 60
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_policy public.recommendation_provider_policies%ROWTYPE;
  v_now timestamptz;
  v_day date;
  v_global_calls integer;
  v_user_calls integer;
  v_active_calls bigint;
  v_token uuid;
BEGIN
  IF p_lease_seconds IS NULL
     OR p_lease_seconds < 1
     OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'Provider lease must be between 1 and 300 seconds'
      USING ERRCODE = '22023';
  END IF;

  -- Every reservation and release for this provider takes this lock.
  SELECT *
  INTO v_policy
  FROM public.recommendation_provider_policies
  WHERE provider = p_provider
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown recommendation provider'
      USING ERRCODE = '22023';
  END IF;

  IF NOT v_policy.enabled THEN
    RETURN NULL;
  END IF;

  PERFORM profile.id
  FROM public.profiles AS profile
  WHERE profile.id = p_user_id
    AND profile.role = 'job_seeker'
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_now := clock_timestamp();
  v_day := (v_now AT TIME ZONE 'UTC')::date;

  -- Remove expired reservations for this provider.
  DELETE FROM public.recommendation_provider_call_leases
  WHERE provider = p_provider
    AND expires_at <= v_now;

  SELECT count(*)
  INTO v_active_calls
  FROM public.recommendation_provider_call_leases
  WHERE provider = p_provider;

  IF v_active_calls >= v_policy.concurrent_call_limit THEN
    RETURN NULL;
  END IF;

  SELECT coalesce((
    SELECT usage.calls
    FROM public.recommendation_provider_daily_usage AS usage
    WHERE usage.provider = p_provider
      AND usage.usage_day = v_day
  ), 0)
  INTO v_global_calls;

  SELECT coalesce((
    SELECT usage.calls
    FROM public.recommendation_provider_user_usage AS usage
    WHERE usage.provider = p_provider
      AND usage.usage_day = v_day
      AND usage.user_id = p_user_id
  ), 0)
  INTO v_user_calls;

  IF v_global_calls >= v_policy.daily_call_limit
     OR v_user_calls >= v_policy.user_daily_call_limit THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.recommendation_provider_daily_usage AS usage (
    provider,
    usage_day,
    calls
  )
  VALUES (
    p_provider,
    v_day,
    1
  )
  ON CONFLICT (provider, usage_day) DO UPDATE
  SET calls = usage.calls + 1;

  INSERT INTO public.recommendation_provider_user_usage AS usage (
    provider,
    usage_day,
    user_id,
    calls
  )
  VALUES (
    p_provider,
    v_day,
    p_user_id,
    1
  )
  ON CONFLICT (provider, usage_day, user_id) DO UPDATE
  SET calls = usage.calls + 1;

  INSERT INTO public.recommendation_provider_call_leases (
    provider,
    user_id,
    expires_at
  )
  VALUES (
    p_provider,
    p_user_id,
    v_now + make_interval(secs => p_lease_seconds)
  )
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$function$;

CREATE FUNCTION public.release_recommendation_provider_call(
  p_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_provider text;
BEGIN
  SELECT lease.provider
  INTO v_provider
  FROM public.recommendation_provider_call_leases AS lease
  WHERE lease.token = p_token;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM policy.provider
  FROM public.recommendation_provider_policies AS policy
  WHERE policy.provider = v_provider
  FOR UPDATE;

  DELETE FROM public.recommendation_provider_call_leases
  WHERE token = p_token;

  RETURN FOUND;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.reserve_recommendation_provider_call(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL
  ON FUNCTION public.release_recommendation_provider_call(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.reserve_recommendation_provider_call(uuid, text, integer)
  TO service_role;

GRANT EXECUTE
  ON FUNCTION public.release_recommendation_provider_call(uuid)
  TO service_role;