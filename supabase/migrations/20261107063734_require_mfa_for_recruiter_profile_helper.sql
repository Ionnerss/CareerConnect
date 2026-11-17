CREATE OR REPLACE FUNCTION public.recruiter_can_view_profile (
  profile_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  SELECT
    COALESCE(
      (SELECT private.careerconnect_mfa_allowed()),
      false
    )
    AND EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.job j ON j.id = a.job_id
      WHERE a.applicant_id = profile_id
        AND j.recruiter_id = (SELECT auth.uid())
    );
$function$;