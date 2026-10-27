BEGIN;

ALTER TABLE public.profile_preference_languages
    DROP CONSTRAINT profile_preference_languages_name_check;

ALTER TABLE public.profile_preference_languages
    ADD CONSTRAINT profile_preference_languages_name_check
    CHECK (
        name ~ '[^[:space:]]'
        AND name = regexp_replace(
            name,
            '^[[:space:]]+|[[:space:]]+$',
            '',
            'g'
        )
        AND char_length(name) <= 100
    );

ALTER TABLE public.profile_preferences
    DROP CONSTRAINT profile_preferences_role_check;

ALTER TABLE public.profile_preferences
    ADD CONSTRAINT profile_preferences_role_check
    CHECK (
        desired_role IS NULL
        OR (
            desired_role ~ '[^[:space:]]'
            AND desired_role = regexp_replace(
                desired_role,
                '^[[:space:]]+|[[:space:]]+$',
                '',
                'g'
            )
            AND char_length(desired_role) <= 150
        )
    );

COMMIT;