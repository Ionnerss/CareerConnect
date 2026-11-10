
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageBody, PageHero } from "@/components/app/page-hero";
import CandidateComparison from "@/components/recruiter/candidate-comparison";
import FilteredApplicantsTable from "@/components/recruiter/filtered-applicants-table";

import {
  AUTH_ERROR,
  getJobApplicants,
} from "@/lib/recruiter/applicants";

import { getJobRequirements } from "@/lib/recruiter/candidate-comparison-service";

type ApplicantsPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function JobApplicantsPage({
  params,
}: ApplicantsPageProps) {
  const { jobId } = await params;
  const result = await getJobApplicants(jobId);

  if (!result.success && result.error === AUTH_ERROR) {
    redirect("/auth/login");
  }

  const requirements = result.success
    ? await getJobRequirements(jobId)
    : null;

  return (
    <main>
      <PageHero
        label="Recruiter"
        title={
          result.success
            ? `Applicants for ${result.job.title}`
            : "Applicants"
        }
     description={
         result.success ? result.job.location : undefined
                }
        action={
          <Link
            href="/recruiter/jobs"
            className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-[#A9C1FF] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B93FF]"
          >
            ← Back to my job postings
          </Link>
        }
      />

      <PageBody>
        {!result.success ? (
          <p
            role="alert"
            className="rounded-2xl border border-[#FCD9D9] bg-white p-5 text-sm text-destructive"
          >
            {result.error}
          </p>
        ) : (
          <>
            {/* Required skills information */}
            <p className="mb-4 rounded-2xl border border-[#E3E6EB] bg-white px-5 py-3 text-sm text-[#4B5563]">
              {result.required_skills.length > 0
                ? `Required skills: ${result.required_skills.join(", ")}`
                : "This posting lists no required skills, so skill match can't be calculated."}
            </p>

            {/* Applicant filtering and table */}
            {result.applicants.length === 0 ? (
              <p className="rounded-2xl border border-[#E3E6EB] bg-white p-8 text-center text-sm text-[#4B5563]">
                No one has applied to this posting yet.
              </p>
            ) : (
              <FilteredApplicantsTable
                applicants={result.applicants}
                jobId={jobId}
              />
            )}

            {/* Candidate comparison */}
            {requirements?.success ? (
              <CandidateComparison
                jobId={result.job.id}
                initialRequirements={requirements.requirements}
                applicantCount={result.applicants.length}
              />
            ) : (
              <p
                role="alert"
                className="mt-10 text-sm text-destructive"
              >
                {requirements?.error ??
                  "Unable to load the requirements. Please try again."}
              </p>
            )}
          </>
        )}
      </PageBody>
    </main>
  );
}
