CREATE FUNCTION private.mark_recommendation_profile_change()
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
  IF TG_TABLE_NAME = 'profiles' THEN
    v_owner_ids := ARRAY[NEW.id];
  ELSIF TG_OP = 'INSERT' THEN
    v_owner_ids := ARRAY[NEW.profile_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_owner_ids := ARRAY[OLD.profile_id];
  ELSE
    -- Handle an ownership change as a change for both profiles.
    v_owner_ids := ARRAY[OLD.profile_id, NEW.profile_id];
  END IF;

  -- Lock distinct owners in a consistent order.
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

    -- Skip recruiters and profiles disappearing during deletion.
    IF FOUND AND v_role = 'job_seeker' THEN
      PERFORM public.mark_recommendation_inputs_changed(v_owner_id);
    END IF;
  END LOOP;

  -- These are AFTER triggers, so the return value is ignored.
  RETURN NULL;
END;
$function$;

REVOKE ALL
  ON FUNCTION private.mark_recommendation_profile_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER recommendation_location_changed
AFTER UPDATE OF location ON public.profiles
FOR EACH ROW
WHEN (OLD.location IS DISTINCT FROM NEW.location)
EXECUTE FUNCTION private.mark_recommendation_profile_change();

CREATE TRIGGER recommendation_skill_inserted
AFTER INSERT ON public.profile_skills
FOR EACH ROW
EXECUTE FUNCTION private.mark_recommendation_profile_change();

CREATE TRIGGER recommendation_skill_updated
AFTER UPDATE OF profile_id, name, proficiency ON public.profile_skills
FOR EACH ROW
WHEN (
  ROW(OLD.profile_id, OLD.name, OLD.proficiency)
  IS DISTINCT FROM
  ROW(NEW.profile_id, NEW.name, NEW.proficiency)
)
EXECUTE FUNCTION private.mark_recommendation_profile_change();

CREATE TRIGGER recommendation_skill_deleted
AFTER DELETE ON public.profile_skills
FOR EACH ROW
EXECUTE FUNCTION private.mark_recommendation_profile_change();