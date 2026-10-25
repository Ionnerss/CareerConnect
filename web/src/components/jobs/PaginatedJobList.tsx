
"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  MapPin,
  SearchX,
  Wallet,
} from "lucide-react";
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

  const selectedJob =
    visibleJobs.find((job) => job.id === selectedJobId) ??
    visibleJobs[0] ??
    null;

  function resetDetailsScroll() {
    desktopPanelRef.current?.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }

  function handlePageChange(page: number) {
    if (page < 1 || page > totalPages) return;

    setCurrentPage(page);
    setSelectedJobId(
      jobs[(page - 1) * JOBS_PER_PAGE]?.id ?? null
    );
    setMobilePanelOpen(false);
    resetDetailsScroll();
  }

  function handleSelectJob(job: JobSearchResult) {
    setSelectedJobId(job.id);
    resetDetailsScroll();
    setMobilePanelOpen(true);
  }

  // Close the mobile details drawer using Escape.
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
      <div className="rounded-3xl border border-[#E3E6EB] bg-white px-6 py-16 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF2FF]">
          <SearchX
            aria-hidden="true"
            className="h-8 w-8 text-[#1D4ED8]"
          />
        </div>

        <h2 className="text-xl font-bold text-[#0E1726]">
          No matching jobs found
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#64748B]">
          {query
            ? `No jobs match "${query}". Try another keyword or adjust your search.`
            : "No jobs have been posted yet. Check back later."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1D4ED8]" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">
              Discover opportunities
            </span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-[#0E1726]">
            Available opportunities
          </h2>

          <p className="mt-1 text-sm text-[#64748B]">
            {query
              ? `${jobs.length} result${jobs.length === 1 ? "" : "s"} for "${query}"`
              : `${jobs.length} job${jobs.length === 1 ? "" : "s"} available`}
          </p>
        </div>

        <span className="rounded-full border border-[#E3E6EB] bg-white px-4 py-2 text-xs font-semibold text-[#64748B]">
          Showing {startIndex + 1}–
          {Math.min(startIndex + JOBS_PER_PAGE, jobs.length)} of{" "}
          {jobs.length}
        </span>
      </div>

      {/* Main job browser */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
        {/* Left: list of jobs */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <ul className="flex flex-col gap-3">
            {visibleJobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;

              const company = job.firm_name?.trim() || "Company not listed";
              const title = job.title?.trim() || "Untitled position";
              const initial = company.charAt(0).toUpperCase();

              return (
                <li key={job.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectJob(job)}
                    aria-pressed={isSelected}
                    className={`group relative w-full overflow-hidden rounded-2xl border px-4 py-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 ${
                      isSelected
                        ? "border-[#3157D5] bg-[#F2F5FF] shadow-[0_5px_18px_-10px_rgba(29,78,216,0.4)]"
                        : "border-[#E3E6EB] bg-white shadow-[0_2px_10px_-6px_rgba(15,23,42,0.15)] hover:border-[#A6BAF5] hover:shadow-md"
                    }`}
                  >
                    {/* Selected card accent */}
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-1 bg-[#3157D5]"
                      />
                    )}

                    <div className="flex items-start gap-3.5">
                      {/* Company identity */}
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-lg font-extrabold ${
                          isSelected
                            ? "border-[#D5E0FF] bg-white text-[#1D4ED8]"
                            : "border-[#E5EAF5] bg-[#EEF2FF] text-[#1E40AF]"
                        }`}
                      >
                        {initial}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Position title */}
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className={`text-[15px] font-bold leading-snug tracking-tight transition-colors sm:text-base ${
                              isSelected
                                ? "text-[#1D4ED8]"
                                : "text-[#0E1726] group-hover:text-[#1D4ED8]"
                            }`}
                          >
                            {title}
                          </h3>

                          <ArrowRight
                            aria-hidden="true"
                            className={`mt-1 h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${
                              isSelected
                                ? "text-[#1D4ED8]"
                                : "text-[#94A3B8]"
                            }`}
                          />
                        </div>

                        {/* Company name */}
                        <div className="mt-2 flex items-center gap-1.5">
                          <Building2
                            aria-hidden="true"
                            className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]"
                          />
                          <p className="min-w-0 truncate text-sm font-medium text-[#475569]">
                            {company}
                          </p>
                        </div>

                        {/* Key details */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {job.location && (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-[#E5EAF2] bg-white/80 px-2.5 py-1.5 text-xs font-medium text-[#64748B]">
                              <MapPin
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                              />
                              {job.location}
                            </span>
                          )}

                          {job.salary !== null && (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-[#DCEFE7] bg-[#F0FAF5] px-2.5 py-1.5 text-xs font-semibold text-[#18794E]">
                              <Wallet
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                              />
                              ${job.salary.toLocaleString("en-CA")}
                            </span>
                          )}
                        </div>

                        {/* Short preview */}
                        {job.description && (
                          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#64748B]">
                            {job.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Selected footer */}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Existing pagination component */}
          <div className="rounded-2xl border border-[#E3E6EB] bg-white px-3 py-4 shadow-sm">
            <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
          </div>
        </div>

        {/* Right: sticky desktop details */}
        <div className="hidden min-w-0 lg:sticky lg:top-24 lg:col-span-3 lg:block">
          {selectedJob && (
            <div
              ref={desktopPanelRef}
              className="h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-[#E3E6EB] bg-white shadow-[0_6px_25px_-15px_rgba(15,23,42,0.25)]"
            >
              <JobDetails
                job={selectedJob}
                onClose={() => setSelectedJobId(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile: slide-in details drawer */}
      {mobilePanelOpen && selectedJob && (
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
          <button
            type="button"
            aria-label="Close job details"
            onClick={() => setMobilePanelOpen(false)}
            className="absolute inset-0 bg-[#0E1726]/60"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Selected job details"
            className="animate-in slide-in-from-right relative z-10 h-full w-full max-w-xl overflow-y-auto bg-white p-4 shadow-2xl duration-300"
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
