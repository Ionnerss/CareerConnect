import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageBody, PageHero } from "@/components/app/page-hero";
import { RecruiterNotificationsList } from "@/components/recruiter/application-notifications";
import { AUTH_ERROR } from "@/lib/recruiter/applicants";
import { NOTIFICATION_LIMIT, getRecruiterNotifications } from "@/lib/recruiter/notifications";

export const metadata: Metadata = {
  title: "Notifications · CareerConnect",
  description: "New applications and interview replies for your job postings.",
};

// The recruiter layout already signs the user in and keeps job seekers out.
export default async function RecruiterNotificationsPage() {
  const result = await getRecruiterNotifications();

  if (!result.success && result.error === AUTH_ERROR) {
    redirect("/auth/login");
  }

  return (
    <main>
      <PageHero
        label="Recruiter"
        title="Notifications"
        description="New applications and interview replies, newest first."
        action={
          <Link
            href="/recruiter/jobs"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-[#A9C1FF] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B93FF]"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to job postings
          </Link>
        }
      />

      <PageBody>
        {!result.success ? (
          <p
            role="alert"
            className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-sm font-medium text-[#B91C1C]"
          >
            {result.error}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <RecruiterNotificationsList notifications={result.notifications} now={new Date().toISOString()} />
            {result.notifications.length === NOTIFICATION_LIMIT && (
              <p className="text-xs text-[#6B7280]">Showing your {NOTIFICATION_LIMIT} most recent notifications.</p>
            )}
          </div>
        )}
      </PageBody>
    </main>
  );
}
