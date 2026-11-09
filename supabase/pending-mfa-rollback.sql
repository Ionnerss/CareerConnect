-- Policy-only rollback plan for these committed migrations:
--   20261101054516_require_mfa_for_resumes.sql
--   20261101074321_require_mfa_for_resume_storage.sql
--   20261101094954_require_mfa_for_account_data.sql
--
-- REVIEW ONLY. Do not execute as part of testing.
-- This removes their restrictive MFA policies. It does not revert
-- application checks, function changes, or existing ownership policies.
-- Prepare a reviewed forward rollback migration for an actual release.

DO $rollback$
DECLARE
  protected_table text;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'applications',
    'candidate_evaluations',
    'job_requirements',
    'profile_education',
    'profile_experience',
    'profile_preference_languages',
    'profile_preferences',
    'profile_project_images',
    'profile_project_links',
    'profile_projects',
    'profile_skills',
    'profiles'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Require completed MFA for account data',
      protected_table
    );
  END LOOP;
END;
$rollback$;

DROP POLICY IF EXISTS "Require completed MFA for resume access"
ON public.resumes;

DROP POLICY IF EXISTS "Require completed MFA for job insert"
ON public.job;

DROP POLICY IF EXISTS "Require completed MFA for job update"
ON public.job;

DROP POLICY IF EXISTS "Require completed MFA for job delete"
ON public.job;

DROP POLICY IF EXISTS "Require completed MFA for resume files"
ON storage.objects;

DROP POLICY IF EXISTS "Require completed MFA for private file access"
ON storage.objects;

DROP POLICY IF EXISTS "Require completed MFA for image insert"
ON storage.objects;

DROP POLICY IF EXISTS "Require completed MFA for image update"
ON storage.objects;

DROP POLICY IF EXISTS "Require completed MFA for image delete"
ON storage.objects;