DROP TRIGGER recommendation_education_updated
  ON public.profile_education;

CREATE TRIGGER recommendation_education_updated
AFTER UPDATE OF
  profile_id,
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
    OLD.degree,
    OLD.field_of_study,
    OLD.start_date,
    OLD.end_date,
    OLD.description
  )
  IS DISTINCT FROM
  ROW(
    NEW.profile_id,
    NEW.degree,
    NEW.field_of_study,
    NEW.start_date,
    NEW.end_date,
    NEW.description
  )
)
EXECUTE FUNCTION private.mark_recommendation_profile_change();


DROP TRIGGER recommendation_experience_updated
  ON public.profile_experience;

CREATE TRIGGER recommendation_experience_updated
AFTER UPDATE OF
  profile_id,
  job_role,
  start_date,
  end_date,
  description
ON public.profile_experience
FOR EACH ROW
WHEN (
  ROW(
    OLD.profile_id,
    OLD.job_role,
    OLD.start_date,
    OLD.end_date,
    OLD.description
  )
  IS DISTINCT FROM
  ROW(
    NEW.profile_id,
    NEW.job_role,
    NEW.start_date,
    NEW.end_date,
    NEW.description
  )
)
EXECUTE FUNCTION private.mark_recommendation_profile_change();