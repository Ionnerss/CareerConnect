
"use client";

import type { JobSearchResult } from "@/lib/jobs/search";

type JobDetailsProps = {
  job: JobSearchResult;
  onClose: () => void;
};

export function JobDetails({ job, onClose }: JobDetailsProps) {
  return (
    <section
      aria-label="Job details"
      className="w-full rounded-lg border border-border bg-background p-6"
    >
      <header className="flex flex-col gap-3 border-b pb-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">
            {job.title ?? "Untitled position"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close job details"
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            Close
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          {[job.firm_name, job.location]
            .filter(Boolean)
            .join(" · ") || "Company not listed"}
        </p>
      </header>

      <div className="mt-6 space-y-6">
        <section>
          <h3 className="text-lg font-semibold">
            Job Description
          </h3>

          <p className="mt-2 whitespace-pre-line text-sm leading-6">
            {job.description || "No description provided."}
          </p>
        </section>

        <section className="rounded-lg border p-5">
          <h3 className="text-lg font-semibold">
            Job Details
          </h3>

          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Company</dt>
              <dd className="font-medium">
                {job.firm_name || "Not specified"}
              </dd>
            </div>

            <div>
              <dt className="text-muted-foreground">Location</dt>
              <dd className="font-medium">
                {job.location || "Not specified"}
              </dd>
            </div>

            <div>
              <dt className="text-muted-foreground">Salary</dt>
              <dd className="font-medium">
                {job.salary !== null
                  ? `$${job.salary.toLocaleString("en-CA")}`
                  : "Not specified"}
              </dd>
            </div>

            <div>
              <dt className="text-muted-foreground">
                Required Skills
              </dt>
              <dd className="font-medium">
                {job.required_skills || "Not specified"}
              </dd>
            </div>

            <div>
              <dt className="text-muted-foreground">Posted</dt>
              <dd className="font-medium">
                {new Date(job.created_at).toLocaleDateString(
                  "en-CA",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="mt-6 border-t pt-6">
        <button
          type="button"
          disabled
          title="Application form integration is pending"
          className="w-full cursor-not-allowed rounded-md bg-primary px-4 py-2 text-primary-foreground opacity-50"
        >
          Apply for this job
        </button>
      </div>
    </section>
  );
}
