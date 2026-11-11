SET local check_function_bodies = off;

REVOKE ALL ("description") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("description") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("employment_type") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("employment_type") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("experience") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("experience") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("firm_name") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("firm_name") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("location") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("location") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("required_skills") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("required_skills") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("salary") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("salary") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("title") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("title") ON TABLE "public"."job" TO "authenticated";

REVOKE ALL ("work_mode") ON TABLE "public"."job" FROM "authenticated";

GRANT UPDATE ("work_mode") ON TABLE "public"."job" TO "authenticated";

