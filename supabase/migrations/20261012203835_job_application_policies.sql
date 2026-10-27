ALTER TABLE "public"."applications"
  DROP CONSTRAINT "applications_applicant_id_fkey";

ALTER TABLE "public"."applications"
  DROP CONSTRAINT "applications_job_id_fkey";

ALTER TABLE "public"."job"
  DROP CONSTRAINT "job_recruiter_id_fkey";

ALTER TABLE "public"."resumes"
  ADD COLUMN "archived_at" timestamp WITH time zone;

ALTER TABLE "public"."applications"
  ADD CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."applications"
  ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."job"
  ADD CONSTRAINT "job_recruiter_id_fkey" FOREIGN KEY (recruiter_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE POLICY "Job seekers and recruiters can view applications for each job " ON "public"."applications"
  FOR SELECT
  TO "authenticated"
  USING ((((applicant_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'job_seeker'::text))))) OR ((EXISTS ( SELECT 1
   FROM public.job j
  WHERE ((j.id = applications.job_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'recruiter'::text)))))));

CREATE POLICY "Job seekers can submit their application " ON "public"."applications"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((applicant_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'job_seeker'::text))))));

CREATE POLICY "Job seekers can withdraw their application" ON "public"."applications"
  FOR DELETE
  TO "authenticated"
  USING (((applicant_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'job_seeker'::text))))));

CREATE POLICY "Recruiters can change application status" ON "public"."applications"
  FOR UPDATE
  TO "authenticated"
  USING (((EXISTS ( SELECT 1
   FROM public.job j
  WHERE ((j.id = applications.job_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'recruiter'::text))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM public.job j
  WHERE ((j.id = applications.job_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'recruiter'::text))))));

CREATE POLICY "Recruiters can delete their job posting" ON "public"."job"
  FOR DELETE
  TO "authenticated"
  USING (((recruiter_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'recruiter'::text))))));

COMMENT ON COLUMN "public"."resumes"."archived_at" IS 'To keep track of resumes that are still in history of applications if the user wants to delete the resume from the profile.';

REVOKE ALL ON TABLE "public"."applications" FROM "authenticated";

REVOKE ALL ("status") ON TABLE "public"."applications" FROM "authenticated";

GRANT UPDATE ("status") ON TABLE "public"."applications" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."applications" TO "authenticated";

REVOKE ALL ON TABLE "public"."job" FROM "authenticated";

REVOKE ALL ("description") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("description") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("firm_name") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("firm_name") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("location") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("location") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("required_skills") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("required_skills") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("salary") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("salary") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("status") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("status") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("title") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("title") ON TABLE "public"."job" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."job" TO "authenticated";

