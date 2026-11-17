-- Remove the table-wide UPDATE grant reintroduced by the
-- notifications/interview migration. It permits changes to created_at
-- and other application columns that users should not edit.
REVOKE UPDATE ON TABLE public.applications FROM authenticated;

-- Preserve the two intended authenticated update operations.
-- RLS policies and the existing update guard still decide which
-- user's row may be updated and by whom.
GRANT UPDATE (status, cover_letter_path)
ON TABLE public.applications
TO authenticated;