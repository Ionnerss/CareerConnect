import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardProfileSummary } from "@/lib/dashboard/data";
import { getAudienceRedirect, type Audience } from "@/lib/auth/roles";
import { getProfileRole } from "@/lib/auth/current-role";
import { getInitials } from "@/lib/dashboard/summary";
import AppHeader from "@/components/app/app-header";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

/**
 * Frame for every signed-in page: brand font, page colour and the header
 * (logo, menu, Log out, your initials). Job seekers see Home, Jobs,
 * Applications and Resume; recruiters see their own menu.
 *
 * Use it from a `layout.tsx` so every page under a route gets it:
 *   <AppShell audience="job_seeker">{children}</AppShell>
 * A new signed-in section only needs that small layout to look the same.
 */
export default async function AppShell({
  audience,
  children,
}: {
  /** Which kind of account this section is for. The other kind is sent to its own home. */
  audience: Audience;
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [summary, role] = await Promise.all([
    getDashboardProfileSummary(user.id),
    getProfileRole(supabase, user.id),
  ]);

  const wrongPlace = getAudienceRedirect(role, audience);
  if (wrongPlace) {
    redirect(wrongPlace);
  }

  const initials = getInitials(
    summary.fullName?.trim() || null,
    user.email ?? "",
  );

  return (
    <div
      className={`${jakarta.className} min-h-screen bg-[#F5F6F8] text-[#1F2937]`}
    >
      <AppHeader initials={initials} role={role} />
      {children}
    </div>
  );
}
