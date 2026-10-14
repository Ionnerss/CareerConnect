
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
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 " +
    "text-sm text-slate-900 outline-none transition " +
    "focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Filter opportunities
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Refine your search to find the right opportunity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="job-location" className="mb-2 block text-sm font-medium text-slate-700">
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
          <label htmlFor="min-salary" className="mb-2 block text-sm font-medium text-slate-700">
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
          <label htmlFor="max-salary" className="mb-2 block text-sm font-medium text-slate-700">
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
          <label htmlFor="experience-level" className="mb-2 block text-sm font-medium text-slate-700">
            Experience level
          </label>
          <select
            id="experience-level"
            value={filters.experienceLevel}
            onChange={(e) => updateFilter("experienceLevel", e.target.value)}
            className={inputClass}
          >
            <option value="">All experience levels</option>
            <option value="Entry Level">Entry level</option>
            <option value="Mid Level">Mid level</option>
            <option value="Senior Level">Senior level</option>
          </select>
        </div>

        <div>
          <label htmlFor="job-type" className="mb-2 block text-sm font-medium text-slate-700">
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

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Apply Filters
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Clear Filters
        </button>
      </div>

      {activeFilters.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="mb-3 text-sm font-medium text-slate-700">
            Applied filters
          </p>
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <span
                key={filter.label}
                className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
              >
                {filter.label}: {filter.value}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  ); 
}
