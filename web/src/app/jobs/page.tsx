import { Suspense } from "react";
import { redirect } from "next/navigation";
import JobSearchBar from "@/components/jobs/job-search-bar";
import JobFiltersUrl from "@/components/jobs/JobFiltersUrl";
import PaginatedJobList from "@/components/jobs/PaginatedJobList";
import { PageBody, PageHero } from "@/components/app/page-hero";
import { searchJobs } from "@/lib/jobs/search";

type JobsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
    location?: string | string[];
    minSalary?: string | string[];
    maxSalary?: string | string[];
    experienceLevel?: string | string[];
    jobType?: string | string[];
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
  } = await searchParams;

  // Pass keyword, pagination, and filters to Supabase.
  const result = await searchJobs(
    Array.isArray(q) ? q[0] : q,
    Array.isArray(page) ? page[0] : page,
    {
      location,
      minSalary,
      maxSalary,
      experienceLevel,
      jobType,
    }
  );

  // Redirect unauthenticated users.
  if (
    !result.success &&
    result.error.startsWith("Unable to authenticate")
  ) {
    redirect("/auth/login");
  }

  return (
    <main>
      <PageHero
        label="Jobs"
        title="Find jobs"
        description="Search by keyword, then narrow it down with filters."
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
        {/* Job filtering interface */}
        <div>
          <Suspense
            fallback={
              <p className="text-sm text-[#4B5563]">
                Loading filters...
              </p>
            }
          >
            <JobFiltersUrl />
          </Suspense>
        </div>

        {/* Job search results */}
        <section
          className="mt-8"
          aria-label="Job search results"
          aria-live="polite"
        >
          {!result.success ? (
            <p role="alert" className="text-sm text-destructive">
              {result.error}
            </p>
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
                ])}
                jobs={result.jobs}
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
