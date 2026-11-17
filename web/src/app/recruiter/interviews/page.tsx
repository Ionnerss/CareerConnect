import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageBody, PageHero } from "@/components/app/page-hero";
import { RecruiterInterviewsList } from "@/components/recruiter/recruiter-interviews-list";
import { AUTH_ERROR } from "@/lib/recruiter/applicants";
import { getRecruiterInterviews } from "@/lib/recruiter/interviews";

export const metadata: Metadata = {
  title: "Interviews · CareerConnect",
  description: "Interviews you scheduled with your applicants.",
};

// The recruiter layout already signs the user in and keeps job seekers out.
export default async function RecruiterInterviewsPage() {
  const result = await getRecruiterInterviews();

  if (!result.success && result.error === AUTH_ERROR) {
    redirect("/auth/login");
  }

  return (
    <main>
      <PageHero
        label="Recruiter"
        title="Interviews"
        description="See who accepted, change the details or cancel an interview."
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
          <RecruiterInterviewsList interviews={result.interviews} now={new Date().toISOString()} />
        )}
      </PageBody>
    </main>
  );
}
