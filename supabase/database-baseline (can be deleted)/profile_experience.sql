BEGIN;

CREATE TABLE public.profile_experience (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    profile_id uuid NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    company_name text NOT NULL,
    job_role text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    description text,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT profile_experience_company_name_check
        CHECK (
            company_name ~ '[^[:space:]]'
            AND char_length(company_name) <= 200
        ),

    CONSTRAINT profile_experience_job_role_check
        CHECK (
            job_role ~ '[^[:space:]]'
            AND char_length(job_role) <= 200
        ),

    CONSTRAINT profile_experience_dates_check
        CHECK (
            end_date IS NULL
            OR end_date >= start_date
        ),

    CONSTRAINT profile_experience_description_word_limit
        CHECK (
            description IS NULL
            OR cardinality(
                regexp_split_to_array(
                    regexp_replace(
                        description,
                        '^[[:space:]]+|[[:space:]]+$',
                        '',
                        'g'
                    ),
                    '[[:space:]]+'
                )
            ) <= 500
        )
);

CREATE INDEX profile_experience_profile_id_idx
    ON public.profile_experience (profile_id);

ALTER TABLE public.profile_experience
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profile_experience
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, DELETE
    ON TABLE public.profile_experience
    TO authenticated;

GRANT INSERT (
    profile_id,
    company_name,
    job_role,
    start_date,
    end_date,
    description
)
    ON TABLE public.profile_experience
    TO authenticated;

GRANT UPDATE (
    company_name,
    job_role,
    start_date,
    end_date,
    description
)
    ON TABLE public.profile_experience
    TO authenticated;

CREATE POLICY "Users can view own experience"
    ON public.profile_experience
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Users can add own experience"
    ON public.profile_experience
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Users can update own experience"
    ON public.profile_experience
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = profile_id)
    WITH CHECK ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Users can delete own experience"
    ON public.profile_experience
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = profile_id);

COMMIT;