
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

import RecruiterJobsList from "@/components/recruiter/recruiter-jobs-list";

export default async function RecruiterJobsPage() {
  const result = await getRecruiterJobs();

  if (!result.success && result.error === AUTH_ERROR) {
    redirect("/auth/login");
  }

  const jobs = result.success ? result.jobs : [];

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
            <Plus
              aria-hidden="true"
              className="size-4"
            />
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
        ) : (
          <RecruiterJobsList jobs={jobs} />
        )}
      </PageBody>
    </main>
  );
}
