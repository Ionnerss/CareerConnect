"use client";

import Link from "next/link";
import type { JobSearchResult } from "@/lib/jobs/search";

type JobDetailsProps = {
  job: JobSearchResult;
  onClose: () => void;
};

export function JobDetails({ job, onClose }: JobDetailsProps) {
  const companyName = job.firm_name?.trim() || "Company not listed";

  const companyInitial = companyName.charAt(0).toUpperCase();

  const salary =
    job.salary !== null
      ? `$${job.salary.toLocaleString("en-CA")}`
      : "Not specified";

  const postedDate = job.created_at
    ? new Date(job.created_at).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Not specified";

  const skills = job.required_skills
    ? job.required_skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
    : [];

  return (
    <section
      aria-label="Job details"
      className="w-full bg-background"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40">
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M9 21v-4h6v4M8 7h1M15 7h1M8 11h1M15 11h1" />
              </svg>
            </span>

            <span className="text-sm font-semibold text-foreground">
              Job overview
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close job details"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-7 p-6">
        {/* Company and job title */}
        <header className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted text-2xl font-bold text-foreground">
              {companyInitial}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-blue-600">
                {companyName}
              </p>

              <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-foreground">
                {job.title || "Untitled position"}
              </h2>

              {job.location && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  {job.location}
                </p>
              )}
            </div>
          </div>

          {job.status && (
            <span className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              {job.status}
            </span>
          )}
        </header>

        {/* Job information */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Salary
            </p>
            <p className="mt-1.5 text-base font-semibold text-foreground">
              {salary}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Location
            </p>
            <p className="mt-1.5 text-base font-semibold text-foreground">
              {job.location || "Not specified"}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Posted on
            </p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">
              {postedDate}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Company
            </p>
            <p className="mt-1.5 break-words text-sm font-semibold text-foreground">
              {companyName}
            </p>
          </div>
        </div>

        {/* Description */}
        <section className="space-y-3 border-t border-border pt-6">
          <h3 className="text-lg font-bold tracking-tight text-foreground">
            About the role
          </h3>

          <p className="whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">
            {job.description || "No job description provided."}
          </p>
        </section>

        {/* Required skills */}
        <section className="space-y-3 border-t border-border pt-6">
          <h3 className="text-lg font-bold tracking-tight text-foreground">
            Required skills
          </h3>

          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, index) => (
                <span
                  key={`${skill}-${index}`}
                  className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No specific skills listed.
            </p>
          )}
        </section>

             {/* Application action */}
        <div className="border-t border-border pt-6">
          <Link
            href={`/jobs/${encodeURIComponent(job.id)}/apply`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3151D5] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3151D5] focus-visible:ring-offset-2"
          >
            Apply for this job
          </Link>
        </div>
      </div>
    </section>
  );
}