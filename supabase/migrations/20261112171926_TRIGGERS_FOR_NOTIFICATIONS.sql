SET local check_function_bodies = off;

ALTER TABLE "public"."notifications"
  ALTER COLUMN "recipient_id" DROP DEFAULT;

CREATE EXTENSION "pg_cron";

ALTER TABLE "public"."interviews"
  ADD COLUMN "response_deadline" timestamp WITH time zone;

ALTER TABLE "public"."job"
  ADD COLUMN "deadline" timestamp WITH time zone;

CREATE OR REPLACE FUNCTION public.cancel_interview (
  p_interview_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
    interview_record RECORD;
    updated_notification_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'You must be logged in.';
    END IF;

    IF NOT private.careerconnect_mfa_allowed() THEN
        RAISE EXCEPTION 'MFA verification required.';
    END IF;

    SELECT *
    INTO interview_record
    FROM public.interviews
    WHERE id = p_interview_id
      AND recruiter_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Interview not found or you are not authorized.';
    END IF;

    IF interview_record.status NOT IN ('pending', 'accepted') THEN
        RAISE EXCEPTION 'This interview cannot be cancelled.';
    END IF;

    PERFORM set_config(
        'app.interview_status_action',
        'recruiter_cancel',
        TRUE
    );

    UPDATE public.interviews
    SET
        status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_interview_id;

    UPDATE public.notifications
    SET
        type = 'interview_cancelled',
        title = 'Interview cancelled',
        message = 'Your recruiter has cancelled your scheduled interview.',
        is_read = FALSE,
        read_at = NULL
    WHERE id = (
        SELECT id
        FROM public.notifications
        WHERE interview_id = p_interview_id
          AND recipient_id = interview_record.applicant_id
          AND type IN (
              'interview_invitation',
              'interview_update'
          )
        ORDER BY created_at DESC
        LIMIT 1
    );

    GET DIAGNOSTICS updated_notification_count = ROW_COUNT;

    IF updated_notification_count = 0 THEN
        INSERT INTO public.notifications (
            recipient_id,
            type,
            title,
            message,
            application_id,
            interview_id,
            is_read,
            created_at
        )
        VALUES (
            interview_record.applicant_id,
            'interview_cancelled',
            'Interview cancelled',
            'Your recruiter has cancelled your scheduled interview.',
            interview_record.application_id,
            p_interview_id,
            FALSE,
            NOW()
        );
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_public_profile()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
    INSERT INTO public.profiles_public (id, full_name)
    VALUES (NEW.id, NEW.full_name);

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_pending_interviews()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
    expired_interview RECORD;
BEGIN
    PERFORM set_config(
        'app.interview_status_action',
        'system_expiration',
        TRUE
    );

    FOR expired_interview IN
        UPDATE public.interviews
        SET
            status = 'expired',
            updated_at = NOW()
        WHERE
            status = 'pending'
            AND response_deadline <= NOW()
        RETURNING id, applicant_id, application_id
    LOOP
        UPDATE public.notifications
        SET
            type = 'interview_expired',
            title = 'Interview invitation expired',
            message = 'Your interview invitation expired because you did not respond before the deadline.',
            is_read = FALSE,
            read_at = NULL
        WHERE
            interview_id = expired_interview.id
            AND recipient_id = expired_interview.applicant_id
            AND type IN ('interview_invitation', 'interview_update');
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case
      when new.email_confirmed_at is not null
        and new.raw_user_meta_data ->> 'account_type' = 'recruiter'
        and public.is_concordia_email(new.email)
      then 'recruiter'
      else 'job_seeker'
    end
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_concordia_email (
  email text
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select coalesce(
    lower(btrim(email)) ~ '^[^@[:space:]]+@([a-z0-9-]+\.)*concordia\.ca$',
    false
  );
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

CREATE OR REPLACE FUNCTION public.notify_recruiter_interview_response()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$DECLARE
    applicant_name TEXT;
    job_title TEXT;
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status NOT IN ('accepted', 'declined') THEN
        RETURN NEW;
    END IF;

    SELECT full_name
    INTO applicant_name
    FROM public.profiles_public
    WHERE id = NEW.applicant_id;

    SELECT j.title
    INTO job_title
    FROM public.applications a
    JOIN public.job j ON j.id = a.job_id
    WHERE a.id = NEW.application_id;

    INSERT INTO public.notifications (
        recipient_id,
        type,
        title,
        message,
        interview_id,
        application_id,
        job_id
    )
    VALUES (
        NEW.recruiter_id,
        'interview_response',
        CASE
            WHEN NEW.status = 'accepted'
                THEN 'Interview Accepted'
            ELSE 'Interview Declined'
        END,
        COALESCE(applicant_name, 'An applicant')
        || CASE
            WHEN NEW.status = 'accepted'
                THEN ' accepted the interview invitation for '
            ELSE ' declined the interview invitation for '
        END
        || COALESCE(job_title, 'a position')
        || '.',
        NEW.id,
        NEW.application_id,
        (
            SELECT a.job_id
            FROM public.applications a
            WHERE a.id = NEW.application_id
        )
    );

    RETURN NEW;
END;$function$;

CREATE OR REPLACE FUNCTION public.notify_recruiter_new_application()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
    recruiter_user_id UUID;
    job_title TEXT;
    applicant_name TEXT;
BEGIN
    SELECT
        j.recruiter_id,
        j.title
    INTO
        recruiter_user_id,
        job_title
    FROM public.job j
    WHERE j.id = NEW.job_id;

    SELECT
        p.full_name
    INTO
        applicant_name
    FROM public.profiles_public p
    WHERE p.id = NEW.applicant_id;

    IF recruiter_user_id IS NULL
       OR recruiter_user_id = NEW.applicant_id THEN
        RETURN NEW;
    END IF;

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
        recruiter_user_id,
        'application_update',
        'New application received',
        COALESCE(applicant_name, 'A job seeker')
            || ' applied for '
            || COALESCE(job_title, 'your job posting')
            || '.',
        NEW.id,
        NEW.job_id,
        false
    );

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reschedule_interview (
  p_interview_id      uuid,
  p_scheduled_at      timestamp with time zone,
  p_response_deadline timestamp with time zone
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
DECLARE
    interview_record RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'You must be logged in.';
    END IF;

    IF NOT private.careerconnect_mfa_allowed() THEN
        RAISE EXCEPTION 'MFA verification required.';
    END IF;

    SELECT *
    INTO interview_record
    FROM public.interviews
    WHERE id = p_interview_id
      AND recruiter_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Interview not found or you are not authorized.';
    END IF;

    IF interview_record.status NOT IN (
        'pending',
        'expired',
        'accepted',
        'declined'
    ) THEN
        RAISE EXCEPTION 'This interview cannot be rescheduled.';
    END IF;

    IF p_scheduled_at IS NULL OR p_scheduled_at <= NOW() THEN
        RAISE EXCEPTION 'The new interview date must be in the future.';
    END IF;

    IF p_response_deadline IS NULL
       OR p_response_deadline <= NOW()
       OR p_response_deadline >= p_scheduled_at THEN
        RAISE EXCEPTION 'The response deadline must be in the future and before the interview.';
    END IF;

    PERFORM set_config(
        'app.interview_status_action',
        'recruiter_reschedule',
        TRUE
    );

    UPDATE public.interviews
    SET
        scheduled_at = p_scheduled_at,
        response_deadline = p_response_deadline,
        status = 'pending',
        updated_at = NOW()
    WHERE id = p_interview_id;

    UPDATE public.notifications
    SET
        type = 'interview_cancelled',
        title = 'Interview invitation cancelled',
        message = 'Your previous interview invitation was cancelled because the recruiter rescheduled the interview.',
        is_read = TRUE,
        read_at = NOW()
    WHERE
        interview_id = p_interview_id
        AND recipient_id = interview_record.applicant_id
        AND type = 'interview_invitation';

    INSERT INTO public.notifications (
        recipient_id,
        type,
        title,
        message,
        application_id,
        interview_id,
        is_read,
        created_at
    )
    VALUES (
        interview_record.applicant_id,
        'interview_update',
        'Interview rescheduled',
        'Your recruiter has rescheduled your interview. Please review the new date and accept or decline the updated invitation.',
        interview_record.application_id,
        p_interview_id,
        FALSE,
        NOW()
    );

END;
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
    interview_record RECORD;
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

    SELECT *
    INTO interview_record
    FROM public.interviews
    WHERE id = p_interview_id
      AND applicant_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Interview not found.';
    END IF;

    IF interview_record.status <> 'pending' THEN
        RAISE EXCEPTION 'This interview invitation has already been answered or expired.';
    END IF;

    IF interview_record.response_deadline IS NOT NULL
       AND interview_record.response_deadline <= NOW() THEN
        RAISE EXCEPTION 'The response deadline has passed. This invitation has expired.';
    END IF;

    PERFORM set_config(
        'app.interview_status_action',
        'applicant_response',
        TRUE
    );

    UPDATE public.interviews
    SET
        status = p_response,
        updated_at = NOW()
    WHERE id = p_interview_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_public_profile_name()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
    UPDATE public.profiles_public
    SET full_name = NEW.full_name
    WHERE id = NEW.id;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_recruiter_role()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if new.email_confirmed_at is not null
     and new.raw_user_meta_data ->> 'account_type' = 'recruiter'
     and public.is_concordia_email(new.email) then
    update public.profiles
       set role = 'recruiter'
     where id = new.id
       and role <> 'recruiter';
  elsif old.email is distinct from new.email
        and not public.is_concordia_email(new.email) then
    update public.profiles
       set role = 'job_seeker'
     where id = new.id
       and role = 'recruiter';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_interview_status_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
DECLARE
    allowed_action TEXT;
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    allowed_action := current_setting(
        'app.interview_status_action',
        TRUE
    );

    IF OLD.status = 'pending'
       AND NEW.status IN ('accepted', 'declined')
       AND allowed_action = 'applicant_response' THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'pending'
       AND NEW.status = 'expired'
       AND allowed_action = 'system_expiration' THEN
        RETURN NEW;
    END IF;

    IF OLD.status IN ('pending', 'expired', 'accepted', 'declined')
       AND NEW.status = 'pending'
       AND allowed_action = 'recruiter_reschedule' THEN
        RETURN NEW;
    END IF;

    IF OLD.status IN ('pending', 'accepted')
       AND NEW.status = 'cancelled'
       AND allowed_action = 'recruiter_cancel' THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Invalid interview status transition: % to %.',
        OLD.status, NEW.status;
END;
$function$;

CREATE TRIGGER on_new_application_notify_recruiter
  AFTER INSERT ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_recruiter_new_application();

CREATE TRIGGER on_interview_response
  AFTER UPDATE OF status ON public.interviews
  FOR EACH ROW
  WHEN (((old.status IS DISTINCT FROM new.status) AND (new.status = ANY (ARRAY['accepted'::text, 'declined'::text]))))
  EXECUTE FUNCTION public.notify_recruiter_interview_response();

CREATE TRIGGER prevent_invalid_interview_status_change
  BEFORE UPDATE OF status ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_interview_status_change();

COMMENT ON COLUMN "public"."interviews"."status" IS 'Only as pending, accepted, declined, cancelled, expired';

COMMENT ON COLUMN "public"."notifications"."type" IS 'application_update, interview_invitation, interview_expired, interview_cancelled, interview_updated, interview_reminder';

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';

GRANT EXECUTE ON FUNCTION "public"."cancel_interview"(uuid) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."cancel_interview"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."cancel_interview"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."cancel_interview"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."expire_pending_interviews"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."expire_pending_interviews"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."expire_pending_interviews"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."expire_pending_interviews"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."notify_recruiter_interview_response"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."notify_recruiter_interview_response"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."notify_recruiter_interview_response"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."notify_recruiter_interview_response"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."notify_recruiter_new_application"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."notify_recruiter_new_application"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."notify_recruiter_new_application"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."notify_recruiter_new_application"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."reschedule_interview"(uuid, timestamp WITH time zone, timestamp WITH time zone) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."reschedule_interview"(uuid, timestamp WITH time zone, timestamp WITH time zone) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reschedule_interview"(uuid, timestamp WITH time zone, timestamp WITH time zone) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."reschedule_interview"(uuid, timestamp WITH time zone, timestamp WITH time zone) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."validate_interview_status_change"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."validate_interview_status_change"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_interview_status_change"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_interview_status_change"() TO "service_role";

SELECT cron.schedule_in_database('expire-pending-interviews', '*/5 * * * *', '
    SELECT public.expire_pending_interviews();
    ', 'postgres', NULL, true);

