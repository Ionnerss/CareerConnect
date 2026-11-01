SET local check_function_bodies = off;

CREATE SCHEMA "private";

CREATE OR REPLACE FUNCTION private.careerconnect_mfa_allowed()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
    SELECT
        (SELECT auth.uid()) IS NOT NULL
        AND (
            -- A verified second factor satisfies MFA.
            (SELECT auth.jwt() ->> 'aal') = 'aal2'

            -- Otherwise, allow access only if this user
            -- has no verified MFA factor enrolled.
            OR NOT EXISTS (
                SELECT 1
                FROM auth.mfa_factors AS factor
                WHERE factor.user_id = (SELECT auth.uid())
                  AND factor.status = 'verified'
            )
        );
$function$;

CREATE POLICY "Require completed MFA for resume access" ON "public"."resumes"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed))
  WITH CHECK (( SELECT private.careerconnect_mfa_allowed() AS careerconnect_mfa_allowed));

REVOKE ALL ON FUNCTION "private"."careerconnect_mfa_allowed"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."careerconnect_mfa_allowed"() TO "authenticated";

GRANT USAGE ON SCHEMA "private" TO "authenticated";

