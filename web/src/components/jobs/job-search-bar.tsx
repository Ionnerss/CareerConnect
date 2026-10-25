
"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_JOB_SEARCH_LENGTH } from "@/lib/validations/job-search";

type JobSearchBarProps = {
  defaultQuery?: string;
};

/**
 * Search bar used on the jobs page.
 * Preserves selected filters when searching by keyword.
 */
export default function JobSearchBar({
  defaultQuery = "",
}: JobSearchBarProps) {
  const searchParams = useSearchParams();

  const filterKeys = [
    "location",
    "minSalary",
    "maxSalary",
    "experienceLevel",
    "jobType",
  ] as const;

  const activeFilters = filterKeys
    .map((key) => ({
      key,
      value: searchParams.get(key) ?? "",
    }))
    .filter(({ value }) => value !== "");

  const clearParams = new URLSearchParams(searchParams.toString());
  clearParams.delete("q");

  const clearUrl = clearParams.toString()
    ? `/jobs?${clearParams.toString()}`
    : "/jobs";

  return (
    <form
      action="/jobs"
      method="get"
      role="search"
      className="flex w-full flex-col gap-2 sm:flex-row"
    >
      {/* Search input */}
      <div className="relative min-w-0 flex-1">
        <label htmlFor="job-search" className="sr-only">
          Search jobs
        </label>

        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#64748B]"
        />

        <Input
          key={defaultQuery}
          id="job-search"
          name="q"
          type="search"
          defaultValue={defaultQuery}
          maxLength={MAX_JOB_SEARCH_LENGTH}
          placeholder="Job title, company, or keyword"
          className="h-12 w-full rounded-xl border-0 bg-[#F5F6F8] pl-12 pr-4 text-base text-[#0E1726] caret-[#1D4ED8] shadow-none outline-none placeholder:text-[#64748B] focus-visible:ring-2 focus-visible:ring-[#93A8F5]"
        />
      </div>

      {/* Preserve filters during keyword search */}
      {activeFilters.map(({ key, value }) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={value}
        />
      ))}

      {/* Search button */}
      <Button
        type="submit"
        size="lg"
        className="h-12 rounded-xl bg-[#3151D5] px-7 text-base font-bold text-white transition-colors hover:bg-[#1E40AF]"
      >
        Search
      </Button>

      {/* Clear only the keyword, retaining selected filters */}
      {defaultQuery !== "" && (
        <Link
          href={clearUrl}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#E3E6EB] bg-[#F5F6F8] px-5 text-sm font-semibold text-[#334155] transition-colors hover:bg-[#E9EDF5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93A8F5]"
        >
          <X aria-hidden="true" className="h-4 w-4" />
          Clear
        </Link>
      )}
    </form>
  );
}
