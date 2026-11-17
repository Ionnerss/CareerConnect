
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  MapPin,
  Pencil,
  RotateCcw,
  Search,
  Users,
  XCircle,
} from "lucide-react";

import { CloseJobButton } from "@/components/recruiter/close-job-button";

type RecruiterJob = {
  id: string;
  title: string;
  location: string;
  status: string;
  applicant_count: number;
};

type RecruiterJobsListProps = {
  jobs: RecruiterJob[];
};

type StatusFilter = "all" | "open" | "closed";
type SortOption = "most" | "fewest" | "title";

const STATUS_FILTERS: {
  value: StatusFilter;
  label: string;
}[] = [
  { value: "all", label: "All jobs" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

const SORT_OPTIONS: {
  value: SortOption;
  label: string;
}[] = [
  { value: "most", label: "Most applicants" },
  { value: "fewest", label: "Fewest applicants" },
  { value: "title", label: "Job title A–Z" },
];

export default function RecruiterJobsList({
  jobs,
}: RecruiterJobsListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("most");

  // Job statistics are based on all postings.
  const counts = useMemo(
    () => ({
      total: jobs.length,
      open: jobs.filter(
        (job) => job.status === "open"
      ).length,
      closed: jobs.filter(
        (job) => job.status === "closed"
      ).length,
    }),
    [jobs]
  );

  // Apply search, status filter, and sorting.
  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return jobs
      .filter((job) => {
        const matchesSearch =
          job.title.toLowerCase().includes(query) ||
          job.location.toLowerCase().includes(query);

        const matchesStatus =
          statusFilter === "all" ||
          job.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "fewest") {
          return (
            a.applicant_count - b.applicant_count ||
            a.title.localeCompare(b.title)
          );
        }

        if (sortBy === "title") {
          return a.title.localeCompare(b.title);
        }

        return (
          b.applicant_count - a.applicant_count ||
          a.title.localeCompare(b.title)
        );
      });
  }, [jobs, search, statusFilter, sortBy]);

  const summaryCards = [
    {
      label: "Total job postings",
      value: counts.total,
      status: "all" as StatusFilter,
      icon: BriefcaseBusiness,
      iconColor: "text-[#3151D5]",
      iconBackground: "bg-[#EDF2FF]",
    },
    {
      label: "Open postings",
      value: counts.open,
      status: "open" as StatusFilter,
      icon: CheckCircle2,
      iconColor: "text-[#16834A]",
      iconBackground: "bg-[#EAF8EF]",
    },
    {
      label: "Closed postings",
      value: counts.closed,
      status: "closed" as StatusFilter,
      icon: XCircle,
      iconColor: "text-[#DC2626]",
      iconBackground: "bg-[#FDECEC]",
    },
  ];

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    sortBy !== "most";

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setSortBy("most");
  }

  return (
    <div className="space-y-6">
      {/* Interactive job statistics */}
      <section
        aria-label="Job posting overview"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const selected = statusFilter === card.status;

          return (
            <button
              key={card.status}
              type="button"
              onClick={() => setStatusFilter(card.status)}
              aria-pressed={selected}
              className={`rounded-2xl border p-5 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3151D5] ${
                selected
                  ? "border-[#3151D5] bg-[#F7F9FF] shadow-sm"
                  : "border-[#E3E6EB] bg-white hover:border-[#B6C7FF] hover:shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-[#64748B]">
                  {card.label}
                </p>

                <div className="flex shrink-0 items-center gap-2">
                  {selected && (
                    <Check
                      aria-hidden="true"
                      className="size-4 text-[#3151D5]"
                    />
                  )}

                  <span
                    className={`flex size-9 items-center justify-center rounded-xl ${card.iconBackground}`}
                  >
                    <Icon
                      aria-hidden="true"
                      className={`size-4 ${card.iconColor}`}
                    />
                  </span>
                </div>
              </div>

              <p className="mt-3 text-3xl font-extrabold text-[#0E1726]">
                {card.value}
              </p>
            </button>
          );
        })}
      </section>

      {/* Search and filtering */}
      <section
        aria-label="Find job postings"
        className="rounded-2xl border border-[#E3E6EB] bg-white p-5 sm:p-6"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0E1726]">
              Your postings
            </h2>

            <p className="mt-1 text-sm text-[#667085]">
              Find and manage your job postings.
            </p>
          </div>

          <span
            aria-live="polite"
            className="rounded-full bg-[#EDF2FF] px-3 py-1.5 text-xs font-semibold text-[#3151D5]"
          >
            {filteredJobs.length} of {jobs.length} shown
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          {/* Search */}
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#667085]"
            />

            <input
              type="search"
              aria-label="Search job postings"
              placeholder="Search job postings..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="h-11 w-full rounded-xl border border-[#DCE1E9] bg-white pl-10 pr-3 text-sm text-[#0E1726] outline-none placeholder:text-[#98A2B3] focus:border-[#3151D5] focus:ring-2 focus:ring-[#3151D5]/15"
            />
          </div>

          {/* Sorting */}
          <div className="relative">
            <ArrowUpDown
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#667085]"
            />

            <label
              htmlFor="job-sort"
              className="sr-only"
            >
              Sort job postings
            </label>

            <select
              id="job-sort"
              value={sortBy}
              onChange={(event) =>
                setSortBy(
                  event.target.value as SortOption
                )
              }
              className="h-11 w-full rounded-xl border border-[#DCE1E9] bg-white pl-9 pr-3 text-sm font-medium text-[#0E1726] outline-none focus:border-[#3151D5] focus:ring-2 focus:ring-[#3151D5]/15"
            >
              {SORT_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status filters */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filter job postings by status"
            className="flex flex-wrap gap-2"
          >
            {STATUS_FILTERS.map((option) => {
              const selected =
                statusFilter === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setStatusFilter(option.value)
                  }
                  aria-pressed={selected}
                  className={`min-h-9 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3151D5] ${
                    selected
                      ? "border-[#3151D5] bg-[#3151D5] text-white"
                      : "border-[#DCE1E9] bg-white text-[#4B5563] hover:border-[#B6C7FF] hover:bg-[#F7F9FF]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#3151D5] hover:bg-[#F3F6FF]"
            >
              <RotateCcw
                aria-hidden="true"
                className="size-4"
              />
              Reset filters
            </button>
          )}
        </div>
      </section>

      {/* Job postings */}
      {filteredJobs.length === 0 ? (
        <div className="rounded-2xl border border-[#E3E6EB] bg-white px-6 py-10 text-center">
          <BriefcaseBusiness
            aria-hidden="true"
            className="mx-auto mb-3 size-8 text-[#98A2B3]"
          />

          <h3 className="font-semibold text-[#0E1726]">
            {jobs.length === 0
              ? "No job postings yet"
              : "No matching job postings"}
          </h3>

          <p className="mt-1 text-sm text-[#667085]">
            {jobs.length === 0
              ? "Create your first job posting to get started."
              : "Try changing your search or filters."}
          </p>

          {jobs.length === 0 ? (
            <Link
              href="/recruiter/jobs/new"
              className="mt-4 inline-block text-sm font-semibold text-[#3151D5] hover:text-[#233EA8]"
            >
              Post your first job
            </Link>
          ) : (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 text-sm font-semibold text-[#3151D5] hover:text-[#233EA8]"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredJobs.map((job) => {
            const isOpen = job.status === "open";
            const hasApplicants =
              job.applicant_count > 0;

            return (
              <li
                key={job.id}
                className="rounded-2xl border border-[#E3E6EB] bg-white p-4 transition-colors hover:border-[#C7D4F4]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  {/* Job title and status */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/recruiter/jobs/${job.id}/applicants`}
                      className="inline-block max-w-full rounded-md font-bold text-[#0E1726] hover:text-[#3151D5] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3151D5]"
                    >
                      <span className="block truncate">
                        {job.title}
                      </span>
                    </Link>

                    <div className="mt-2 flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1 text-sm text-[#667085]">
                        <MapPin
                          aria-hidden="true"
                          className="size-3.5"
                        />
                        {job.location}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isOpen
                            ? "bg-[#EAF8EF] text-[#16834A]"
                            : "bg-[#F1F3F6] text-[#667085]"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`size-1.5 rounded-full ${
                            isOpen
                              ? "bg-[#16834A]"
                              : "bg-[#98A2B3]"
                          }`}
                        />

                        {isOpen ? "Open" : "Closed"}
                      </span>
                    </div>
                  </div>

                  {/* Job actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* View applicants with count badge */}
                    <Link
                      href={`/recruiter/jobs/${job.id}/applicants`}
                      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3151D5] ${
                        hasApplicants
                          ? "border-[#DCE4F0] bg-white text-[#3151D5] hover:bg-[#F3F6FF]"
                          : "border-[#E3E6EB] bg-[#FAFBFC] text-[#667085] hover:bg-[#F5F6F8]"
                      }`}
                    >
                      <Users
                        aria-hidden="true"
                        className="size-4"
                      />

                      <span>View applicants</span>

                      <span
                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold ${
                          hasApplicants
                            ? "bg-[#EDF2FF] text-[#3151D5]"
                            : "bg-[#F1F3F6] text-[#667085]"
                        }`}
                      >
                        {job.applicant_count}
                      </span>
                    </Link>

                    {/* Edit job */}
                    <Link
                      href={`/recruiter/jobs/${job.id}/edit`}
                      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-white px-4 text-sm font-semibold text-[#3151D5] transition-colors hover:bg-[#F3F6FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3151D5]"
                    >
                      <Pencil
                        aria-hidden="true"
                        className="size-4"
                      />

                      Edit job
                    </Link>

                    {/* Close or reopen job */}
                    <CloseJobButton
                      key={`${job.id}:${job.status}`}
                      jobId={job.id}
                      status={
                        isOpen ? "open" : "closed"
                      }
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
