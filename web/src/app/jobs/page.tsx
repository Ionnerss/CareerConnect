
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import JobSearchBar from "@/components/jobs/job-search-bar";
import JobFiltersUrl from "@/components/jobs/JobFiltersUrl";
import PaginatedJobList from "@/components/jobs/PaginatedJobList";
import { PageBody, PageHero } from "@/components/app/page-hero";
import { searchJobs } from "@/lib/jobs/search";
import { createClient } from "@/lib/supabase/server";
import type { JobSearchResult } from "@/lib/jobs/search";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

type JobsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
    location?: string | string[];
    minSalary?: string | string[];
    maxSalary?: string | string[];
    experienceLevel?: string | string[];
    jobType?: string | string[];
    selectedJob?: string | string[];
  }>;
};

export default async function JobsPage({
  searchParams,
}: JobsPageProps) {
  const {
    q,
    page,
    location,
    minSalary,
    maxSalary,
    experienceLevel,
    jobType,
    selectedJob,
  } = await searchParams;

  // Pass keyword, pagination, and filters to Supabase.
  const result = await searchJobs(
    Array.isArray(q) ? q[0] : q,
    Array.isArray(page) ? page[0] : page,
    {
      location: Array.isArray(location) ? location[0] : location,
      minSalary: Array.isArray(minSalary) ? minSalary[0] : minSalary,
      maxSalary: Array.isArray(maxSalary) ? maxSalary[0] : maxSalary,
      experienceLevel: Array.isArray(experienceLevel)
        ? experienceLevel[0]
        : experienceLevel,
      jobType: Array.isArray(jobType) ? jobType[0] : jobType,
    }
  );

  // Redirect unauthenticated users.
  if (
    !result.success &&
    result.error.startsWith("Unable to authenticate")
  ) {
    redirect("/auth/login");
  }

  const requestedJobId = Array.isArray(selectedJob)
    ? selectedJob[0]
    : selectedJob;

  let linkedJob: JobSearchResult | null = null;
  let linkedJobError = false;

  if (result.success && requestedJobId) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("job")
      .select(
        "id, title, firm_name, location, description, required_skills, salary, status, created_at"
      )
      .eq("id", requestedJobId)
      .eq("status", "open")
      .maybeSingle();

    linkedJob = (data as JobSearchResult | null) ?? null;
    linkedJobError = Boolean(error);
  }

  return (
    <main
      className={`${jakarta.className} min-h-screen bg-[#F5F6F8] text-[#1F2937]`}
    >
      <PageHero
        label="EXPLORE OPPORTUNITIES"
        title="Find your next opportunity"
        description="Explore open positions, discover new companies, and find the right role for you."
        action={
          <Link
            href="/jobs/recommendations"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0E1726] transition-colors hover:bg-[#E8EEFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1726]"
          >
            Recommended for you
          </Link>
        }
      >
        <div className="w-full max-w-3xl rounded-2xl bg-white p-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)]">
          <Suspense
            fallback={
              <p className="px-3 py-2 text-sm text-[#4B5563]">
                Loading search...
              </p>
            }
          >
            <JobSearchBar defaultQuery={result.query} />
          </Suspense>
        </div>
      </PageHero>

      <PageBody>
        {/* Job filters */}
        <Suspense
          fallback={
            <p className="text-sm text-[#4B5563]">
              Loading filters...
            </p>
          }
        >
          <JobFiltersUrl />
        </Suspense>

        {/* Job listings and details */}
        <section
          className="mt-8"
          aria-label="Job search results"
          aria-live="polite"
        >
          {!result.success ? (
            <p role="alert" className="text-sm text-destructive">
              {result.error}
            </p>
          ) : requestedJobId && !linkedJob ? (
            <div
              role={linkedJobError ? "alert" : "status"}
              className="rounded-2xl border border-[#E3E6EB] bg-white p-8 shadow-sm"
            >
              <h2 className="text-xl font-bold text-[#0E1726]">
                {linkedJobError
                  ? "Unable to load this posting"
                  : "This posting is no longer available"}
              </h2>
              <p className="mt-2 text-sm text-[#64748B]">
                {linkedJobError
                  ? "Please try again."
                  : "It may have closed or been removed."}
              </p>
              <Link
                href="/jobs"
                className="mt-5 inline-flex text-sm font-semibold text-[#3151D5] hover:underline"
              >
                Browse open jobs
              </Link>
            </div>
          ) : (
            <Suspense
              fallback={
                <p className="text-sm text-muted-foreground">
                  Loading jobs...
                </p>
              }
            >
              <PaginatedJobList
                key={JSON.stringify([
                  result.query,
                  result.page,
                  location,
                  minSalary,
                  maxSalary,
                  experienceLevel,
                  jobType,
                  requestedJobId,
                ])}
                jobs={result.jobs}
                linkedJob={linkedJob}
                query={result.query}
                page={result.page}
                totalCount={result.totalCount}
              />
            </Suspense>
          )}
        </section>
      </PageBody>
    </main>
  );
}

