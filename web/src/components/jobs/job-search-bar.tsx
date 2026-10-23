
"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_JOB_SEARCH_LENGTH } from "@/lib/validations/job-search";

type JobSearchBarProps = {
  defaultQuery?: string;
};

/**
 * Search bar used on the dashboard and jobs page.
 * Preserves existing filters when submitting a new keyword.
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
  clearParams.delete("page");

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
      <label htmlFor="job-search" className="sr-only">
        Search jobs
      </label>

      <Input
        key={defaultQuery}
        id="job-search"
        name="q"
        type="search"
        defaultValue={defaultQuery}
        maxLength={MAX_JOB_SEARCH_LENGTH}
        placeholder="Job title, company, or keyword"
        className="h-12 rounded-xl border-0 bg-[#F5F6F8] px-4 text-base"
      />

      {/* Preserve selected filters when submitting a keyword search */}
      {activeFilters.map(({ key, value }) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={value}
        />
      ))}

      <Button type="submit" size="lg" className="h-12 rounded-xl px-7 text-base font-bold">
        Search
      </Button>

      {defaultQuery !== "" && (
        <Link
          href={clearUrl}
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "h-12 rounded-xl px-6",
          })}
        >
          Clear
        </Link>
      )}
    </form>
  );
}
