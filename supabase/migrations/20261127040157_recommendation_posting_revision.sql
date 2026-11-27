CREATE TABLE public.recommendation_posting_state (
  singleton boolean PRIMARY KEY DEFAULT true
    CHECK (singleton),

  revision bigint NOT NULL DEFAULT 0
    CHECK (revision >= 0),

  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO public.recommendation_posting_state (singleton)
VALUES (true);

ALTER TABLE public.recommendation_posting_state
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.recommendation_posting_state
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.recommendation_posting_state
  TO service_role;

CREATE FUNCTION private.advance_recommendation_posting_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.recommendation_posting_state
  SET revision = revision + 1,
      changed_at = clock_timestamp()
  WHERE singleton = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recommendation posting state is missing';
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL
  ON FUNCTION private.advance_recommendation_posting_revision()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER recommendation_open_job_inserted
AFTER INSERT ON public.job
FOR EACH ROW
WHEN (NEW.status = 'open')
EXECUTE FUNCTION private.advance_recommendation_posting_revision();

CREATE TRIGGER recommendation_open_job_updated
AFTER UPDATE ON public.job
FOR EACH ROW
WHEN (
  (OLD.status = 'open' OR NEW.status = 'open')
  AND
  ROW(
    OLD.id,
    OLD.recruiter_id,
    OLD.title,
    OLD.firm_name,
    OLD.location,
    OLD.work_mode,
    OLD.employment_type,
    OLD.required_skills,
    OLD.salary,
    OLD.experience,
    OLD.description,
    OLD.status,
    OLD.created_at
  )
  IS DISTINCT FROM
  ROW(
    NEW.id,
    NEW.recruiter_id,
    NEW.title,
    NEW.firm_name,
    NEW.location,
    NEW.work_mode,
    NEW.employment_type,
    NEW.required_skills,
    NEW.salary,
    NEW.experience,
    NEW.description,
    NEW.status,
    NEW.created_at
  )
)
EXECUTE FUNCTION private.advance_recommendation_posting_revision();

CREATE TRIGGER recommendation_open_job_deleted
AFTER DELETE ON public.job
FOR EACH ROW
WHEN (OLD.status = 'open')
EXECUTE FUNCTION private.advance_recommendation_posting_revision();