SET local check_function_bodies = off;

CREATE TABLE "public"."applications" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_id"       uuid,
  "applicant_id" uuid,
  "resume_id"    uuid,
  "cover_letter" text,
  "status"       text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "applications_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."applications"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."job" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "recruiter_id"    uuid,
  "title"           text,
  "description"     text,
  "required_skills" text,
  "location"        text,
  "status"          text,
  "salary"          numeric,
  "firm_name"       text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "job_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."job"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"              uuid                     NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "full_name"       text,
  "role"            text                     NOT NULL DEFAULT 'job_seeker'::text,
  "bio"             text,
  "location"        text,
  "contact_email"   text,
  "avatar_path"     text,
  "background_path" text,
  CONSTRAINT "bio_size" CHECK ((char_length(bio) <= 1000)),
  CONSTRAINT "location_size" CHECK ((char_length(location) <= 150)),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."resumes" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "uploaded_at" timestamp with time zone NOT NULL DEFAULT now(),
  "file_path"   text                     NOT NULL,
  "file_name"   text                     NOT NULL,
  CONSTRAINT "resumes_pkey" PRIMARY KEY (id),
  "user_id"     uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."resumes"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

ALTER TABLE "public"."applications"
  ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."applications"
  ADD CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."job"
  ADD CONSTRAINT "job_recruiter_id_fkey" FOREIGN KEY (recruiter_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."applications"
  ADD CONSTRAINT "applications_resume_id_fkey" FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Job seekers and recruiters can view job postings" ON "public"."job"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Recruiters can create job postings" ON "public"."job"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((recruiter_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'recruiter'::text))))));

CREATE POLICY "Recruiters can update job postings" ON "public"."job"
  FOR UPDATE
  TO "authenticated"
  USING (((recruiter_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'recruiter'::text))))))
  WITH CHECK (((recruiter_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'recruiter'::text))))));

CREATE POLICY "Users can update own profile" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = id));

CREATE POLICY "Users can view own profile" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = id));

CREATE POLICY "Users can delete own profile images" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING
    (((bucket_id = 'profile-images'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (((storage.foldername(name))[2] = 'avatar'::text) OR
    ((storage.foldername(name))[2] = 'background'::text))));

CREATE POLICY "Users can select own profile images" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING
    (((bucket_id = 'profile-images'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (((storage.foldername(name))[2] = 'avatar'::text) OR
    ((storage.foldername(name))[2] = 'background'::text))));

CREATE POLICY "Users can upload own profile images" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((bucket_id = 'profile-images'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (((storage.foldername(name))[2] = 'avatar'::text) OR
    ((storage.foldername(name))[2] = 'background'::text))));

CREATE POLICY "Users manage own resume files i5g8va_0" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE POLICY "Users manage own resume files i5g8va_1" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE POLICY "Users manage own resume files i5g8va_2" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

COMMENT ON TABLE "public"."applications" IS 'All the applications made for each job posting';

COMMENT ON TABLE "public"."job" IS 'The jobs created by recruiters';

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."applications" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."applications" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."applications" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."applications" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."job" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job" TO "service_role";

REVOKE ALL ON TABLE "public"."profiles" FROM "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."profiles" TO "anon";

REVOKE ALL ON TABLE "public"."profiles" FROM "authenticated";

REVOKE ALL ("avatar_path") ON TABLE "public"."profiles" FROM "authenticated";

GRANT UPDATE ("avatar_path") ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ("background_path") ON TABLE "public"."profiles" FROM "authenticated";

GRANT UPDATE ("background_path") ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ("bio") ON TABLE "public"."profiles" FROM "authenticated";

GRANT UPDATE ("bio") ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ("contact_email") ON TABLE "public"."profiles" FROM "authenticated";

GRANT UPDATE ("contact_email") ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ("full_name") ON TABLE "public"."profiles" FROM "authenticated";

GRANT UPDATE ("full_name") ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ("location") ON TABLE "public"."profiles" FROM "authenticated";

GRANT UPDATE ("location") ON TABLE "public"."profiles" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."resumes" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."resumes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."resumes" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."resumes" TO "service_role";

ALTER TABLE "public"."resumes"
  ADD CONSTRAINT "resumes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE POLICY "Users can add own resumes" ON "public"."resumes"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can delete own resumes" ON "public"."resumes"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users can view own resumes" ON "public"."resumes"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

