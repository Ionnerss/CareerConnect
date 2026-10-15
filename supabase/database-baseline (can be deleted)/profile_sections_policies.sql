BEGIN;

-- Speed up lookups of a user's education entries.
CREATE INDEX profile_education_profile_id_idx
    ON public.profile_education (profile_id);

ALTER TABLE public.profile_education
    ENABLE ROW LEVEL SECURITY;

-- Remove default privileges, then grant only what's needed.
REVOKE ALL ON TABLE public.profile_education
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, DELETE
    ON TABLE public.profile_education
    TO authenticated;

-- Let the database generate id and created_at.
GRANT INSERT (
    profile_id,
    school,
    degree,
    field_of_study,
    start_date,
    end_date,
    description
)
    ON TABLE public.profile_education
    TO authenticated;

-- Users cannot change id, profile_id, or created_at.
GRANT UPDATE (
    school,
    degree,
    field_of_study,
    start_date,
    end_date,
    description
)
    ON TABLE public.profile_education
    TO authenticated;

CREATE POLICY "Users can view own education"
    ON public.profile_education
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Users can add own education"
    ON public.profile_education
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Users can update own education"
    ON public.profile_education
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = profile_id)
    WITH CHECK ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Users can delete own education"
    ON public.profile_education
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = profile_id);

COMMIT;