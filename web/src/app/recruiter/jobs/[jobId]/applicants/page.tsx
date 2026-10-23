import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHero } from "@/components/app/page-hero";
import CandidateComparison from "@/components/recruiter/candidate-comparison";
import {
  AUTH_ERROR,
  formatApplicationStatus,
  getJobApplicants,
} from "@/lib/recruiter/applicants";
import { getJobRequirements } from "@/lib/recruiter/candidate-comparison-service";

type ApplicantsPageProps = {
  params: Promise<{ jobId: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function JobApplicantsPage({
  params,
}: ApplicantsPageProps) {
  const { jobId } = await params;
  const result = await getJobApplicants(jobId);

  if (!result.success && result.error === AUTH_ERROR) {
    redirect("/auth/login");
  }

  // Only a recruiter who owns the posting gets this far, so the requirements can be loaded.
  const requirements = result.success ? await getJobRequirements(jobId) : null;

  return (
    <main>
      <PageHero
        label="Recruiter"
        title={
          result.success ? `Applicants for ${result.job.title}` : "Applicants"
        }
        description={
          result.success
            ? `${result.job.location} · ${result.applicants.length} applicant${result.applicants.length === 1 ? "" : "s"}`
            : undefined
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
            <p className="mb-4 rounded-2xl border border-[#E3E6EB] bg-white px-5 py-3 text-sm text-[#4B5563]">
              {result.required_skills.length > 0
                ? `Required skills: ${result.required_skills.join(", ")}. Applicants are listed best match first.`
                : "This posting lists no required skills, so skill match can't be calculated."}
            </p>

            {result.applicants.length === 0 ? (
              <p className="rounded-2xl border border-[#E3E6EB] bg-white p-8 text-center text-sm text-[#4B5563]">
                No one has applied to this posting yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#E3E6EB] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F5F6F8] text-[#4B5563]">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Applicant
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Applied on
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Skill match
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.applicants.map((applicant) => (
                      <tr
                        key={applicant.application_id}
                        className="border-t border-[#EEF0F3]"
                      >
                        <td className="px-4 py-3 font-semibold text-[#0E1726]">
                          {applicant.full_name ?? (
                            <span className="font-normal text-[#4B5563]">
                              Name not available
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {dateFormatter.format(new Date(applicant.applied_at))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[#E8EEFD] px-2.5 py-1 text-xs font-bold text-[#1D4ED8]">
                            {formatApplicationStatus(applicant.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {applicant.skill_match ? (
                            <>
                              <span className="font-bold text-[#0E1726]">
                                {applicant.skill_match.percent}%
                              </span>
                              <span className="text-[#4B5563]">
                                {" "}
                                ({applicant.skill_match.matched.length} of{" "}
                                {applicant.skill_match.matched.length +
                                  applicant.skill_match.missing.length}{" "}
                                skills)
                              </span>
                              {applicant.skill_match.missing.length > 0 && (
                                <p className="text-xs text-[#4B5563]">
                                  Missing:{" "}
                                  {applicant.skill_match.missing.join(", ")}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-[#4B5563]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {requirements?.success ? (
              <CandidateComparison
                jobId={result.job.id}
                initialRequirements={requirements.requirements}
                applicantCount={result.applicants.length}
              />
            ) : (
              <p role="alert" className="mt-10 text-sm text-destructive">
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
