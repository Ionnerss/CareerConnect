SET local check_function_bodies = off;

CREATE POLICY "Require completed MFA for resume files" ON "storage"."objects"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (((bucket_id <> 'resumes'::text) OR COALESCE(( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed), false)))
  WITH CHECK (((bucket_id <> 'resumes'::text) OR COALESCE(( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed), false)));