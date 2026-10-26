SET local check_function_bodies = off;

ALTER TABLE "public"."job"
  ADD COLUMN "employment_type" text;

ALTER TABLE "public"."job"
  ADD CONSTRAINT "job_employment_type_check"
    CHECK (((employment_type IS NULL) OR (employment_type = ANY (ARRAY['Full-time'::text, 'Part-time'::text, 'Contract'::text, 'Internship'::text]))));

COMMENT ON COLUMN "public"."job"."employment_type" IS 'Employment arrangement. NULL for legacy jobs without a specified type.';

