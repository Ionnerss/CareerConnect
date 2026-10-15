SET local check_function_bodies = off;

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

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_avatar_path_check" CHECK (((avatar_path IS NULL) OR (avatar_path ~ (('^'::text || (id)::text) || '/avatar/[^/]+$'::text))));

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_background_path_check" CHECK (((background_path IS NULL) OR (background_path ~ (('^'::text || (id)::text) || '/background/[^/]+$'::text))));

