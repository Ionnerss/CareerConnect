import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageBody, PageHero } from "@/components/app/page-hero";
import { InterviewForm } from "@/components/recruiter/interview-form";
import { AUTH_ERROR } from "@/lib/recruiter/applicants";
import { RECRUITER_INTERVIEWS_PATH, toMontrealInputValue } from "@/lib/recruiter/interview-schedule";
import { getInterviewForEditing } from "@/lib/recruiter/interviews";

export const metadata: Metadata = {
  title: "Reschedule interview · CareerConnect",
};

type EditInterviewPageProps = {
  params: Promise<{ interviewId: string }>;
};

export default async function EditInterviewPage({ params }: EditInterviewPageProps) {
  const { interviewId } = await params;
  const result = await getInterviewForEditing(interviewId);

  if (!result.success && result.error === AUTH_ERROR) {
    redirect("/auth/login");
  }

  return (
    <main>
      <PageHero
        label="Recruiter"
        title="Reschedule interview"
        description={
          result.success
            ? `Interview with ${result.context.applicantName ?? "this applicant"} for ${result.context.jobTitle}.`
            : undefined
        }
        action={
          <Link
            href={RECRUITER_INTERVIEWS_PATH}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-[#A9C1FF] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B93FF]"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to interviews
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
            interviewId={result.interview.id}
            details={result.context}
            cancelHref={RECRUITER_INTERVIEWS_PATH}
            initialValues={{
              // Converted on the server so the field shows Montreal time on every device.
              scheduledAt: toMontrealInputValue(result.interview.scheduledAt),
              responseDeadline: toMontrealInputValue(result.interview.responseDeadline),
              durationMinutes: result.interview.durationMinutes ? String(result.interview.durationMinutes) : "",
              location: result.interview.location ?? "",
              meetingUrl: result.interview.meetingUrl ?? "",
              notes: result.interview.notes ?? "",
            }}
          />
        )}
      </PageBody>
    </main>
  );
}
