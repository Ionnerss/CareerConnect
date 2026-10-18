
"use client";

import { useState } from "react";
import Pagination from "@/components/pagination/pagination";
import { JobDetails } from "@/components/job-applications/JobDetails";
import type { JobSearchResult } from "@/lib/jobs/search";

const JOBS_PER_PAGE = 6;

type PaginatedJobListProps = {
  jobs: JobSearchResult[];
  query: string;
};

export default function PaginatedJobList({
  jobs,
  query,
}: PaginatedJobListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJob, setSelectedJob] =
    useState<JobSearchResult | null>(null);

  const totalPages = Math.ceil(jobs.length / JOBS_PER_PAGE);
  const safePage = Math.min(
    Math.max(currentPage, 1),
    Math.max(totalPages, 1)
  );

  const startIndex = (safePage - 1) * JOBS_PER_PAGE;
  const visibleJobs = jobs.slice(
    startIndex,
    startIndex + JOBS_PER_PAGE
  );

  function handlePageChange(page: number) {
    if (page < 1 || page > totalPages) return;

    setCurrentPage(page);
    setSelectedJob(null);
  }

  if (jobs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {query
          ? `No jobs match "${query}". Try a different keyword.`
          : "No jobs have been posted yet."}
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {query
            ? `${jobs.length} result${jobs.length === 1 ? "" : "s"} for "${query}"`
            : "Latest job postings"}
        </p>

        <p className="text-sm text-muted-foreground">
          Showing {startIndex + 1}–
          {Math.min(startIndex + JOBS_PER_PAGE, jobs.length)} of{" "}
          {jobs.length}
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {visibleJobs.map((job) => (
          <li key={job.id}>
            <button
              type="button"
              onClick={() => setSelectedJob(job)}
              className="w-full rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <h2 className="font-medium">
                {job.title ?? "Untitled position"}
              </h2>

              <p className="text-sm text-muted-foreground">
                {[job.firm_name, job.location]
                  .filter(Boolean)
                  .join(" · ") || "Company not listed"}
              </p>

              {job.description && (
                <p className="mt-2 line-clamp-2 text-sm">
                  {job.description}
                </p>
              )}

              {job.salary !== null && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Salary: ${job.salary.toLocaleString("en-CA")}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      {selectedJob && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="presentation"
        >
          {/* Dark backdrop */}
          <button
            type="button"
            aria-label="Close job details"
            onClick={() => setSelectedJob(null)}
            className="absolute inset-0 bg-black/40"
          />

          {/* Sliding details panel */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Selected job details"
            className="relative z-10 h-full w-full max-w-2xl overflow-y-auto bg-background p-4 shadow-2xl animate-in slide-in-from-right duration-300"
          >
            <JobDetails
              job={selectedJob}
              onClose={() => setSelectedJob(null)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
