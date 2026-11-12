import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageBody, PageHero } from "@/components/app/page-hero";
import { InterviewForm } from "@/components/recruiter/interview-form";
import { AUTH_ERROR } from "@/lib/recruiter/applicants";
import { getInterviewSchedulingContext } from "@/lib/recruiter/interviews";

export const metadata: Metadata = {
  title: "Schedule an interview · CareerConnect",
};

type NewInterviewPageProps = {
  searchParams: Promise<{ applicationId?: string | string[] }>;
};

export default async function NewInterviewPage({ searchParams }: NewInterviewPageProps) {
  const { applicationId } = await searchParams;
  const result = await getInterviewSchedulingContext(
    Array.isArray(applicationId) ? applicationId[0] : applicationId,
  );

  if (!result.success && result.error === AUTH_ERROR) {
    redirect("/auth/login");
  }

  const backHref = result.success && result.context.jobId
    ? `/recruiter/jobs/${result.context.jobId}/applicants`
    : "/recruiter/jobs";

  return (
    <main>
      <PageHero
        label="Recruiter"
        title="Schedule an interview"
        description={
          result.success
            ? `Invite ${result.context.applicantName ?? "this applicant"} to interview for ${result.context.jobTitle}.`
            : undefined
        }
        action={
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-[#A9C1FF] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B93FF]"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to applicants
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
          <InterviewForm
            applicationId={result.context.applicationId}
            details={result.context}
            cancelHref={backHref}
          />
        )}
      </PageBody>
    </main>
  );
}
