CREATE FUNCTION private.mark_recommendation_application_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner_ids uuid[];
  v_owner_id uuid;
  v_role text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_owner_ids := ARRAY[NEW.applicant_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_owner_ids := ARRAY[OLD.applicant_id];
  ELSE
    v_owner_ids := ARRAY[OLD.applicant_id, NEW.applicant_id];
  END IF;

  FOR v_owner_id IN
    SELECT DISTINCT owner_id
    FROM unnest(v_owner_ids) AS owners(owner_id)
    WHERE owner_id IS NOT NULL
    ORDER BY owner_id
  LOOP
    SELECT profile.role
    INTO v_role
    FROM public.profiles AS profile
    WHERE profile.id = v_owner_id
    FOR UPDATE;

    IF FOUND AND v_role = 'job_seeker' THEN
      PERFORM public.mark_recommendation_inputs_changed(v_owner_id);
    END IF;
  END LOOP;

  RETURN NULL;
END;
$function$;

REVOKE ALL
  ON FUNCTION private.mark_recommendation_application_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER recommendation_application_inserted
AFTER INSERT ON public.applications
FOR EACH ROW
EXECUTE FUNCTION private.mark_recommendation_application_change();

CREATE TRIGGER recommendation_application_updated
AFTER UPDATE OF applicant_id, job_id ON public.applications
FOR EACH ROW
WHEN (
  ROW(OLD.applicant_id, OLD.job_id)
  IS DISTINCT FROM
  ROW(NEW.applicant_id, NEW.job_id)
)
EXECUTE FUNCTION private.mark_recommendation_application_change();

CREATE TRIGGER recommendation_application_deleted
AFTER DELETE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION private.mark_recommendation_application_change();