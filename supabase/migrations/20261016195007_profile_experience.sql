SET local check_function_bodies = off;

CREATE TABLE "public"."profile_experience" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "profile_id"   uuid                     NOT NULL,
  "company_name" text                     NOT NULL,
  "job_role"     text                     NOT NULL,
  "start_date"   date                     NOT NULL,
  "end_date"     date,
  "description"  text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profile_experience_company_name_check" CHECK (((company_name ~ '[^[:space:]]'::text) AND (char_length(company_name) <= 200))),
  CONSTRAINT "profile_experience_dates_check" CHECK (((end_date IS NULL) OR (end_date >= start_date))),
  CONSTRAINT "profile_experience_description_word_limit"
    CHECK
    (((description IS NULL) OR (cardinality(regexp_split_to_array(regexp_replace(description, '^[[:space:]]+|[[:space:]]+$'::text, ''::text, 'g'::text), '[[:space:]]+'::text)) <=
    500))),
  CONSTRAINT "profile_experience_job_role_check" CHECK (((job_role ~ '[^[:space:]]'::text) AND (char_length(job_role) <= 200))),
  CONSTRAINT "profile_experience_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profile_experience"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."profile_experience" FROM "anon";

CREATE OR REPLACE FUNCTION public.recruiter_can_view_profile (
  profile_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
     select exists (
       select 1
       from public.applications a
       join public.job j on j.id = a.job_id
       where a.applicant_id = profile_id
         and j.recruiter_id = (select auth.uid())
     );
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

ALTER TABLE "public"."profile_experience"
  ADD CONSTRAINT "profile_experience_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX profile_experience_profile_id_idx ON public.profile_experience USING btree (profile_id);

CREATE POLICY "Users can add own experience" ON "public"."profile_experience"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can delete own experience" ON "public"."profile_experience"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can update own experience" ON "public"."profile_experience"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can view own experience" ON "public"."profile_experience"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

REVOKE ALL ON TABLE "public"."profile_experience" FROM "authenticated";

REVOKE ALL ("company_name") ON TABLE "public"."profile_experience" FROM "authenticated";

GRANT INSERT ("company_name"), UPDATE ("company_name") ON TABLE "public"."profile_experience" TO "authenticated";

REVOKE ALL ("description") ON TABLE "public"."profile_experience" FROM "authenticated";

GRANT INSERT ("description"), UPDATE ("description") ON TABLE "public"."profile_experience" TO "authenticated";

REVOKE ALL ("end_date") ON TABLE "public"."profile_experience" FROM "authenticated";

GRANT INSERT ("end_date"), UPDATE ("end_date") ON TABLE "public"."profile_experience" TO "authenticated";

REVOKE ALL ("job_role") ON TABLE "public"."profile_experience" FROM "authenticated";

GRANT INSERT ("job_role"), UPDATE ("job_role") ON TABLE "public"."profile_experience" TO "authenticated";

REVOKE ALL ("profile_id") ON TABLE "public"."profile_experience" FROM "authenticated";

GRANT INSERT ("profile_id") ON TABLE "public"."profile_experience" TO "authenticated";

REVOKE ALL ("start_date") ON TABLE "public"."profile_experience" FROM "authenticated";

GRANT INSERT ("start_date"), UPDATE ("start_date") ON TABLE "public"."profile_experience" TO "authenticated";

GRANT DELETE, SELECT ON TABLE "public"."profile_experience" TO "authenticated";

REVOKE ALL ON TABLE "public"."profile_experience" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_experience" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_experience" TO "service_role";

