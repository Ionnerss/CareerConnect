BEGIN;
REVOKE UPDATE ON TABLE public.profiles FROM authenticated, anon, PUBLIC;

REVOKE UPDATE (id, created_at, full_name, role)
ON TABLE public.profiles
FROM authenticated, anon, PUBLIC;

GRANT UPDATE (full_name)
ON TABLE public.profiles
TO authenticated;
COMMIT;