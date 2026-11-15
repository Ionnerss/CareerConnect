SET local check_function_bodies = off;

REVOKE ALL ON TABLE "public"."notifications" FROM "anon";

DROP POLICY "Require completed MFA for notifications" ON "public"."notifications";

DROP POLICY "Users can update their own notifications" ON "public"."notifications";

DROP POLICY "Users can view their own notifications" ON "public"."notifications";

ALTER TABLE "public"."interviews"
  ADD COLUMN "reminder_7d_sent_at" timestamp WITH time zone;

ALTER TABLE "public"."interviews"
  ADD COLUMN "reminder_24h_sent_at" timestamp WITH time zone;

ALTER TABLE "public"."interviews"
  ADD COLUMN "reminder_1h_sent_at" timestamp WITH time zone;

ALTER TABLE "public"."notifications"
  ADD COLUMN "deadline_at" timestamp WITH time zone;

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

CREATE OR REPLACE FUNCTION public.create_interview_deadline_notification()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
DECLARE
    formatted_interview_date text;
    existing_deadline_title text;
    status_action text;
BEGIN
    status_action := current_setting(
        'app.interview_status_action',
        TRUE
    );

    IF TG_OP = 'UPDATE'
       AND NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN

        UPDATE public.interviews
        SET
            reminder_7d_sent_at = NULL,
            reminder_24h_sent_at = NULL,
            reminder_1h_sent_at = NULL
        WHERE id = NEW.id;

    END IF;

    SELECT title
    INTO existing_deadline_title
    FROM public.notifications
    WHERE interview_id = NEW.id
      AND type = 'interview_deadline'
    LIMIT 1;

    IF LOWER(NEW.status) = 'accepted' THEN

        formatted_interview_date := to_char(
            NEW.scheduled_at AT TIME ZONE 'America/Toronto',
            'FMDay, FMMonth DD, YYYY at HH12:MI AM'
        );

        IF status_action = 'applicant_response'
           AND existing_deadline_title =
               'Interview rescheduled — please confirm' THEN

            INSERT INTO public.notifications (
                recipient_id,
                type,
                title,
                message,
                application_id,
                interview_id,
                is_read,
                read_at,
                deadline_at
            )
            VALUES (
                NEW.applicant_id,
                'interview_deadline',
                'Interview rescheduled — confirmed',
                'Your rescheduled interview has been confirmed. Your interview is scheduled for '
                    || formatted_interview_date || '.',
                NEW.application_id,
                NEW.id,
                FALSE,
                NULL,
                NEW.scheduled_at
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
                read_at = NULL;

        ELSE

            INSERT INTO public.notifications (
                recipient_id,
                type,
                title,
                message,
                application_id,
                interview_id,
                is_read,
                read_at,
                deadline_at
            )
            VALUES (
                NEW.applicant_id,
                'interview_deadline',
                'Interview confirmed!',
                'Your interview is scheduled for '
                    || formatted_interview_date || '.',
                NEW.application_id,
                NEW.id,
                FALSE,
                NULL,
                NEW.scheduled_at
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
                read_at = NULL;

        END IF;

    ELSIF LOWER(NEW.status) = 'declined' THEN

        IF status_action = 'applicant_response'
           AND existing_deadline_title =
               'Interview rescheduled — please confirm' THEN

            UPDATE public.notifications
            SET
                title = 'Interview rescheduled — cancelled',
                message = 'You declined the proposed interview date. This rescheduled interview invitation is cancelled.',
                deadline_at = NEW.scheduled_at,
                is_read = FALSE,
                read_at = NULL
            WHERE interview_id = NEW.id
              AND recipient_id = NEW.applicant_id
              AND type = 'interview_deadline';

        ELSE

            UPDATE public.notifications
            SET
                title = 'Interview cancelled',
                message = 'This interview is no longer scheduled.',
                deadline_at = NULL,
                is_read = FALSE,
                read_at = NULL
            WHERE interview_id = NEW.id
              AND type = 'interview_deadline';

        END IF;

    ELSIF LOWER(NEW.status) IN ('cancelled', 'canceled') THEN

        UPDATE public.notifications
        SET
            title = 'Interview cancelled',
            message = 'This interview is no longer scheduled.',
            deadline_at = NULL,
            is_read = FALSE,
            read_at = NULL
        WHERE interview_id = NEW.id
          AND type = 'interview_deadline';

    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."create_interview_deadline_notification"() FROM PUBLIC, "anon", "authenticated";

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

CREATE OR REPLACE FUNCTION public.notify_applicant_new_interview()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
    IF NEW.status = 'pending' THEN
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
            NEW.applicant_id,
            'interview_invitation',
            'New interview invitation',
            'You have received a new interview invitation. Please review the interview details and accept or decline before the response deadline.',
            NEW.application_id,
            NEW.id,
            FALSE,
            NOW()
        );
    END IF;

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

CREATE OR REPLACE FUNCTION public.process_interview_deadline_reminders()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
BEGIN

    WITH due AS (
        UPDATE public.interviews i
        SET reminder_7d_sent_at = NOW()
        WHERE LOWER(i.status) = 'accepted'
          AND i.scheduled_at > NOW() + INTERVAL '24 hours'
          AND i.scheduled_at <= NOW() + INTERVAL '7 days'
          AND i.reminder_7d_sent_at IS NULL
          AND EXISTS (
              SELECT 1
              FROM public.notifications n
              WHERE n.interview_id = i.id
                AND n.type = 'interview_deadline'
          )
        RETURNING i.id, i.scheduled_at
    )
    UPDATE public.notifications n
    SET
        title = 'Interview in 7 days!',
        message = 'Your interview is coming up in 7 days. Start preparing!',
        deadline_at = due.scheduled_at,
        is_read = FALSE,
        read_at = NULL
    FROM due
    WHERE n.interview_id = due.id
      AND n.type = 'interview_deadline';

    WITH due AS (
        UPDATE public.interviews i
        SET reminder_24h_sent_at = NOW()
        WHERE LOWER(i.status) = 'accepted'
          AND i.scheduled_at > NOW() + INTERVAL '1 hour'
          AND i.scheduled_at <= NOW() + INTERVAL '24 hours'
          AND i.reminder_24h_sent_at IS NULL
          AND EXISTS (
              SELECT 1
              FROM public.notifications n
              WHERE n.interview_id = i.id
                AND n.type = 'interview_deadline'
          )
        RETURNING i.id, i.scheduled_at
    )
    UPDATE public.notifications n
    SET
        title = 'Interview tomorrow!',
        message = 'Your interview is scheduled for '
            || to_char(
                due.scheduled_at AT TIME ZONE 'America/Toronto',
                'FMDay, FMMonth DD, YYYY at HH12:MI AM'
            )
            || '. Make sure you are ready!',
        deadline_at = due.scheduled_at,
        is_read = FALSE,
        read_at = NULL
    FROM due
    WHERE n.interview_id = due.id
      AND n.type = 'interview_deadline';

    WITH due AS (
        UPDATE public.interviews i
        SET reminder_1h_sent_at = NOW()
        WHERE LOWER(i.status) = 'accepted'
          AND i.scheduled_at > NOW()
          AND i.scheduled_at <= NOW() + INTERVAL '1 hour'
          AND i.reminder_1h_sent_at IS NULL
          AND EXISTS (
              SELECT 1
              FROM public.notifications n
              WHERE n.interview_id = i.id
                AND n.type = 'interview_deadline'
          )
        RETURNING i.id, i.scheduled_at
    )
    UPDATE public.notifications n
    SET
        title = 'Interview starting soon!',
        message = 'Your interview starts in 1 hour. Get ready!',
        deadline_at = due.scheduled_at,
        is_read = FALSE,
        read_at = NULL
    FROM due
    WHERE n.interview_id = due.id
      AND n.type = 'interview_deadline';

END;
$function$;

REVOKE ALL ON FUNCTION "public"."process_interview_deadline_reminders"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.publish_recommendation_run (
  p_run_id  uuid,
  p_results jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
DECLARE
  v_run public.recommendation_runs%ROWTYPE;
  v_role text;
  v_result jsonb;
  v_position integer;
  v_count integer;
  v_fit_count integer := 0;
  v_summary_count integer := 0;
  v_rank integer;
  v_score integer;
  v_match_score integer;
  v_job_id uuid;
  v_fit jsonb;
  v_skill_match jsonb;
  v_reasons jsonb;
  v_summary text;
BEGIN
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RAISE EXCEPTION 'Results must be an array'
      USING ERRCODE = '22023';
  END IF;

  v_count := jsonb_array_length(p_results);

  -- Lock the run and its owner while deciding whether it may publish.
  SELECT *
  INTO v_run
  FROM public.recommendation_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND OR v_run.status <> 'running' THEN
    RAISE EXCEPTION 'Run is not available for publication'
      USING ERRCODE = '22023';
  END IF;

  SELECT role
  INTO v_role
  FROM public.profiles
  WHERE id = v_run.user_id
  FOR UPDATE;

  IF v_role IS DISTINCT FROM 'job_seeker' THEN
    RAISE EXCEPTION 'Run owner is not a job seeker'
      USING ERRCODE = '22023';
  END IF;

  IF nullif(btrim(v_run.seeker_input_hash), '') IS NULL
     OR nullif(btrim(v_run.scoring_version), '') IS NULL THEN
    RAISE EXCEPTION 'Run version metadata is incomplete'
      USING ERRCODE = '22023';
  END IF;

  -- The profile lock serializes publication for this seeker. An older
  -- attempt cannot publish after a newer successful attempt.
  IF EXISTS (
    SELECT 1
    FROM public.recommendation_runs newer
    WHERE newer.user_id = v_run.user_id
      AND newer.status = 'succeeded'
      AND (newer.created_at, newer.id) > (v_run.created_at, v_run.id)
  ) THEN
    RAISE EXCEPTION 'A newer run has already succeeded'
      USING ERRCODE = '22023';
  END IF;

  -- A retry must not append rows left by an earlier attempt.
  IF EXISTS (
    SELECT 1
    FROM public.recommendation_results existing
    WHERE existing.run_id = p_run_id
  ) THEN
    RAISE EXCEPTION 'Run already has results'
      USING ERRCODE = '22023';
  END IF;

  FOR v_position IN 0 .. v_count - 1 LOOP
    v_result := p_results -> v_position;

    IF jsonb_typeof(v_result) <> 'object' THEN
      RAISE EXCEPTION 'Each result must be an object'
        USING ERRCODE = '22023';
    END IF;

    v_rank := (v_result ->> 'rank')::integer;
    v_score := (v_result ->> 'score')::integer;
    v_match_score := (v_result ->> 'match_score')::integer;
    v_job_id := (v_result ->> 'job_id')::uuid;
    v_fit := NULLIF(v_result -> 'fit', 'null'::jsonb);
    v_skill_match := NULLIF(v_result -> 'skill_match', 'null'::jsonb);
    v_reasons := v_result -> 'reasons';
    v_summary := v_result ->> 'summary';

    IF v_rank IS DISTINCT FROM v_position + 1
       OR v_score IS NULL OR v_score NOT BETWEEN 0 AND 100
       OR v_match_score IS NULL OR v_match_score NOT BETWEEN 0 AND 100
       OR v_job_id IS NULL
       OR jsonb_typeof(v_reasons) IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_reasons) = 0
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(v_reasons) AS reason(value)
         WHERE jsonb_typeof(reason.value) <> 'string'
            OR btrim(reason.value #>> '{}') = ''
       )
       OR (
         v_skill_match IS NOT NULL
         AND jsonb_typeof(v_skill_match) <> 'object'
       )
       OR (
         v_fit IS NOT NULL
         AND jsonb_typeof(v_fit) <> 'object'
       )
       OR (v_result ->> 'seeker_input_hash') IS DISTINCT FROM v_run.seeker_input_hash
       OR nullif(btrim(v_result ->> 'job_input_hash'), '') IS NULL
       OR (v_result ->> 'job_input_checked_at') IS NULL
    THEN
      RAISE EXCEPTION 'Invalid recommendation result'
        USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.job j
      WHERE j.id = v_job_id
        AND j.status = 'open'
    ) THEN
      RAISE EXCEPTION 'Recommendation job is not open'
        USING ERRCODE = '22023';
    END IF;

    IF v_fit IS NOT NULL THEN
      v_fit_count := v_fit_count + 1;
    END IF;

    IF v_summary IS NOT NULL THEN
      v_summary_count := v_summary_count + 1;
    END IF;

    INSERT INTO public.recommendation_results (
      run_id,
      job_id,
      rank,
      score,
      match_score,
      fit,
      fit_error,
      skill_match,
      reasons,
      summary,
      seeker_input_hash,
      job_input_hash,
      job_input_checked_at,
      fit_generated_at
    )
    VALUES (
      p_run_id,
      v_job_id,
      v_rank,
      v_score,
      v_match_score,
      v_fit,
      v_result ->> 'fit_error',
      v_skill_match,
      v_reasons,
      v_summary,
      v_run.seeker_input_hash,
      v_result ->> 'job_input_hash',
      (v_result ->> 'job_input_checked_at')::timestamptz,
      (v_result ->> 'fit_generated_at')::timestamptz
    );
  END LOOP;

  IF v_fit_count > 0
     AND (
       nullif(btrim(v_run.jev_model_version), '') IS NULL
       OR nullif(btrim(v_run.jev_prompt_version), '') IS NULL
     ) THEN
    RAISE EXCEPTION 'Jev version metadata is required'
      USING ERRCODE = '22023';
  END IF;

  IF v_summary_count > 0
     AND (
       nullif(btrim(v_run.summary_model_version), '') IS NULL
       OR nullif(btrim(v_run.summary_prompt_version), '') IS NULL
     ) THEN
    RAISE EXCEPTION 'Summary version metadata is required'
      USING ERRCODE = '22023';
  END IF;

  -- Check what actually reached the table, including an empty result set.
  IF (
    SELECT count(*)
    FROM public.recommendation_results
    WHERE run_id = p_run_id
  ) <> v_count THEN
    RAISE EXCEPTION 'Published result count does not match'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.recommendation_runs
  SET status = 'succeeded',
      ranking_mode = CASE
        WHEN v_count = 0 THEN NULL
        WHEN v_fit_count = 0 THEN 'code_only'
        WHEN v_fit_count = v_count THEN 'ai'
        ELSE 'mixed'
      END,
      result_count = v_count,
      summary_count = v_summary_count,
      completed_at = clock_timestamp(),
      inputs_checked_at = clock_timestamp(),
      failure_code = NULL
  WHERE id = p_run_id;

  RETURN p_run_id;
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
        read_at = NULL;

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

    IF p_response IS NULL
       OR p_response NOT IN ('accepted', 'declined') THEN
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

