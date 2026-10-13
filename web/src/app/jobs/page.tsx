import Link from "next/link";
import { redirect } from "next/navigation";
import JobSearchBar from "@/components/jobs/job-search-bar";
import { searchJobs, type JobSearchResult } from "@/lib/jobs/search";

type JobsPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const { q } = await searchParams;
  const result = await searchJobs(Array.isArray(q) ? q[0] : q);

  if (!result.success && result.error.startsWith("Unable to authenticate")) {
    redirect("/auth/login");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Find jobs</h1>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
            Back to dashboard
          </Link>
        </div>

        <JobSearchBar defaultQuery={result.query} />

        <section className="mt-8" aria-live="polite">
          {!result.success ? (
            <p role="alert" className="text-sm text-destructive">
              {result.error}
            </p>
          ) : result.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {result.query
                ? `No jobs match "${result.query}". Try a different keyword.`
                : "No jobs have been posted yet."}
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {result.query
                  ? `${result.jobs.length} result${result.jobs.length === 1 ? "" : "s"} for "${result.query}"`
                  : "Latest job postings"}
              </p>
              <ul className="flex flex-col gap-3">
                {result.jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function JobCard({ job }: { job: JobSearchResult }) {
  return (
    <li className="rounded-lg border border-border p-4">
      <h2 className="font-medium">{job.title ?? "Untitled position"}</h2>
      <p className="text-sm text-muted-foreground">
        {[job.firm_name, job.location].filter(Boolean).join(" · ") || "Company not listed"}
      </p>
      {job.description && (
        <p className="mt-2 line-clamp-2 text-sm">{job.description}</p>
      )}
      {job.salary !== null && (
        <p className="mt-2 text-sm text-muted-foreground">
          Salary: ${job.salary.toLocaleString("en-CA")}
        </p>
      )}
    </li>
  );
}
