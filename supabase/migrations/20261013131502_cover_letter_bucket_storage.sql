SET local check_function_bodies = off;

ALTER TABLE "public"."applications"
  DROP COLUMN "cover_letter";

ALTER TABLE "public"."applications"
  ADD COLUMN "cover_letter_path" text;

ALTER TABLE "public"."applications"
  ALTER COLUMN "applicant_id" SET NOT NULL;

ALTER TABLE "public"."applications"
  ALTER COLUMN "job_id" SET NOT NULL;

ALTER TABLE "public"."applications"
  ALTER COLUMN "resume_id" SET NOT NULL;

ALTER TABLE "public"."applications"
  ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "public"."job"
  ALTER COLUMN "description" SET NOT NULL;

ALTER TABLE "public"."job"
  ALTER COLUMN "location" SET NOT NULL;

ALTER TABLE "public"."job"
  ALTER COLUMN "recruiter_id" SET NOT NULL;

ALTER TABLE "public"."job"
  ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "public"."job"
  ALTER COLUMN "title" SET NOT NULL;

ALTER TABLE "public"."applications"
  ALTER COLUMN "status" SET DEFAULT 'applied'::text;

ALTER TABLE "public"."job"
  ALTER COLUMN "status" SET DEFAULT 'open'::text;

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

CREATE OR REPLACE FUNCTION public.validate_application_resume()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
    IF NEW.applicant_id IS DISTINCT FROM (SELECT auth.uid()) THEN
        RAISE EXCEPTION
            'You can only submit applications for yourself.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.resumes AS r
        WHERE r.id = NEW.resume_id
          AND r.user_id = NEW.applicant_id
          AND r.archived_at IS NULL
    ) THEN
        RAISE EXCEPTION
            'You must select your own active resume.';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."validate_application_resume"() FROM PUBLIC, "authenticated";

CREATE TRIGGER validate_application_resume_trigger
  BEFORE INSERT OR UPDATE OF resume_id, applicant_id ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_application_resume();

CREATE POLICY "Remove a cover letter c9hcw5_0" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'cover_letters'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.applications a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[2]) AND (a.applicant_id = auth.uid()))))));

CREATE POLICY "Remove a cover letter c9hcw5_1" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'cover_letters'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.applications a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[2]) AND (a.applicant_id = auth.uid()))))));

CREATE POLICY "Replace or rename cover letter c9hcw5_0" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING (((bucket_id = 'cover_letters'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.applications a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[2]) AND (a.applicant_id = auth.uid()))))));

CREATE POLICY "Replace or rename cover letter c9hcw5_1" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'cover_letters'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.applications a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[2]) AND (a.applicant_id = auth.uid()))))));

CREATE POLICY "Users can view and download cover letters c9hcw5_0" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'cover_letters'::text) AND (EXISTS ( SELECT 1
   FROM public.applications a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[2]) AND ((a.applicant_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.job j
          WHERE ((j.id = a.job_id) AND (j.recruiter_id = auth.uid()))))))))));

CREATE POLICY "job_seekers can upload their cover letters  c9hcw5_0" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'cover_letters'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.applications a
  WHERE (((a.id)::text = (storage.foldername(objects.name))[2]) AND (a.applicant_id = auth.uid()))))));

GRANT EXECUTE ON FUNCTION "public"."validate_application_resume"() TO "anon";

REVOKE ALL ON FUNCTION "public"."validate_application_resume"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_application_resume"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_application_resume"() TO "service_role";

