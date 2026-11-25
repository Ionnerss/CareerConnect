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

    PERFORM pg_catalog.set_config(
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
        title = 'Previous interview invitation cancelled',
        message = 'Your previous interview invitation was cancelled because the recruiter proposed a new interview date.',
        is_read = TRUE,
        read_at = NOW()
    WHERE interview_id = p_interview_id
      AND recipient_id = interview_record.applicant_id
      AND type = 'interview_invitation';

    INSERT INTO public.notifications (
        recipient_id,
        type,
        title,
        message,
        application_id,
        interview_id,
        deadline_at,
        is_read,
        read_at,
        created_at
    )
    VALUES (
        interview_record.applicant_id,
        'interview_deadline',
        'Interview rescheduled — please confirm',
        'Your recruiter has proposed a new interview date. Please review the updated invitation and accept or decline it before the response deadline.',
        interview_record.application_id,
        p_interview_id,
        p_response_deadline,
        FALSE,
        NULL,
        NOW()
    )
    ON CONFLICT (interview_id, type)
    WHERE interview_id IS NOT NULL
      AND type = 'interview_deadline'
    DO UPDATE SET
        recipient_id = EXCLUDED.recipient_id,
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        application_id = EXCLUDED.application_id,
        deadline_at = EXCLUDED.deadline_at,
        is_read = FALSE,
        read_at = NULL,
        dismissed_at = NULL;

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