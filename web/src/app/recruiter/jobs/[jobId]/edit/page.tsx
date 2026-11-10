
import Link from "next/link";

import { PageBody, PageHero } from "@/components/app/page-hero";
import { JobPostingForm } from "@/components/recruiter/job-posting-form";
import { getJobForEditing } from "@/lib/jobs/get-job";

type EditJobPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function EditJobPage({
  params,
}: EditJobPageProps) {
  const { jobId } = await params;

  const result = await getJobForEditing(jobId);

  const backLink = (
    <Link
      href="/recruiter/jobs"
      className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-[#A9C1FF] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B93FF]"
    >
      ← Back to my job postings
    </Link>
  );

  if (!result.success) {
    return (
      <main>
        <PageHero
          label="Recruiter"
          title="Edit job posting"
          description="Update your job posting information."
          action={backLink}
        />

        <PageBody>
          <div className="pt-14">
            <p
              role="alert"
              className="rounded-2xl border border-[#FCD9D9] bg-white p-5 text-sm text-destructive"
            >
              {result.error}
            </p>
          </div>
        </PageBody>
      </main>
    );
  }

  return (
    <main>
      <PageHero
        label="Recruiter"
        title="Edit job posting"
        description={`Update the information for ${result.job.title}.`}
        action={backLink}
      />

      <PageBody>
        {/* Extra spacing keeps the form below the navy header */}
        <div className="pt-14">
          <JobPostingForm
            jobId={jobId}
            initialValues={{
              ...result.job,
              salary:
                result.job.salary != null
                  ? String(result.job.salary)
                  : "",
              experience:
                result.job.experience != null
                  ? String(result.job.experience)
                  : "",
            }}
          />
        </div>
      </PageBody>
    </main>
  );
}
