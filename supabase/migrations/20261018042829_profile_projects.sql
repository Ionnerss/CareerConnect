SET local check_function_bodies = off;

CREATE TABLE "public"."profile_project_images" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id"   uuid                     NOT NULL,
  "storage_path" text                     NOT NULL,
  "alt_text"     text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profile_project_images_alt_text_check" CHECK (((alt_text IS NULL) OR (char_length(alt_text) <= 200))),
  CONSTRAINT "profile_project_images_path_check" CHECK ((storage_path ~ '^[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$'::text)),
  CONSTRAINT "profile_project_images_pkey" PRIMARY KEY (id),
  CONSTRAINT "profile_project_images_storage_path_key" UNIQUE (storage_path)
);

ALTER TABLE "public"."profile_project_images"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."profile_project_images" FROM "anon";

CREATE TABLE "public"."profile_project_links" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id" uuid                     NOT NULL,
  "label"      text                     NOT NULL,
  "url"        text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profile_project_links_label_check" CHECK (((label ~ '[^[:space:]]'::text) AND (char_length(label) <= 100) AND (label = btrim(label)))),
  CONSTRAINT "profile_project_links_pkey" PRIMARY KEY (id),
  CONSTRAINT "profile_project_links_url_check" CHECK (((char_length(url) <= 2048) AND (url ~* '^https?://[^/[:space:]]+([/?#][^[:space:]]*)?$'::text)))
);

ALTER TABLE "public"."profile_project_links"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."profile_project_links" FROM "anon";

CREATE TABLE "public"."profile_projects" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "profile_id"        uuid                     NOT NULL,
  "name"              text                     NOT NULL,
  "short_description" text                     NOT NULL,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profile_projects_description_check" CHECK (((short_description ~ '[^[:space:]]'::text) AND (char_length(short_description) <= 500))),
  CONSTRAINT "profile_projects_name_check" CHECK (((name ~ '[^[:space:]]'::text) AND (char_length(name) <= 150) AND (name = btrim(name)))),
  CONSTRAINT "profile_projects_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profile_projects"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."profile_projects" FROM "anon";

ALTER TABLE "public"."profile_project_images"
  ADD CONSTRAINT "profile_project_images_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.profile_projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."profile_project_links"
  ADD CONSTRAINT "profile_project_links_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.profile_projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."profile_projects"
  ADD CONSTRAINT "profile_projects_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX profile_project_images_project_id_idx ON public.profile_project_images USING btree (project_id);

CREATE INDEX profile_project_links_project_id_idx ON public.profile_project_links USING btree (project_id);

CREATE INDEX profile_projects_profile_created_idx ON public.profile_projects USING btree (profile_id, created_at DESC);

CREATE POLICY "Authorized users can view project images" ON "public"."profile_project_images"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE (p.id = profile_project_images.project_id))));

CREATE POLICY "Users can add images to own projects" ON "public"."profile_project_images"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((storage_path ~~ ((((( SELECT auth.uid() AS uid))::text || '/'::text) || (project_id)::text) || '/%'::text)) AND (EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE ((p.id = profile_project_images.project_id) AND (p.profile_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY "Users can delete images from own projects" ON "public"."profile_project_images"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE ((p.id = profile_project_images.project_id) AND (p.profile_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Users can update images on own projects" ON "public"."profile_project_images"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE ((p.id = profile_project_images.project_id) AND (p.profile_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE ((p.id = profile_project_images.project_id) AND (p.profile_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Authorized users can view project links" ON "public"."profile_project_links"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE (p.id = profile_project_links.project_id))));

CREATE POLICY "Users can add links to own projects" ON "public"."profile_project_links"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE ((p.id = profile_project_links.project_id) AND (p.profile_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Users can delete links from own projects" ON "public"."profile_project_links"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE ((p.id = profile_project_links.project_id) AND (p.profile_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Users can update links on own projects" ON "public"."profile_project_links"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE ((p.id = profile_project_links.project_id) AND (p.profile_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE ((p.id = profile_project_links.project_id) AND (p.profile_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Recruiters can view applicant projects" ON "public"."profile_projects"
  FOR SELECT
  TO "authenticated"
  USING (public.recruiter_can_view_profile(profile_id));

CREATE POLICY "Users can add own projects" ON "public"."profile_projects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can delete own projects" ON "public"."profile_projects"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can update own projects" ON "public"."profile_projects"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = profile_id));

CREATE POLICY "Users can view own projects" ON "public"."profile_projects"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = profile_id));

REVOKE ALL ON TABLE "public"."profile_project_images" FROM "authenticated";

REVOKE ALL ("alt_text") ON TABLE "public"."profile_project_images" FROM "authenticated";

GRANT INSERT ("alt_text"), UPDATE ("alt_text") ON TABLE "public"."profile_project_images" TO "authenticated";

REVOKE ALL ("project_id") ON TABLE "public"."profile_project_images" FROM "authenticated";

GRANT INSERT ("project_id") ON TABLE "public"."profile_project_images" TO "authenticated";

REVOKE ALL ("storage_path") ON TABLE "public"."profile_project_images" FROM "authenticated";

GRANT INSERT ("storage_path") ON TABLE "public"."profile_project_images" TO "authenticated";

GRANT DELETE, SELECT ON TABLE "public"."profile_project_images" TO "authenticated";

REVOKE ALL ON TABLE "public"."profile_project_images" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_project_images" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_project_images" TO "service_role";

REVOKE ALL ON TABLE "public"."profile_project_links" FROM "authenticated";

REVOKE ALL ("label") ON TABLE "public"."profile_project_links" FROM "authenticated";

GRANT INSERT ("label"), UPDATE ("label") ON TABLE "public"."profile_project_links" TO "authenticated";

REVOKE ALL ("project_id") ON TABLE "public"."profile_project_links" FROM "authenticated";

GRANT INSERT ("project_id") ON TABLE "public"."profile_project_links" TO "authenticated";

REVOKE ALL ("url") ON TABLE "public"."profile_project_links" FROM "authenticated";

GRANT INSERT ("url"), UPDATE ("url") ON TABLE "public"."profile_project_links" TO "authenticated";

GRANT DELETE, SELECT ON TABLE "public"."profile_project_links" TO "authenticated";

REVOKE ALL ON TABLE "public"."profile_project_links" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_project_links" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_project_links" TO "service_role";

REVOKE ALL ON TABLE "public"."profile_projects" FROM "authenticated";

REVOKE ALL ("name") ON TABLE "public"."profile_projects" FROM "authenticated";

GRANT INSERT ("name"), UPDATE ("name") ON TABLE "public"."profile_projects" TO "authenticated";

REVOKE ALL ("profile_id") ON TABLE "public"."profile_projects" FROM "authenticated";

GRANT INSERT ("profile_id") ON TABLE "public"."profile_projects" TO "authenticated";

REVOKE ALL ("short_description") ON TABLE "public"."profile_projects" FROM "authenticated";

GRANT INSERT ("short_description"), UPDATE ("short_description") ON TABLE "public"."profile_projects" TO "authenticated";

GRANT DELETE, SELECT ON TABLE "public"."profile_projects" TO "authenticated";

REVOKE ALL ON TABLE "public"."profile_projects" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_projects" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profile_projects" TO "service_role";

