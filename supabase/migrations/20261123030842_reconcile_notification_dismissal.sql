-- Hosted databases may already have this column.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dismissed_at timestamp with time zone;

-- Restrict authenticated updates to notification read/dismissal state.
REVOKE UPDATE ON TABLE public.notifications FROM authenticated;

GRANT UPDATE (is_read, read_at, dismissed_at)
  ON TABLE public.notifications
  TO authenticated;

-- Require completed MFA when the user has a verified factor enrolled.
-- Existing ownership policies still determine which notifications are accessible.
CREATE POLICY notifications_require_mfa
  ON public.notifications
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.careerconnect_mfa_allowed()))
  WITH CHECK ((SELECT private.careerconnect_mfa_allowed()));