CREATE OR REPLACE FUNCTION public.validate_application_resume()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
    -- Preserve the existing applicant identity rule.
    IF NEW.applicant_id IS DISTINCT FROM (SELECT auth.uid()) THEN
        RAISE EXCEPTION
            'You can only submit applications for yourself.';
    END IF;

    -- Preserve the existing active, owned resume rule.
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

    IF TG_OP = 'INSERT' THEN
        -- The column default supplies this value when status is omitted.
        -- An applicant cannot supply a different initial status.
        IF NEW.status IS DISTINCT FROM 'In Progress' THEN
            RAISE EXCEPTION
                'New applications must start In Progress.';
        END IF;

        -- Hold a shared lock on the open job until this transaction ends.
        -- A concurrent status change must wait for this submission.
        PERFORM 1
        FROM public.job AS j
        WHERE j.id = NEW.job_id
          AND j.status = 'open'
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'You can only apply to an open job.';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

ALTER TABLE "public"."applications"
  ADD CONSTRAINT "applications_applicant_job_unique" UNIQUE (applicant_id, job_id);