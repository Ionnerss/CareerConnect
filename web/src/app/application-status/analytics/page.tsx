import type { Metadata } from "next";
import {
  getUserApplications,
  type ApplicationCardData,
} from "@/lib/application_status/application_status_logic";
import { requireMfaForPage } from "@/lib/auth/require-mfa";
import { AnalyticsDashboard } from "@/components/application-analytics/analytics-dashboard";

export const metadata: Metadata = {
  title: "Application analytics · CareerConnect",
  description: "Your application history, status breakdown and job search activity.",
};

// The application-status layout already signs the user in and keeps recruiters out.
export default async function ApplicationAnalyticsPage() {
  await requireMfaForPage();

  let applications: ApplicationCardData[] = [];
  let loadError = false;

  try {
    applications = await getUserApplications();
  } catch {
    loadError = true;
  }

  return <AnalyticsDashboard applications={applications} loadError={loadError} />;
}
