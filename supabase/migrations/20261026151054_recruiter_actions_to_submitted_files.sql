SET local check_function_bodies = off;

CREATE POLICY "Recruiters can view submitted resume metadata" ON "public"."resumes"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.applications a
     JOIN public.job j ON ((j.id = a.job_id)))
  WHERE ((a.resume_id = resumes.id) AND (a.applicant_id = resumes.user_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Recruiters can read submitted resume files" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'resumes'::text) AND (EXISTS ( SELECT 1
   FROM ((public.resumes r
     JOIN public.applications a ON ((a.resume_id = r.id)))
     JOIN public.job j ON ((j.id = a.job_id)))
  WHERE
    ((r.file_path = objects.name) AND (a.applicant_id = r.user_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid)) AND ((storage.foldername(objects.name))[1] =
    (r.user_id)::text))))));