CREATE UNIQUE INDEX notifications_interview_deadline_unique ON public.notifications USING btree (interview_id, TYPE)
  WHERE ((interview_id IS NOT NULL) AND (TYPE = 'interview_deadline'::text));

CREATE TRIGGER create_interview_deadline_notification_trigger
  AFTER INSERT OR UPDATE OF status, scheduled_at ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.create_interview_deadline_notification();

CREATE TRIGGER on_new_interview_created
  AFTER INSERT ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_applicant_new_interview();

CREATE POLICY "notifications_select_own" ON "public"."notifications"
  FOR SELECT
  TO "authenticated"
  USING ((recipient_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "notifications_update_own" ON "public"."notifications"
  FOR UPDATE
  TO "authenticated"
  USING ((recipient_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((recipient_id = ( SELECT auth.uid() AS uid)));

REVOKE ALL ON FUNCTION "public"."create_interview_deadline_notification"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_interview_deadline_notification"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_interview_deadline_notification"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."notify_applicant_new_interview"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."notify_applicant_new_interview"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."notify_applicant_new_interview"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."notify_applicant_new_interview"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."process_interview_deadline_reminders"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."process_interview_deadline_reminders"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."process_interview_deadline_reminders"() TO "service_role";

REVOKE ALL ON TABLE "public"."notifications" FROM "authenticated";

REVOKE ALL ("is_read") ON TABLE "public"."notifications" FROM "authenticated";

GRANT UPDATE ("is_read") ON TABLE "public"."notifications" TO "authenticated";

REVOKE ALL ("read_at") ON TABLE "public"."notifications" FROM "authenticated";

GRANT UPDATE ("read_at") ON TABLE "public"."notifications" TO "authenticated";

GRANT SELECT ON TABLE "public"."notifications" TO "authenticated";

SELECT cron.schedule_in_database('interview-deadline-reminders', '* * * * *', 'SELECT public.process_interview_deadline_reminders();', 'postgres', NULL, true);

