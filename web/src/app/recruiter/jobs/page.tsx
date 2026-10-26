import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import {
  PageBody,
  PageHero,
} from "@/components/app/page-hero";

import {
  AUTH_ERROR,
  getRecruiterJobs,
} from "@/lib/recruiter/applicants";

import { CloseJobButton } from "@/components/recruiter/close-job-button";

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
        description="Manage your postings and review applicants."
        action={
          <Link
            href="/recruiter/jobs/new"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#1D4ED8] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1E40AF]"
          >
            <Plus aria-hidden="true" className="size-4" />
            Post a job
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
        ) : result.jobs.length === 0 ? (
          <p className="rounded-2xl border border-[#E3E6EB] bg-white p-8 text-center text-sm text-[#4B5563]">
            You have not posted any jobs yet.{" "}
            <Link
              href="/recruiter/jobs/new"
              className="font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
            >
              Post your first job
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {result.jobs.map((job) => (
              <li
                key={job.id}
                className="rounded-2xl border border-[#E3E6EB] bg-white p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href={`/recruiter/jobs/${job.id}/applicants`}
                    className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-xl p-2 transition-colors hover:bg-[#F5F6F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
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

                  <div className="shrink-0 sm:border-l sm:border-[#E3E6EB] sm:pl-4">
                    <CloseJobButton
                      key={`${job.id}:${job.status}`}
                      jobId={job.id}
                      status={
                        job.status === "closed"
                          ? "closed"
                          : "open"
                      }
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </main>
  );
}
