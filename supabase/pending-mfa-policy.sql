-- Dashboard deployment script for #90. Apply in the Supabase SQL editor, then
-- record the remote change using the team's `supabase db pull` workflow.
-- Do not run `db push` or commit this file as a generated migration.
-- Requires private.careerconnect_mfa_allowed() from 20261101054516.

-- Each restrictive policy ANDs the current permissive ownership/role policies.
-- Keep profiles_public and public job SELECT accessible as they are intentionally public.
DO $policy$
DECLARE protected_table text;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'profiles', 'applications', 'profile_skills', 'profile_education',
    'profile_experience', 'profile_preferences', 'profile_preference_languages',
    'profile_projects', 'profile_project_links', 'profile_project_images',
    'job_requirements', 'candidate_evaluations'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.careerconnect_mfa_allowed())) WITH CHECK ((SELECT private.careerconnect_mfa_allowed()))',
      'Require completed MFA for account data', protected_table
    );
  END LOOP;
END $policy$;

-- Public job browsing stays public; only recruiter changes require MFA.
CREATE POLICY "Require completed MFA for job insert" ON public.job
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.careerconnect_mfa_allowed()));
CREATE POLICY "Require completed MFA for job update" ON public.job
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((SELECT private.careerconnect_mfa_allowed()))
  WITH CHECK ((SELECT private.careerconnect_mfa_allowed()));
CREATE POLICY "Require completed MFA for job delete" ON public.job
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT private.careerconnect_mfa_allowed()));

-- Cover letters and project images are private. Profile images are public;
-- prevent unverified account mutations to that public bucket.
CREATE POLICY "Require completed MFA for private file access" ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id NOT IN ('cover_letters', 'project-images') OR COALESCE((SELECT private.careerconnect_mfa_allowed()), false))
  WITH CHECK (bucket_id NOT IN ('cover_letters', 'project-images') OR COALESCE((SELECT private.careerconnect_mfa_allowed()), false));

CREATE POLICY "Require completed MFA for image insert" ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'profile-images' OR COALESCE((SELECT private.careerconnect_mfa_allowed()), false));
CREATE POLICY "Require completed MFA for image update" ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'profile-images' OR COALESCE((SELECT private.careerconnect_mfa_allowed()), false))
  WITH CHECK (bucket_id <> 'profile-images' OR COALESCE((SELECT private.careerconnect_mfa_allowed()), false));
CREATE POLICY "Require completed MFA for image delete" ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id <> 'profile-images' OR COALESCE((SELECT private.careerconnect_mfa_allowed()), false));
