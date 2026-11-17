-- The cron job in #282 runs as postgres. Ordinary API roles must not
-- invoke a SECURITY DEFINER function that expires every pending interview.
REVOKE ALL ON FUNCTION public.expire_pending_interviews()
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.expire_pending_interviews()
TO postgres;

-- The checked SECURITY DEFINER functions handle applicant responses,
-- recruiter rescheduling, recruiter cancellation, and cron expiration.
-- Removing direct UPDATE also prevents callers from supplying their own
-- app.interview_status_action setting to authorize an UPDATE.
REVOKE UPDATE ON TABLE public.interviews
FROM PUBLIC, anon, authenticated;