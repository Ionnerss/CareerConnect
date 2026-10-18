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
import DashboardHeader from "@/components/dashboard/dashboard-header";
import DashboardHero from "@/components/dashboard/dashboard-hero";
import DashboardStats from "@/components/dashboard/dashboard-stats";
import DashboardApplications from "@/components/dashboard/dashboard-applications";
import {
  DashboardNextSteps,
  DashboardProfileCard,
  DashboardShortcuts,
} from "@/components/dashboard/dashboard-sidebar";

// The new look (font + navy/blue colours) is scoped to this page only.
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
    <div className={`${jakarta.className} min-h-screen bg-[#F5F6F8] text-[#1F2937]`}>
      <DashboardHeader initials={initials} />

      <main>
        <DashboardHero firstName={firstName} todayLabel={todayLabel} />

        <div className="relative z-10 mx-auto -mt-6 flex max-w-[1200px] flex-wrap items-start gap-6 px-4 pb-16 sm:px-6">
          <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-24 lg:w-[260px] lg:shrink-0">
            <DashboardProfileCard
              displayName={fullName ?? email}
              email={email}
              initials={initials}
              resumeCount={summary.resumeCount}
            />
          </aside>

          <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-6">
            <DashboardStats counts={counts} />
            <DashboardApplications
              applications={applications}
              loadError={applicationsLoadError}
              now={now}
            />
          </div>

          <aside className="flex w-full flex-col gap-4 lg:w-[280px] lg:shrink-0">
            {steps.some((step) => !step.done) && <DashboardNextSteps steps={steps} />}
            <DashboardShortcuts />
          </aside>
        </div>
      </main>
    </div>
  );
}
