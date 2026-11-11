
"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";

type FilterableApplicant = {
  application_id: string;
  full_name: string | null;
  status: string;
  applied_at: string;
  skill_match: {
    percent: number;
  } | null;
};

type ApplicantFiltersProps<T extends FilterableApplicant> = {
  applicants: T[];
  children: (filteredApplicants: T[]) => ReactNode;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "In Progress", label: "In Progress" },
  { value: "Interview", label: "Interview" },
  { value: "Accepted", label: "Accepted" },
  { value: "Rejected", label: "Rejected" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Oldest first" },
  { value: "match", label: "Best match" },
];

function localDateKey(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function ApplicantFilters<T extends FilterableApplicant>({
  applicants,
  children,
}: ApplicantFiltersProps<T>) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const counts = useMemo(
    () => ({
      total: applicants.length,
      inProgress: applicants.filter(
        (applicant) => applicant.status === "In Progress"
      ).length,
      interview: applicants.filter(
        (applicant) => applicant.status === "Interview"
      ).length,
      accepted: applicants.filter(
        (applicant) => applicant.status === "Accepted"
      ).length,
    }),
    [applicants]
  );

  const filteredApplicants = useMemo(() => {
    const query = search.trim().toLowerCase();

    return applicants
      .filter((applicant) => {
        if (
          statusFilter !== "all" &&
          applicant.status !== statusFilter
        ) {
          return false;
        }

        if (
          query &&
          !(applicant.full_name ?? "")
            .toLowerCase()
            .includes(query)
        ) {
          return false;
        }

        const appliedDate = localDateKey(applicant.applied_at);

        if (dateFrom && appliedDate < dateFrom) {
          return false;
        }

        if (dateTo && appliedDate > dateTo) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "match") {
          return (
            (b.skill_match?.percent ?? -1) -
              (a.skill_match?.percent ?? -1) ||
            b.applied_at.localeCompare(a.applied_at)
          );
        }

        if (sortBy === "oldest") {
          return a.applied_at.localeCompare(b.applied_at);
        }

        return b.applied_at.localeCompare(a.applied_at);
      });
  }, [applicants, statusFilter, search, sortBy, dateFrom, dateTo]);

  const hasFilters =
    statusFilter !== "all" ||
    search !== "" ||
    sortBy !== "recent" ||
    dateFrom !== "" ||
    dateTo !== "";

  function clearFilters() {
    setStatusFilter("all");
    setSearch("");
    setSortBy("recent");
    setDateFrom("");
    setDateTo("");
  }

  const summaryCards = [
    {
      label: "Total applicants",
      value: counts.total,
      status: "all",
      icon: Users,
      iconColor: "text-[#3151D5]",
      iconBackground: "bg-[#EDF2FF]",
    },
    {
      label: "In Progress",
      value: counts.inProgress,
      status: "In Progress",
      icon: Clock3,
      iconColor: "text-[#B7791F]",
      iconBackground: "bg-[#FFF6E5]",
    },
    {
      label: "Interviews",
      value: counts.interview,
      status: "Interview",
      icon: CalendarDays,
      iconColor: "text-[#7C3AED]",
      iconBackground: "bg-[#F3EDFF]",
    },
    {
      label: "Accepted",
      value: counts.accepted,
      status: "Accepted",
      icon: CheckCircle2,
      iconColor: "text-[#16834A]",
      iconBackground: "bg-[#EAF8EF]",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Clickable applicant statistics */}
      <section
        aria-label="Applicant overview"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const selected = statusFilter === card.status;

          return (
            <button
              key={card.label}
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
                <p className="text-sm font-medium text-[#667085]">
                  {card.label}
                </p>

                {/* Selected-card indicator */}
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

              <p className="mt-3 text-3xl font-bold tracking-tight text-[#0E1726]">
                {card.value}
              </p>
            </button>
          );
        })}
      </section>

      {/* Search and filters */}
      <section
        aria-label="Find applicants"
        className="rounded-2xl border border-[#E3E6EB] bg-white p-5 sm:p-6"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0E1726]">
              Find applicants
            </h2>
            <p className="mt-1 text-sm text-[#667085]">
              Search, filter, and sort your applications.
            </p>
          </div>

          <span
            aria-live="polite"
            className="rounded-full bg-[#EDF2FF] px-3 py-1.5 text-xs font-semibold text-[#3151D5]"
          >
            {filteredApplicants.length} of {applicants.length} shown
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#667085]"
            />

            <input
              type="search"
              aria-label="Search applicants by name"
              placeholder="Search applicants by name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#DCE1E9] bg-white pl-10 pr-3 text-sm text-[#0E1726] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#3151D5] focus:ring-2 focus:ring-[#3151D5]/15"
            />
          </div>

          <div>
            <label htmlFor="applicant-sort" className="sr-only">
              Sort by
            </label>

            <select
              id="applicant-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#DCE1E9] bg-white px-3 text-sm font-medium text-[#0E1726] outline-none transition-colors focus:border-[#3151D5] focus:ring-2 focus:ring-[#3151D5]/15"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick status filters */}
        <div
          role="group"
          aria-label="Filter by applicant status"
          className="mt-5 flex flex-wrap gap-2"
        >
          {STATUS_OPTIONS.map((option) => {
            const selected = statusFilter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
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

        {/* Optional date filters */}
        <div className="mt-5 border-t border-[#EEF0F3] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((current) => !current)}
              aria-expanded={showAdvanced}
              aria-controls="applicant-advanced-filters"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#3151D5] hover:text-[#233EA8]"
            >
              <SlidersHorizontal
                aria-hidden="true"
                className="size-4"
              />
              Advanced filters
              {dateFrom || dateTo ? " • Active" : ""}
            </button>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#3151D5] transition-colors hover:bg-[#F3F6FF] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw
                aria-hidden="true"
                className="size-4"
              />
              Reset filters
            </button>
          </div>

          {showAdvanced && (
            <div
              id="applicant-advanced-filters"
              className="mt-4 grid gap-4 rounded-xl bg-[#F8FAFD] p-4 sm:grid-cols-2"
            >
              <div className="space-y-2">
                <label
                  htmlFor="applicant-date-from"
                  className="text-sm font-semibold text-[#0E1726]"
                >
                  Applied from
                </label>

                <input
                  id="applicant-date-from"
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) =>
                    setDateFrom(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[#DCE1E9] bg-white px-3 text-sm text-[#0E1726] outline-none focus:border-[#3151D5] focus:ring-2 focus:ring-[#3151D5]/15"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="applicant-date-to"
                  className="text-sm font-semibold text-[#0E1726]"
                >
                  Applied until
                </label>

                <input
                  id="applicant-date-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) =>
                    setDateTo(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[#DCE1E9] bg-white px-3 text-sm text-[#0E1726] outline-none focus:border-[#3151D5] focus:ring-2 focus:ring-[#3151D5]/15"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Existing applicant table */}
      {children(filteredApplicants)}
    </div>
  );
}
