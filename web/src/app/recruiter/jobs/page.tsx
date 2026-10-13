import Link from "next/link";
import { redirect } from "next/navigation";
import { AUTH_ERROR, getRecruiterJobs } from "@/lib/recruiter/applicants";

export default async function RecruiterJobsPage() {
  const result = await getRecruiterJobs();

  if (!result.success && result.error === AUTH_ERROR) {
    redirect("/auth/login");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">My job postings</h1>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
            Back to dashboard
          </Link>
        </div>

        {!result.success ? (
          <p role="alert" className="text-sm text-destructive">
            {result.error}
          </p>
        ) : result.jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have not posted any jobs yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {result.jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/recruiter/jobs/${job.id}/applicants`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 hover:bg-muted"
                >
                  <div>
                    <h2 className="font-medium">{job.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {job.location} · {job.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm">
                    {job.applicant_count} applicant{job.applicant_count === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
