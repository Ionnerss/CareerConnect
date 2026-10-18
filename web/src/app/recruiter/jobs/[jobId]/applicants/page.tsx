import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AUTH_ERROR,
  formatApplicationStatus,
  getJobApplicants,
} from "@/lib/recruiter/applicants";

type ApplicantsPageProps = {
  params: Promise<{ jobId: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function JobApplicantsPage({ params }: ApplicantsPageProps) {
  const { jobId } = await params;
  const result = await getJobApplicants(jobId);

  if (!result.success && result.error === AUTH_ERROR) {
    redirect("/auth/login");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <Link href="/recruiter/jobs" className="text-sm text-muted-foreground hover:underline">
          ← Back to my job postings
        </Link>

        {!result.success ? (
          <p role="alert" className="mt-6 text-sm text-destructive">
            {result.error}
          </p>
        ) : (
          <>
            <div className="mt-4 mb-6">
              <h1 className="text-2xl font-semibold">Applicants for {result.job.title}</h1>
              <p className="text-sm text-muted-foreground">
                {result.job.location} · {result.applicants.length} applicant
                {result.applicants.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.required_skills.length > 0
                  ? `Required skills: ${result.required_skills.join(", ")}. Applicants are listed best match first.`
                  : "This posting lists no required skills, so skill match can't be calculated."}
              </p>
            </div>

            {result.applicants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No one has applied to this posting yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Applicant</th>
                      <th scope="col" className="px-4 py-3 font-medium">Applied on</th>
                      <th scope="col" className="px-4 py-3 font-medium">Status</th>
                      <th scope="col" className="px-4 py-3 font-medium">Skill match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.applicants.map((applicant) => (
                      <tr key={applicant.application_id} className="border-t border-border">
                        <td className="px-4 py-3">
                          {applicant.full_name ?? (
                            <span className="text-muted-foreground">Name not available</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {dateFormatter.format(new Date(applicant.applied_at))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            {formatApplicationStatus(applicant.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {applicant.skill_match ? (
                            <>
                              <span className="font-medium">{applicant.skill_match.percent}%</span>
                              <span className="text-muted-foreground">
                                {" "}
                                ({applicant.skill_match.matched.length} of{" "}
                                {applicant.skill_match.matched.length +
                                  applicant.skill_match.missing.length}{" "}
                                skills)
                              </span>
                              {applicant.skill_match.missing.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Missing: {applicant.skill_match.missing.join(", ")}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
