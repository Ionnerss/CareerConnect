SET local check_function_bodies = off;

REVOKE ALL ("description") ON TABLE "public"."job" FROM "authenticated";

REVOKE ALL ("firm_name") ON TABLE "public"."job" FROM "authenticated";

REVOKE ALL ("location") ON TABLE "public"."job" FROM "authenticated";

REVOKE ALL ("required_skills") ON TABLE "public"."job" FROM "authenticated";

REVOKE ALL ("salary") ON TABLE "public"."job" FROM "authenticated";

REVOKE ALL ("status") ON TABLE "public"."job" FROM "authenticated";

REVOKE ALL ("title") ON TABLE "public"."job" FROM "authenticated";

ALTER TABLE "public"."job"
  ADD COLUMN "work_mode" text NOT NULL DEFAULT 'On-site'::text;

ALTER TABLE "public"."job"
  ADD COLUMN "experience" integer;

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

ALTER TABLE "public"."job"
  ADD CONSTRAINT "job_experience_check" CHECK (((experience IS NULL) OR (experience >= 0)));

ALTER TABLE "public"."job"
  ADD CONSTRAINT "job_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])));

ALTER TABLE "public"."job"
  ADD CONSTRAINT "job_work_mode_check" CHECK ((work_mode = ANY (ARRAY['On-site'::text, 'Remote'::text, 'Hybrid'::text])));

COMMENT ON COLUMN "public"."job"."work_mode" IS 'Can be On-site, Remote, Hybrid';

