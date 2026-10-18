SET local check_function_bodies = off;

CREATE TABLE "public"."candidate_evaluations" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "application_id"    uuid                     NOT NULL,
  "answers"           jsonb                    NOT NULL,
  "score"             integer                  NOT NULL,
  "confidence"        numeric                  NOT NULL,
  "needs_review"      boolean                  NOT NULL,
  "requirements_hash" text                     NOT NULL,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "candidate_evaluations_application_id_key" UNIQUE (application_id),
  CONSTRAINT "candidate_evaluations_confidence_check" CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
  CONSTRAINT "candidate_evaluations_pkey" PRIMARY KEY (id),
  CONSTRAINT "candidate_evaluations_score_check" CHECK (((score >= 0) AND (score <= 100)))
);

ALTER TABLE "public"."candidate_evaluations"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."job_requirements" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "posting_id" uuid                     NOT NULL,
  "text"       text                     NOT NULL,
  "kind"       text                     NOT NULL DEFAULT 'core'::text,
  "weight"     integer                  NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "job_requirements_kind_check" CHECK ((kind = ANY (ARRAY['core'::text, 'nice'::text]))),
  CONSTRAINT "job_requirements_pkey" PRIMARY KEY (id),
  CONSTRAINT "job_requirements_text_check" CHECK (((char_length(btrim(text)) >= 1) AND (char_length(btrim(text)) <= 300))),
  CONSTRAINT "job_requirements_weight_check" CHECK (((weight >= 1) AND (weight <= 10)))
);

ALTER TABLE "public"."job_requirements"
  ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidate_evaluations"
  ADD CONSTRAINT "candidate_evaluations_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

ALTER TABLE "public"."job_requirements"
  ADD CONSTRAINT "job_requirements_posting_id_fkey" FOREIGN KEY (posting_id) REFERENCES public.job(id) ON DELETE CASCADE;

CREATE INDEX job_requirements_posting_id_idx ON public.job_requirements USING btree (posting_id);

CREATE POLICY "Recruiters add evaluations for their own postings" ON "public"."candidate_evaluations"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.applications a
     JOIN public.job j ON ((j.id = a.job_id)))
  WHERE ((a.id = candidate_evaluations.application_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Recruiters update evaluations for their own postings" ON "public"."candidate_evaluations"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.applications a
     JOIN public.job j ON ((j.id = a.job_id)))
  WHERE ((a.id = candidate_evaluations.application_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.applications a
     JOIN public.job j ON ((j.id = a.job_id)))
  WHERE ((a.id = candidate_evaluations.application_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Recruiters view evaluations for their own postings" ON "public"."candidate_evaluations"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.applications a
     JOIN public.job j ON ((j.id = a.job_id)))
  WHERE ((a.id = candidate_evaluations.application_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Recruiters manage their own posting requirements" ON "public"."job_requirements"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.job j
  WHERE ((j.id = job_requirements.posting_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.job j
  WHERE ((j.id = job_requirements.posting_id) AND (j.recruiter_id = ( SELECT auth.uid() AS uid))))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."candidate_evaluations" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."candidate_evaluations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."candidate_evaluations" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."candidate_evaluations" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job_requirements" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."job_requirements" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job_requirements" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job_requirements" TO "service_role";


REVOKE ALL ON TABLE "public"."candidate_evaluations" FROM "anon";

REVOKE ALL ON TABLE "public"."job_requirements" FROM "anon";