CREATE TABLE public.profile_education (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    profile_id uuid NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    school text NOT NULL,
    degree text NOT NULL,
    field_of_study text,

    start_date date NOT NULL,
    end_date date,

    description text,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT profile_education_school_check
        CHECK (
            school ~ '[^[:space:]]'
            AND char_length(school) <= 200
        ),

    CONSTRAINT profile_education_degree_check
        CHECK (
            degree ~ '[^[:space:]]'
            AND char_length(degree) <= 200
        ),

    CONSTRAINT profile_education_field_of_study_check
        CHECK (
            field_of_study IS NULL
            OR (
                field_of_study ~ '[^[:space:]]'
                AND char_length(field_of_study) <= 200
            )
        ),

    CONSTRAINT profile_education_dates_check
        CHECK (
            end_date IS NULL
            OR end_date >= start_date
        ),

    CONSTRAINT profile_education_description_word_limit
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