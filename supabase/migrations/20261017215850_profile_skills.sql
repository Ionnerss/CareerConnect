SET local check_function_bodies = off;

CREATE TABLE "public"."profile_skills" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "profile_id"  uuid                     NOT NULL,
  "name"        text                     NOT NULL,
  "proficiency" text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profile_skills_name_check" CHECK (((name ~ '[^[:space:]]'::text) AND (char_length(name) <= 100) AND (name = btrim(name)))),
  CONSTRAINT "profile_skills_pkey" PRIMARY KEY (id),
  CONSTRAINT "profile_skills_proficiency_check" CHECK ((proficiency = ANY (ARRAY['Beginner'::text, 'Intermediate'::text, 'Advanced'::text, 'Expert'::text])))
);

ALTER TABLE "public"."profile_skills"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."profile_skills" FROM "anon";

ALTER TABLE "public"."applications"
  ALTER COLUMN "status" SET DEFAULT '''In Progress''::text'::text;

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

ALTER TABLE "public"."profile_skills"
  ADD CONSTRAINT "profile_skills_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX profile_skills_profile_name_idx ON public.profile_skills USING btree (profile_id, lower(name));

CREATE POLICY "Users can add own skills" ON "public"."profile_skills"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can delete own skills" ON "public"."profile_skills"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can update own skills" ON "public"."profile_skills"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can view own skills" ON "public"."profile_skills"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Authenticated users can view profile names" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (true);

COMMENT ON COLUMN "public"."applications"."status" IS 'Can only be: In Progress, Interview, Accepted, Rejected';

COMMENT ON COLUMN "public"."job"."experience" IS 'In years';

REVOKE ALL ON TABLE "public"."profile_skills" FROM "authenticated";

REVOKE ALL ("name") ON TABLE "public"."profile_skills" FROM "authenticated";

GRANT INSERT ("name"), UPDATE ("name") ON TABLE "public"."profile_skills" TO "authenticated";

REVOKE ALL ("proficiency") ON TABLE "public"."profile_skills" FROM "authenticated";

GRANT INSERT ("proficiency"), UPDATE ("proficiency") ON TABLE "public"."profile_skills" TO "authenticated";

REVOKE ALL ("profile_id") ON TABLE "public"."profile_skills" FROM "authenticated";

GRANT INSERT ("profile_id") ON TABLE "public"."profile_skills" TO "authenticated";

GRANT DELETE, SELECT ON TABLE "public"."profile_skills" TO "authenticated";

REVOKE ALL ON TABLE "public"."profile_skills" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_skills" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_skills" TO "service_role";

