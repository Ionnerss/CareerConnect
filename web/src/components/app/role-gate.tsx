
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireMfaForPage } from "@/lib/auth/require-mfa";
import { getProfileRole } from "@/lib/auth/current-role";
import {
  getAudienceRedirect,
  type Audience,
} from "@/lib/auth/roles";

/**
 * Protects job seeker routes that draw their own headers.
 *
 * Authentication and MFA are checked before role lookup.
 */
export default async function RoleGate({
  audience,
  children,
}: {
  audience: Audience;
  children: ReactNode;
}) {
  const { supabase, user } = await requireMfaForPage();

  const role = await getProfileRole(supabase, user.id);
  const wrongPlace = getAudienceRedirect(role, audience);

  if (wrongPlace) {
    redirect(wrongPlace);
  }

  return <>{children}</>;
}
