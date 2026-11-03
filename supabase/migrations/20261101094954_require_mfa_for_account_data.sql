SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_public_profile()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
    INSERT INTO public.profiles_public (id, full_name)
    VALUES (NEW.id, NEW.full_name);

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case
      when new.email_confirmed_at is not null
        and new.raw_user_meta_data ->> 'account_type' = 'recruiter'
        and public.is_concordia_email(new.email)
      then 'recruiter'
      else 'job_seeker'
    end
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_concordia_email (
  email text
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select coalesce(
    lower(btrim(email)) ~ '^[^@[:space:]]+@([a-z0-9-]+\.)*concordia\.ca$',
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.recruiter_can_view_profile (
  profile_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
     select exists (
       select 1
       from public.applications a
       join public.job j on j.id = a.job_id
       where a.applicant_id = profile_id
         and j.recruiter_id = (select auth.uid())
     );
   $function$;

CREATE OR REPLACE FUNCTION public.sync_public_profile_name()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
BEGIN
    UPDATE public.profiles_public
    SET full_name = NEW.full_name
    WHERE id = NEW.id;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_recruiter_role()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if new.email_confirmed_at is not null
     and new.raw_user_meta_data ->> 'account_type' = 'recruiter'
     and public.is_concordia_email(new.email) then
    update public.profiles
       set role = 'recruiter'
     where id = new.id
       and role <> 'recruiter';
  elsif old.email is distinct from new.email
        and not public.is_concordia_email(new.email) then
    update public.profiles
       set role = 'job_seeker'
     where id = new.id
       and role = 'recruiter';
  end if;

  return new;
end;
$function$;

CREATE POLICY "Require completed MFA for account data" ON "public"."applications"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for account data" ON "public"."candidate_evaluations"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for job delete" ON "public"."job"
  AS RESTRICTIVE
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for job insert" ON "public"."job"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for job update" ON "public"."job"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for account data" ON "public"."job_requirements"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for account data" ON "public"."profile_education"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for account data" ON "public"."profile_experience"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for account data" ON "public"."profile_preference_languages"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for account data" ON "public"."profile_preferences"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for account data" ON "public"."profile_project_images"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for account data" ON "public"."profile_project_links"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for account data" ON "public"."profile_projects"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for account data" ON "public"."profile_skills"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Require completed MFA for account data" ON "public"."profiles"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

CREATE POLICY "Users can update resume" ON "public"."resumes"
  FOR UPDATE
  TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Require completed MFA for image delete" ON "storage"."objects"
  AS RESTRICTIVE
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id <> 'profile-images'::text) OR COALESCE(( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed), false)));

CREATE POLICY "Require completed MFA for image insert" ON "storage"."objects"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id <> 'profile-images'::text) OR COALESCE(( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed), false)));

CREATE POLICY "Require completed MFA for image update" ON "storage"."objects"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING (((bucket_id <> 'profile-images'::text) OR COALESCE(( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed), false)))
  WITH CHECK (((bucket_id <> 'profile-images'::text) OR COALESCE(( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed), false)));

CREATE POLICY "Require completed MFA for private file access" ON "storage"."objects"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (((bucket_id <> ALL (ARRAY['cover_letters'::text, 'project-images'::text])) OR COALESCE(( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed), false)))
  WITH
    CHECK
    (((bucket_id <> ALL (ARRAY['cover_letters'::text, 'project-images'::text])) OR COALESCE(( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed), false)));

CREATE POLICY "Users can update resume i5g8va_0" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Users can update resume i5g8va_1" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'resumes'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

