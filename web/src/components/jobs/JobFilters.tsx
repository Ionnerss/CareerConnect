
"use client";

import { useState } from "react";

export type JobFilterValues = {
  location: string;
  minSalary: string;
  maxSalary: string;
  experienceLevel: string;
  jobType: string;
};

const emptyFilters: JobFilterValues = {
  location: "",
  minSalary: "",
  maxSalary: "",
  experienceLevel: "",
  jobType: "",
};

type JobFiltersProps = {
  onApply: (filters: JobFilterValues) => void;
  initialFilters?: JobFilterValues;
};

export default function JobFilters({
  onApply,
  initialFilters = emptyFilters,
}: JobFiltersProps) {
  const [filters, setFilters] = useState<JobFilterValues>({
    ...initialFilters,
  });

  const [appliedFilters, setAppliedFilters] =
    useState<JobFilterValues>({ ...initialFilters });

  const [error, setError] = useState("");

  function updateFilter(field: keyof JobFilterValues, value: string) {
    setFilters((previous) => ({ ...previous, [field]: value }));
    setError("");
  }

  function applyFilters() {
    const min = filters.minSalary === "" ? null : Number(filters.minSalary);
    const max = filters.maxSalary === "" ? null : Number(filters.maxSalary);

    if (
      (min !== null && (!Number.isFinite(min) || min < 0)) ||
      (max !== null && (!Number.isFinite(max) || max < 0))
    ) {
      setError("Please enter valid, non-negative salary values.");
      return;
    }

    if (min !== null && max !== null && min > max) {
      setError("Minimum salary cannot exceed maximum salary.");
      return;
    }

    const nextFilters = { ...filters };
    setAppliedFilters(nextFilters);
    setError("");
    onApply(nextFilters);
  }

  function clearFilters() {
    const cleared = { ...emptyFilters };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setError("");
    onApply(cleared);
  }

  const activeFilters = [
    appliedFilters.location && {
      label: "Location",
      value: appliedFilters.location,
    },
    appliedFilters.minSalary && {
      label: "Min salary",
      value: `$${appliedFilters.minSalary}`,
    },
    appliedFilters.maxSalary && {
      label: "Max salary",
      value: `$${appliedFilters.maxSalary}`,
    },
    appliedFilters.experienceLevel && {
      label: "Experience",
      value: appliedFilters.experienceLevel,
    },
    appliedFilters.jobType && {
      label: "Job type",
      value: appliedFilters.jobType,
    },
  ].filter((item): item is { label: string; value: string } =>
    Boolean(item)
  );

  const inputClass =
    "h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white " +
    "px-3 text-sm text-slate-900 outline-none transition-colors " +
    "placeholder:text-slate-400 focus:border-blue-500 " +
    "focus:ring-2 focus:ring-blue-100";

  const labelClass = "mb-2 block text-xs font-semibold text-slate-600";

  return (
    <section
      aria-label="Job filters"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      {/* Compact heading */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7h16M7 12h10M10 17h4" />
              </svg>
            </span>

            <h2 className="text-base font-semibold text-slate-900">
              Filter opportunities
            </h2>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Fine-tune your search to find the right fit.
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {activeFilters.length} active{" "}
          {activeFilters.length === 1 ? "filter" : "filters"}
        </span>
      </div>

      {/* Responsive, compact filter controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div>
          <label htmlFor="job-location" className={labelClass}>
            Location
          </label>
          <input
            id="job-location"
            type="text"
            placeholder="City or location"
            value={filters.location}
            onChange={(e) => updateFilter("location", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="min-salary" className={labelClass}>
            Minimum salary ($)
          </label>
          <input
            id="min-salary"
            type="number"
            min="0"
            placeholder="e.g. 50000"
            value={filters.minSalary}
            onChange={(e) => updateFilter("minSalary", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="max-salary" className={labelClass}>
            Maximum salary ($)
          </label>
          <input
            id="max-salary"
            type="number"
            min="0"
            placeholder="e.g. 100000"
            value={filters.maxSalary}
            onChange={(e) => updateFilter("maxSalary", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="experience-level" className={labelClass}>
            Experience level
          </label>
          <select
            id="experience-level"
            value={filters.experienceLevel}
            onChange={(e) =>
              updateFilter("experienceLevel", e.target.value)
            }
            className={inputClass}
          >
            <option value="">All experience levels</option>
            <option value="Entry Level">Entry level</option>
            <option value="Mid Level">Mid level</option>
            <option value="Senior Level">Senior level</option>
          </select>
        </div>

        <div>
          <label htmlFor="job-type" className={labelClass}>
            Job type
          </label>
          <select
            id="job-type"
            value={filters.jobType}
            onChange={(e) => updateFilter("jobType", e.target.value)}
            className={inputClass}
          >
            <option value="">All job types</option>
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
            <option value="Internship">Internship</option>
          </select>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Apply Filters
        </button>

        <button
          type="button"
          onClick={clearFilters}
          className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          Clear Filters
        </button>
      </div>

      {/* Applied selections */}
      {activeFilters.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <p className="mr-1 text-xs font-semibold text-slate-600">
            Applied filters
          </p>

          {activeFilters.map((filter) => (
            <span
              key={filter.label}
              className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
            >
              {filter.label}: {filter.value}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
