import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/auth/current-role";
import { getAudienceRedirect, type Audience } from "@/lib/auth/roles";

/**
 * Keeps the wrong kind of account off a page that draws its own header
 * (/dashboard and /profile). It adds no markup. Signed-out visitors pass
 * through untouched, so the page and the login middleware still handle them.
 *
 * Used from a `layout.tsx`, so the page file itself is not edited.
 */
export default async function RoleGate({
  audience,
  children,
}: {
  audience: Audience;
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const wrongPlace = getAudienceRedirect(
      await getProfileRole(supabase, user.id),
      audience,
    );
    if (wrongPlace) {
      redirect(wrongPlace);
    }
  }

  return <>{children}</>;
}
