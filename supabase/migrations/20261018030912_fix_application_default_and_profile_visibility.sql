BEGIN;

DROP POLICY IF EXISTS "Authenticated users can view profile names"
    ON public.profiles;

ALTER TABLE public.applications
    ALTER COLUMN status SET DEFAULT 'In Progress';

UPDATE public.applications
SET status = 'In Progress'
WHERE status = $$'In Progress'::text$$;

COMMIT;