BEGIN;

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'project-images',
    'project-images',
    false,
    5 * 1024 * 1024,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Owners and authorized recruiters can read project images" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'project-images'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR (EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE (((p.id)::text = (storage.foldername(storage.objects.name))[2]) AND ((p.profile_id)::text = (storage.foldername(storage.objects.name))[1]) AND public.recruiter_can_view_profile(p.profile_id)))))));

CREATE POLICY "Users can delete images from own project folder" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'project-images'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE POLICY "Users can upload images to own projects" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((bucket_id = 'project-images'::text) AND (cardinality(storage.foldername(name)) = 2) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND
    (storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$'::text) AND (EXISTS ( SELECT 1
   FROM public.profile_projects p
  WHERE (((p.id)::text = (storage.foldername(storage.objects.name))[2]) AND (p.profile_id = ( SELECT auth.uid() AS uid)))))));

COMMIT;