-- Dashboard-only rollback for pending-mfa-policy.sql.
-- Apply deliberately, then record the resulting remote schema with `db pull`.
DO $rollback$
DECLARE protected_table text;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'profiles', 'applications', 'profile_skills', 'profile_education',
    'profile_experience', 'profile_preferences', 'profile_preference_languages',
    'profile_projects', 'profile_project_links', 'profile_project_images',
    'job_requirements', 'candidate_evaluations'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
      'Require completed MFA for account data', protected_table);
  END LOOP;
END $rollback$;
DROP POLICY IF EXISTS "Require completed MFA for job insert" ON public.job;
DROP POLICY IF EXISTS "Require completed MFA for job update" ON public.job;
DROP POLICY IF EXISTS "Require completed MFA for job delete" ON public.job;
DROP POLICY IF EXISTS "Require completed MFA for private file access" ON storage.objects;
DROP POLICY IF EXISTS "Require completed MFA for image insert" ON storage.objects;
DROP POLICY IF EXISTS "Require completed MFA for image update" ON storage.objects;
DROP POLICY IF EXISTS "Require completed MFA for image delete" ON storage.objects;
