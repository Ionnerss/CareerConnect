SET local check_function_bodies = off;

ALTER TABLE "public"."job"
  DROP CONSTRAINT "job_recruiter_id_fkey";

CREATE TABLE "public"."profiles_public" (
  "id"        uuid NOT NULL,
  "full_name" text,
  CONSTRAINT "profiles_public_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles_public"
  ENABLE ROW LEVEL SECURITY;

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
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
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

ALTER TABLE "public"."profiles_public"
  ADD CONSTRAINT "profiles_public_id_fkey" FOREIGN KEY (id) REFERENCES public.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."job"
  ADD CONSTRAINT "job_recruiter_id_fkey" FOREIGN KEY (recruiter_id) REFERENCES public.profiles_public(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TRIGGER create_public_profile_after_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_public_profile();

CREATE TRIGGER sync_profile_name_to_public
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW
  WHEN ((old.full_name IS DISTINCT FROM new.full_name))
  EXECUTE FUNCTION public.sync_public_profile_name();

CREATE POLICY "job_seekers_can_view_recruiter_name" ON "public"."profiles_public"
  FOR SELECT
  TO "authenticated"
  USING (true);

COMMENT ON TABLE "public"."profiles_public" IS 'To see basic information of a profile, no private information';

GRANT EXECUTE ON FUNCTION "public"."create_public_profile"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."create_public_profile"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_public_profile"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_public_profile"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."sync_public_profile_name"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."sync_public_profile_name"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."sync_public_profile_name"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."sync_public_profile_name"() TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles_public" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profiles_public" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles_public" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles_public" TO "service_role";

