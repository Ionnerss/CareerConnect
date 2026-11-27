-- Education changes.

CREATE TRIGGER recommendation_education_inserted
AFTER INSERT ON public.profile_education
FOR EACH ROW
EXECUTE FUNCTION private.mark_recommendation_profile_change();

CREATE TRIGGER recommendation_education_updated
AFTER UPDATE OF
  profile_id,
  school,
  degree,
  field_of_study,
  start_date,
  end_date,
  description
ON public.profile_education
FOR EACH ROW
WHEN (
  ROW(
    OLD.profile_id,
    OLD.school,
    OLD.degree,
    OLD.field_of_study,
    OLD.start_date,
    OLD.end_date,
    OLD.description
  )
  IS DISTINCT FROM
  ROW(
    NEW.profile_id,
    NEW.school,
    NEW.degree,
    NEW.field_of_study,
    NEW.start_date,
    NEW.end_date,
    NEW.description
  )
)
EXECUTE FUNCTION private.mark_recommendation_profile_change();

CREATE TRIGGER recommendation_education_deleted
AFTER DELETE ON public.profile_education
FOR EACH ROW
EXECUTE FUNCTION private.mark_recommendation_profile_change();

-- Experience changes.

CREATE TRIGGER recommendation_experience_inserted
AFTER INSERT ON public.profile_experience
FOR EACH ROW
EXECUTE FUNCTION private.mark_recommendation_profile_change();

CREATE TRIGGER recommendation_experience_updated
AFTER UPDATE OF
  profile_id,
  company_name,
  job_role,
  start_date,
  end_date,
  description
ON public.profile_experience
FOR EACH ROW
WHEN (
  ROW(
    OLD.profile_id,
    OLD.company_name,
    OLD.job_role,
    OLD.start_date,
    OLD.end_date,
    OLD.description
  )
  IS DISTINCT FROM
  ROW(
    NEW.profile_id,
    NEW.company_name,
    NEW.job_role,
    NEW.start_date,
    NEW.end_date,
    NEW.description
  )
)
EXECUTE FUNCTION private.mark_recommendation_profile_change();

CREATE TRIGGER recommendation_experience_deleted
AFTER DELETE ON public.profile_experience
FOR EACH ROW
EXECUTE FUNCTION private.mark_recommendation_profile_change();

-- Preference changes, including saves through INSERT ... ON CONFLICT.

CREATE TRIGGER recommendation_preferences_inserted
AFTER INSERT ON public.profile_preferences
FOR EACH ROW
EXECUTE FUNCTION private.mark_recommendation_profile_change();

CREATE TRIGGER recommendation_preferences_updated
AFTER UPDATE OF
  profile_id,
  desired_role,
  desired_position,
  desired_salary,
  work_mode
ON public.profile_preferences
FOR EACH ROW
WHEN (
  ROW(
    OLD.profile_id,
    OLD.desired_role,
    OLD.desired_position,
    OLD.desired_salary,
    OLD.work_mode
  )
  IS DISTINCT FROM
  ROW(
    NEW.profile_id,
    NEW.desired_role,
    NEW.desired_position,
    NEW.desired_salary,
    NEW.work_mode
  )
)
EXECUTE FUNCTION private.mark_recommendation_profile_change();

CREATE TRIGGER recommendation_preferences_deleted
AFTER DELETE ON public.profile_preferences
FOR EACH ROW
EXECUTE FUNCTION private.mark_recommendation_profile_change();