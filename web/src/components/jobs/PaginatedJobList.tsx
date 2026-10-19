
"use client";

import { useEffect, useRef, useState } from "react";
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

  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    jobs[0]?.id ?? null
  );

  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const desktopPanelRef = useRef<HTMLDivElement>(null);

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

  // Keep the selected job within the current page.
  const selectedJob =
    visibleJobs.find((job) => job.id === selectedJobId) ??
    visibleJobs[0] ??
    null;

  function handlePageChange(page: number) {
    if (page < 1 || page > totalPages) return;

    setCurrentPage(page);

    setSelectedJobId(
      jobs[(page - 1) * JOBS_PER_PAGE]?.id ?? null
    );

    setMobilePanelOpen(false);
  }

 function handleSelectJob(job: JobSearchResult) {
  setSelectedJobId(job.id);
  desktopPanelRef.current?.scrollTo({ top: 0, behavior: "instant" });
  setMobilePanelOpen(true);
}

  // Close the mobile drawer with Escape.
  useEffect(() => {
    if (!mobilePanelOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobilePanelOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobilePanelOpen]);

  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background px-6 py-12 text-center">
        <h2 className="text-lg font-semibold">
          No matching jobs found
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          {query
            ? `No jobs match "${query}". Try another keyword.`
            : "No jobs have been posted yet. Check back later."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Results heading */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Available opportunities
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {query
              ? `${jobs.length} result${jobs.length === 1 ? "" : "s"} for "${query}"`
              : `${jobs.length} job${jobs.length === 1 ? "" : "s"} available`}
          </p>
        </div>

        <span className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Showing {startIndex + 1}–
          {Math.min(startIndex + JOBS_PER_PAGE, jobs.length)} of{" "}
          {jobs.length}
        </span>
      </div>

      {/* Desktop: listings on the left, details on the right */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:items-start">
        {/* Left column: job listings */}
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <ul className="flex flex-col gap-3">
            {visibleJobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;

              return (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectJob(job)}
                    aria-pressed={isSelected}
                    className={`group w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/20"
                        : "border-border bg-background hover:border-blue-300 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Company initial */}
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-base font-semibold">
                        {(job.firm_name || "C")
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      {/* Job information */}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold leading-snug tracking-tight group-hover:text-blue-600">
                          {job.title || "Untitled position"}
                        </h3>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {job.firm_name || "Company not listed"}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {job.location && (
                            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                              {job.location}
                            </span>
                          )}

                          {job.salary !== null && (
                            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                              ${job.salary.toLocaleString("en-CA")}
                            </span>
                          )}
                        </div>

                        {job.description && (
                          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {job.description}
                          </p>
                        )}
                      </div>

                      <span
                        aria-hidden="true"
                        className="text-muted-foreground group-hover:text-blue-600"
                      >
                        →
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Existing pagination */}
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>

        {/* Right column: sticky desktop job details */}
        <div className="hidden min-w-0 lg:sticky lg:top-4 lg:col-span-3 lg:block">
          {selectedJob && (
            <div
  ref={desktopPanelRef}
  className="h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-border bg-background shadow-sm"
>
              <JobDetails
                job={selectedJob}
                onClose={() => setSelectedJobId(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile: sliding job-details drawer */}
      {mobilePanelOpen && selectedJob && (
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close job details"
            onClick={() => setMobilePanelOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          {/* Mobile panel */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Selected job details"
            className="animate-in slide-in-from-right relative z-10 h-full w-full max-w-xl overflow-y-auto bg-background p-4 shadow-2xl duration-300"
          >
            <JobDetails
              job={selectedJob}
              onClose={() => setMobilePanelOpen(false)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
