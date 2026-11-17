SET local check_function_bodies = off;

REVOKE ALL ("cover_letter_path") ON TABLE "public"."applications" FROM "authenticated";

REVOKE ALL ("status") ON TABLE "public"."applications" FROM "authenticated";

CREATE TABLE "public"."interviews" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "application_id"   uuid                     NOT NULL,
  "recruiter_id"     uuid                     NOT NULL,
  "applicant_id"     uuid                     NOT NULL,
  "scheduled_at"     timestamp with time zone NOT NULL,
  "duration_minutes" integer,
  "location"         text,
  "meeting_url"      text,
  "notes"            text,
  "status"           text                     NOT NULL DEFAULT 'pending'::text,
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "interviews_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."interviews"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."notifications" (
  "id"             uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "recipient_id"   uuid                        NOT NULL DEFAULT gen_random_uuid(),
  "type"           text                        NOT NULL,
  "title"          text                        NOT NULL,
  "message"        text                        NOT NULL,
  "application_id" uuid,
  "interview_id"   uuid,
  "job_id"         uuid,
  "is_read"        boolean                     NOT NULL DEFAULT false,
  "read_at"        timestamp without time zone,
  "created_at"     timestamp with time zone    NOT NULL DEFAULT now(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."notifications"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.careerconnect_mfa_allowed()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
    SELECT
        (SELECT auth.uid()) IS NOT NULL
        AND (
            -- A verified second factor satisfies MFA.
            (SELECT auth.jwt() ->> 'aal') = 'aal2'

            -- Otherwise, allow access only if this user
            -- has no verified MFA factor enrolled.
            OR NOT EXISTS (
                SELECT 1
                FROM auth.mfa_factors AS factor
                WHERE factor.user_id = (SELECT auth.uid())
                  AND factor.status = 'verified'
            )
        );
$function$;

CREATE OR REPLACE FUNCTION public.guard_application_cover_letter_update()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
BEGIN
  IF OLD.applicant_id = auth.uid()
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.applicant_id IS DISTINCT FROM OLD.applicant_id
       OR NEW.job_id IS DISTINCT FROM OLD.job_id
       OR NEW.resume_id IS DISTINCT FROM OLD.resume_id
     )
  THEN
    RAISE EXCEPTION 'Applicants may only attach a cover letter.';
  END IF;

  IF NEW.cover_letter_path IS DISTINCT FROM OLD.cover_letter_path THEN
    IF auth.uid() IS DISTINCT FROM OLD.applicant_id
       OR NEW.cover_letter_path IS NULL
       OR NEW.cover_letter_path NOT LIKE
          OLD.applicant_id::text || '/' || OLD.id::text || '/%.pdf'
       OR split_part(NEW.cover_letter_path, '/', 4) <> ''
       OR NOT EXISTS (
         SELECT 1
         FROM storage.objects o
         WHERE o.bucket_id = 'cover_letters'
           AND o.name = NEW.cover_letter_path
       )
    THEN
      RAISE EXCEPTION 'Invalid cover letter attachment.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_application_status_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
    job_title TEXT;
    status_message TEXT;
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    SELECT j.title
    INTO job_title
    FROM public.job j
    WHERE j.id = NEW.job_id;

    CASE NEW.status
        WHEN 'In Progress' THEN
            status_message := 'Your application is now in progress.';
        WHEN 'Interview' THEN
            status_message := 'Your application has been selected for an interview.';
        WHEN 'Accepted' THEN
            status_message := 'Congratulations! Your application has been accepted.';
        WHEN 'Rejected' THEN
            status_message := 'Unfortunately, your application has been rejected.';
        ELSE
            status_message := 'Your application status has been updated.';
    END CASE;

    INSERT INTO public.notifications (
        recipient_id,
        type,
        title,
        message,
        application_id,
        job_id,
        is_read
    )
    VALUES (
        NEW.applicant_id,
        'application_update',
        'Application Status Updated',
        COALESCE(job_title, 'A job') || ': ' || status_message,
        NEW.id,
        NEW.job_id,
        false
    );

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recruiter_can_view_profile (
  profile_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  SELECT
    COALESCE(
      (SELECT private.careerconnect_mfa_allowed()),
      false
    )
    AND EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.job j ON j.id = a.job_id
      WHERE a.applicant_id = profile_id
        AND j.recruiter_id = (SELECT auth.uid())
    );
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_interview (
  p_interview_id uuid,
  p_response     text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
    updated_interview_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'You must be logged in.';
    END IF;

    IF NOT private.careerconnect_mfa_allowed() THEN
        RAISE EXCEPTION 'MFA verification required.';
    END IF;

    IF p_response IS NULL OR p_response NOT IN ('accepted', 'declined') THEN
        RAISE EXCEPTION 'Invalid interview response.';
    END IF;

    UPDATE public.interviews
    SET
        status = p_response,
        updated_at = NOW()
    WHERE id = p_interview_id
      AND applicant_id = auth.uid()
      AND status = 'pending'
    RETURNING id INTO updated_interview_id;

    IF updated_interview_id IS NULL THEN
        RAISE EXCEPTION 'Interview not found or it has already been answered.';
    END IF;
END;
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

ALTER TABLE "public"."interviews"
  ADD CONSTRAINT "interviews_applicant_id_fkey" FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."interviews"
  ADD CONSTRAINT "interviews_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applications(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."interviews"
  ADD CONSTRAINT "interviews_recruiter_id_fkey" FOREIGN KEY (recruiter_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applications(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TRIGGER application_status_notification
  AFTER UPDATE OF status ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_application_status_change();

CREATE POLICY "Recruiters can create interviews" ON "public"."interviews"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((recruiter_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'recruiter'::text)))) AND (EXISTS ( SELECT 1
   FROM (public.applications a
     JOIN public.job j ON ((j.id = a.job_id)))
  WHERE
    ((a.id = interviews.application_id) AND (a.applicant_id = interviews.applicant_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid)) AND (j.id = ( SELECT applications.job_id
           FROM public.applications
          WHERE (applications.id = interviews.application_id))))))));

