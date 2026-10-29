import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getUserApplications,
  type ApplicationCardData,
} from "@/lib/application_status/application_status_logic";
import { getDashboardProfileSummary } from "@/lib/dashboard/data";
import {
  buildNextSteps,
  countApplicationStatuses,
  getFirstName,
  getInitials,
} from "@/lib/dashboard/summary";
import DashboardView from "@/components/dashboard/dashboard-view";

// Typography and visual tokens stay scoped to the dashboard.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Dashboard · CareerConnect",
  description: "Your job search and applications at a glance.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  let applications: ApplicationCardData[] = [];
  let applicationsLoadError = false;

  const [applicationsResult, summary] = await Promise.all([
    getUserApplications().then(
      (data) => ({ ok: true as const, data }),
      () => ({ ok: false as const })
    ),
    getDashboardProfileSummary(user.id),
  ]);

  if (applicationsResult.ok) {
    applications = applicationsResult.data;
  } else {
    applicationsLoadError = true;
  }

  const email = user.email ?? "";
  const fullName = summary.fullName?.trim() || null;
  const firstName = getFirstName(fullName, email);
  const initials = getInitials(fullName, email);
  const counts = countApplicationStatuses(applications);
  const now = new Date();
  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  });
  const steps = buildNextSteps({
    hasName: fullName !== null,
    resumeCount: summary.resumeCount,
    applicationCount: applicationsLoadError ? 0 : applications.length,
  });

  return (
    <DashboardView
      className={jakarta.className}
      firstName={firstName}
      displayName={fullName ?? email}
      email={email}
      initials={initials}
      resumeCount={summary.resumeCount}
      todayLabel={todayLabel}
      counts={counts}
      steps={steps}
      applications={applications}
      applicationsLoadError={applicationsLoadError}
      now={now}
    />
  );
}
