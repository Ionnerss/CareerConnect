import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHero } from "@/components/app/page-hero";
import { AUTH_ERROR, getRecruiterJobs } from "@/lib/recruiter/applicants";

export default async function RecruiterJobsPage() {
  const result = await getRecruiterJobs();

  if (!result.success && result.error === AUTH_ERROR) {
    redirect("/auth/login");
  }

  return (
    <main>
      <PageHero
        label="Recruiter"
        title="My job postings"
        description="Open a posting to see its applicants, best skill match first."
      />

      <PageBody>
        {!result.success ? (
          <p
            role="alert"
            className="rounded-2xl border border-[#FCD9D9] bg-white p-5 text-sm text-destructive"
          >
            {result.error}
          </p>
        ) : result.jobs.length === 0 ? (
          <p className="rounded-2xl border border-[#E3E6EB] bg-white p-8 text-center text-sm text-[#4B5563]">
            You have not posted any jobs yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {result.jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/recruiter/jobs/${job.id}/applicants`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[#E3E6EB] bg-white p-4 transition-colors hover:border-[#93B0F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                >
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-[#0E1726]">
                      {job.title}
                    </h2>
                    <p className="text-sm text-[#4B5563]">
                      {job.location} · {job.status}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#E8EEFD] px-3 py-1 text-xs font-bold text-[#1D4ED8]">
                    {job.applicant_count} applicant
                    {job.applicant_count === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </main>
  );
}
