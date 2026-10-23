import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import JobSearchBar from "@/components/jobs/job-search-bar";
import JobFiltersUrl from "@/components/jobs/JobFiltersUrl";
import PaginatedJobList from "@/components/jobs/PaginatedJobList";
import { searchJobs } from "@/lib/jobs/search";

type JobsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
  }>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const { q, page } = await searchParams;

  const result = await searchJobs(
    Array.isArray(q) ? q[0] : q,
    page
  );

  if (
    !result.success &&
    result.error.startsWith("Unable to authenticate")
  ) {
    redirect("/auth/login");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 font-[Arial,Helvetica,sans-serif]">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Find jobs</h1>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to dashboard
          </Link>
        </div>

        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">
              Loading search...
            </p>
          }
        >
          <JobSearchBar defaultQuery={result.query} />
        </Suspense>

        <div className="mt-6">
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">
                Loading filters...
              </p>
            }
          >
            <JobFiltersUrl />
          </Suspense>
        </div>

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
                key={`${result.query}:${result.page}`}
                jobs={result.jobs}
                query={result.query}
                page={result.page}
                totalCount={result.totalCount}
              />
            </Suspense>
          )}
        </section>
      </div>
    </main>
  );
}