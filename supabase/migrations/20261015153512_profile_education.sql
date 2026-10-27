SET local check_function_bodies = off;

CREATE TABLE "public"."profile_education" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "profile_id"     uuid                     NOT NULL,
  "school"         text                     NOT NULL,
  "degree"         text                     NOT NULL,
  "field_of_study" text,
  "start_date"     date                     NOT NULL,
  "end_date"       date,
  "description"    text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profile_education_dates_check" CHECK (((end_date IS NULL) OR (end_date >= start_date))),
  CONSTRAINT "profile_education_degree_check" CHECK (((degree ~ '[^[:space:]]'::text) AND (char_length(degree) <= 200))),
  CONSTRAINT "profile_education_description_word_limit"
    CHECK
    (((description IS NULL) OR (cardinality(regexp_split_to_array(regexp_replace(description, '^[[:space:]]+|[[:space:]]+$'::text, ''::text, 'g'::text), '[[:space:]]+'::text)) <=
    500))),
  CONSTRAINT "profile_education_field_of_study_check" CHECK (((field_of_study IS NULL) OR ((field_of_study ~ '[^[:space:]]'::text) AND (char_length(field_of_study) <= 200)))),
  CONSTRAINT "profile_education_pkey" PRIMARY KEY (id),
  CONSTRAINT "profile_education_school_check" CHECK (((school ~ '[^[:space:]]'::text) AND (char_length(school) <= 200)))
);

ALTER TABLE "public"."profile_education"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."profile_education" FROM "anon";

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

ALTER TABLE "public"."profile_education"
  ADD CONSTRAINT "profile_education_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX profile_education_profile_id_idx ON public.profile_education USING btree (profile_id);

CREATE POLICY "Users can add own education" ON "public"."profile_education"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can delete own education" ON "public"."profile_education"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can update own education" ON "public"."profile_education"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can view own education" ON "public"."profile_education"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

REVOKE ALL ON TABLE "public"."profile_education" FROM "authenticated";

REVOKE ALL ("degree") ON TABLE "public"."profile_education" FROM "authenticated";

GRANT INSERT ("degree"), UPDATE ("degree") ON TABLE "public"."profile_education" TO "authenticated";

REVOKE ALL ("description") ON TABLE "public"."profile_education" FROM "authenticated";

GRANT INSERT ("description"), UPDATE ("description") ON TABLE "public"."profile_education" TO "authenticated";

REVOKE ALL ("end_date") ON TABLE "public"."profile_education" FROM "authenticated";

GRANT INSERT ("end_date"), UPDATE ("end_date") ON TABLE "public"."profile_education" TO "authenticated";

REVOKE ALL ("field_of_study") ON TABLE "public"."profile_education" FROM "authenticated";

GRANT INSERT ("field_of_study"), UPDATE ("field_of_study") ON TABLE "public"."profile_education" TO "authenticated";

REVOKE ALL ("profile_id") ON TABLE "public"."profile_education" FROM "authenticated";

GRANT INSERT ("profile_id") ON TABLE "public"."profile_education" TO "authenticated";

REVOKE ALL ("school") ON TABLE "public"."profile_education" FROM "authenticated";

GRANT INSERT ("school"), UPDATE ("school") ON TABLE "public"."profile_education" TO "authenticated";

REVOKE ALL ("start_date") ON TABLE "public"."profile_education" FROM "authenticated";

GRANT INSERT ("start_date"), UPDATE ("start_date") ON TABLE "public"."profile_education" TO "authenticated";

GRANT DELETE, SELECT ON TABLE "public"."profile_education" TO "authenticated";

REVOKE ALL ON TABLE "public"."profile_education" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_education" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_education" TO "service_role";

