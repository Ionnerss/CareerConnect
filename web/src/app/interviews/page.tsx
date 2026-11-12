
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { requireMfaForPage } from "@/lib/auth/require-mfa";
import { PageBody, PageHero } from "@/components/app/page-hero";
import InterviewList from "@/components/interviews/InterviewList";
import type { Interview } from "@/components/interviews/interview-types";
import { mockInterviews } from "@/components/interviews/mock-interviews";

export const metadata: Metadata = {
  title: "Interview management · CareerConnect",
  description: "View and manage your job interview invitations.",
};

const navigationButton =
  "inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D9DEE5] bg-white px-4 text-sm font-semibold text-[#1F2937] transition-colors hover:bg-[#F5F6F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]";

type InterviewsPageProps = {
  searchParams: Promise<{ preview?: string }>;
};

export default async function InterviewsPage({
  searchParams,
}: InterviewsPageProps) {
  await requireMfaForPage();

  const params = await searchParams;

  const isPreview =
    process.env.NODE_ENV === "development" &&
    params.preview === "true";

  // Real interview records will be supplied by Task #23.3.
  const interviews: Interview[] = isPreview ? mockInterviews : [];

  return (
    <main>
      <PageHero
        label="Interviews"
        title="Interview management"
        description="Your interview invitations, upcoming conversations, and responses — all in one place."
      />

      <PageBody>
        <div className="flex flex-col gap-7 pt-5">
          <nav
            aria-label="Interview page navigation"
            className="flex flex-wrap gap-3"
          >
            <Link
              href="/application-status/analytics"
              className={navigationButton}
            >
              <BarChart3 aria-hidden="true" className="size-4" />
              Back to application analytics
            </Link>

            <Link
              href="/application-status"
              className={navigationButton}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to application status
            </Link>
          </nav>

          {isPreview && (
            <div
              role="status"
              className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm font-medium text-[#1D4ED8]"
            >
              Preview mode — showing fictional interview invitations.
              Responses are not connected to the database.
            </div>
          )}

          <InterviewList interviews={interviews} />
        </div>
      </PageBody>
    </main>
  );
}
