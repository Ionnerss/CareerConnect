
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import JobFilters, {
  type JobFilterValues,
} from "./JobFilters";

const FILTER_KEYS = [
  "location",
  "minSalary",
  "maxSalary",
  "experienceLevel",
  "jobType",
] as const;

export default function JobFiltersUrl() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Restore selected filters from the URL.
  const initialFilters: JobFilterValues = {
    location: searchParams.get("location") ?? "",
    minSalary: searchParams.get("minSalary") ?? "",
    maxSalary: searchParams.get("maxSalary") ?? "",
    experienceLevel: searchParams.get("experienceLevel") ?? "",
    jobType: searchParams.get("jobType") ?? "",
  };

  function handleApply(filters: JobFilterValues) {
    // Preserve existing URL parameters, including keyword search.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    // Remove previously applied filters.
    for (const key of FILTER_KEYS) {
      params.delete(key);
    }

    // Add the new filter selections.
    for (const key of FILTER_KEYS) {
      const value = filters[key].trim();

      if (value !== "") {
        params.set(key, value);
      }
    }

    // Navigate to the updated job-search URL.
    const query = params.toString();
    router.push(query ? `/jobs?${query}` : "/jobs");
  }

  // Reset the form when the URL filters change.
  const filterKey = JSON.stringify(initialFilters);

  return (
    <JobFilters
      key={filterKey}
      initialFilters={initialFilters}
      onApply={handleApply}
    />
  );
}
