SET local check_function_bodies = off;

DROP POLICY "Users can view and download cover letters c9hcw5_0" ON "storage"."objects";

CREATE POLICY "Users can view and download cover letters c9hcw5_0" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'cover_letters'::text) AND (EXISTS ( SELECT 1
   FROM public.applications a
  WHERE
    ((a.cover_letter_path = objects.name) AND ((storage.foldername(objects.name))[1] = (a.applicant_id)::text) AND ((storage.foldername(objects.name))[2] = (a.id)::text) AND
    ((a.applicant_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.job j
          WHERE ((j.id = a.job_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid)))))))))));