CREATE POLICY "Recruiters can update their interviews" ON "public"."interviews"
  FOR UPDATE
  TO "authenticated"
  USING ((recruiter_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((recruiter_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Require completed MFA for interviews" ON "public"."interviews"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Users can view their own interviews" ON "public"."interviews"
  FOR SELECT
  TO "authenticated"
  USING (((recruiter_id = ( SELECT auth.uid() AS uid)) OR (applicant_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "Require completed MFA for notifications" ON "public"."notifications"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Users can update their own notifications" ON "public"."notifications"
  FOR UPDATE
  TO "authenticated"
  USING ((recipient_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((recipient_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can view their own notifications" ON "public"."notifications"
  FOR SELECT
  TO "authenticated"
  USING ((recipient_id = ( SELECT auth.uid() AS uid)));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."applications";

COMMENT ON COLUMN "public"."interviews"."status" IS 'Only as pending, accepted, declined, cancelled';

COMMENT ON TABLE "public"."interviews" IS 'stores interview invitations and their details, including the job seeker''s response.';

COMMENT ON TABLE "public"."notifications" IS 'stores every notification sent to a user, whether they are a job seeker or recruiter.';

GRANT EXECUTE ON FUNCTION "public"."notify_application_status_change"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."notify_application_status_change"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."notify_application_status_change"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."notify_application_status_change"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."respond_to_interview"(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."respond_to_interview"(uuid, text) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."respond_to_interview"(uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."respond_to_interview"(uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."respond_to_interview"(uuid, text) TO "service_role";

REVOKE ALL ON TABLE "public"."applications" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."applications" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."interviews" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."interviews" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."interviews" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."interviews" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."notifications" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "service_role";

