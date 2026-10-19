CREATE TABLE "public"."profile_preference_languages" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "profile_id" uuid                     NOT NULL,
  "name"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profile_preference_languages_name_check" CHECK (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 100)))),
  CONSTRAINT "profile_preference_languages_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profile_preference_languages"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."profile_preference_languages" FROM "anon";

CREATE TABLE "public"."profile_preferences" (
  "profile_id"       uuid                     NOT NULL,
  "desired_role"     text,
  "desired_position" text,
  "desired_salary"   numeric(12,2),
  "work_mode"        text,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profile_preferences_pkey" PRIMARY KEY (profile_id),
  CONSTRAINT "profile_preferences_position_check"
    CHECK (((desired_position IS NULL) OR (desired_position = ANY (ARRAY['full_time'::text, 'part_time'::text, 'internship'::text, 'contract'::text])))),
  CONSTRAINT "profile_preferences_role_check"
    CHECK (((desired_role IS NULL) OR ((desired_role = btrim(desired_role)) AND ((char_length(desired_role) >= 1) AND (char_length(desired_role) <= 150))))),
  CONSTRAINT "profile_preferences_salary_check" CHECK (((desired_salary IS NULL) OR (desired_salary > (0)::numeric))),
  CONSTRAINT "profile_preferences_work_mode_check"
    CHECK (((work_mode IS NULL) OR (work_mode = ANY (ARRAY['remote'::text, 'hybrid'::text, 'on_site'::text, 'no_preference'::text]))))
);

ALTER TABLE "public"."profile_preferences"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."profile_preferences" FROM "anon";

ALTER TABLE "public"."profile_preference_languages"
  ADD CONSTRAINT "profile_preference_languages_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."profile_preferences"
  ADD CONSTRAINT "profile_preferences_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX profile_preference_languages_profile_name_idx ON public.profile_preference_languages USING btree (profile_id, lower(name));

CREATE POLICY "Recruiters can view applicant preference languages" ON "public"."profile_preference_languages"
  FOR SELECT
  TO "authenticated"
  USING (public.recruiter_can_view_profile(profile_id));

CREATE POLICY "Users can add own preference languages" ON "public"."profile_preference_languages"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can delete own preference languages" ON "public"."profile_preference_languages"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can update own preference languages" ON "public"."profile_preference_languages"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can view own preference languages" ON "public"."profile_preference_languages"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Recruiters can view applicant preferences" ON "public"."profile_preferences"
  FOR SELECT
  TO "authenticated"
  USING (public.recruiter_can_view_profile(profile_id));

CREATE POLICY "Users can add own preferences" ON "public"."profile_preferences"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can delete own preferences" ON "public"."profile_preferences"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can update own preferences" ON "public"."profile_preferences"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can view own preferences" ON "public"."profile_preferences"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

COMMENT ON COLUMN "public"."profile_preferences"."desired_salary" IS 'Desired annual salary in CAD.';

REVOKE ALL ON TABLE "public"."profile_preference_languages" FROM "authenticated";

REVOKE ALL ("name") ON TABLE "public"."profile_preference_languages" FROM "authenticated";

GRANT INSERT ("name"), UPDATE ("name") ON TABLE "public"."profile_preference_languages" TO "authenticated";

REVOKE ALL ("profile_id") ON TABLE "public"."profile_preference_languages" FROM "authenticated";

GRANT INSERT ("profile_id") ON TABLE "public"."profile_preference_languages" TO "authenticated";

GRANT DELETE, SELECT ON TABLE "public"."profile_preference_languages" TO "authenticated";

REVOKE ALL ON TABLE "public"."profile_preference_languages" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_preference_languages" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_preference_languages" TO "service_role";

REVOKE ALL ON TABLE "public"."profile_preferences" FROM "authenticated";

REVOKE ALL ("desired_position") ON TABLE "public"."profile_preferences" FROM "authenticated";

GRANT INSERT ("desired_position"), UPDATE ("desired_position") ON TABLE "public"."profile_preferences" TO "authenticated";

REVOKE ALL ("desired_role") ON TABLE "public"."profile_preferences" FROM "authenticated";

GRANT INSERT ("desired_role"), UPDATE ("desired_role") ON TABLE "public"."profile_preferences" TO "authenticated";

REVOKE ALL ("desired_salary") ON TABLE "public"."profile_preferences" FROM "authenticated";

GRANT INSERT ("desired_salary"), UPDATE ("desired_salary") ON TABLE "public"."profile_preferences" TO "authenticated";

REVOKE ALL ("profile_id") ON TABLE "public"."profile_preferences" FROM "authenticated";

GRANT INSERT ("profile_id") ON TABLE "public"."profile_preferences" TO "authenticated";

REVOKE ALL ("work_mode") ON TABLE "public"."profile_preferences" FROM "authenticated";

GRANT INSERT ("work_mode"), UPDATE ("work_mode") ON TABLE "public"."profile_preferences" TO "authenticated";

GRANT DELETE, SELECT ON TABLE "public"."profile_preferences" TO "authenticated";

REVOKE ALL ON TABLE "public"."profile_preferences" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_preferences" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_preferences" TO "service_role";

