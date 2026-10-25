
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import JobSearchBar from "@/components/jobs/job-search-bar";
import JobFiltersUrl from "@/components/jobs/JobFiltersUrl";
import PaginatedJobList from "@/components/jobs/PaginatedJobList";
import { PageBody, PageHero } from "@/components/app/page-hero";
import { searchJobs } from "@/lib/jobs/search";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

type JobsPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function JobsPage({
  searchParams,
}: JobsPageProps) {
  const { q } = await searchParams;

  const result = await searchJobs(
    Array.isArray(q) ? q[0] : q
  );

  if (
    !result.success &&
    result.error.startsWith("Unable to authenticate")
  ) {
    redirect("/auth/login");
  }

  return (
    <main className={`${jakarta.className} min-h-screen bg-[#F5F6F8] text-[#1F2937]`}>
      <PageHero
        label="EXPLORE OPPORTUNITIES"
        title="Find your next opportunity"
        description="Explore open positions, discover new companies, and find the right role for you."
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
          ) : (
            <PaginatedJobList
              key={result.query}
              jobs={result.jobs}
              query={result.query}
            />
          )}
        </section>
      </PageBody>
    </main>
  );
}
