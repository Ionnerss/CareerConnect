import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import JobApplicationForm from "@/components/job-applications/JobApplicationForm";
import CoverLetterUpload from "@/components/job-applications/CoverLetterUpload";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

type ApplyPageProps = {
  params: Promise<{
    jobID: string;
  }>;
};

export default async function ApplyPage({
  params,
}: ApplyPageProps) {
  const { jobID } = await params;

  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
  }

  // Retrieve the job so existing applicants can attach a letter if it closes
  const { data: job, error: jobError } = await supabase
    .from("job")
    .select("id, title, firm_name, location, status")
    .eq("id", jobID)
    .maybeSingle();

  if (jobError || !job) {
    notFound();
  }

  // Check whether this applicant has already applied
  const {
    data: existingApplication,
    error: applicationError,
  } = await supabase
    .from("applications")
    .select("id, status, cover_letter_path")
    .eq("job_id", jobID)
    .eq("applicant_id", user.id)
    .maybeSingle();

  const jobTitle = job.title || "Untitled position";
  const companyName = job.firm_name || "Company not listed";

  const alreadyApplied = Boolean(existingApplication);

  return (
    <main
      className={`${jakarta.className} min-h-screen bg-[#F5F6F8] text-[#0E1726]`}
    >
      {/* Application header */}
      <header className="bg-[#0E1726] px-6 py-12 text-white">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/jobs?selectedJob=${encodeURIComponent(job.id)}`}
            scroll={true}
            className="mb-6 inline-flex text-sm font-medium text-[#CBD5E1] transition-colors hover:text-white"
          >
            ← Back to job listings
          </Link>

          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#A5B4FC]">
            CareerConnect · Job Application
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Apply for {jobTitle}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#CBD5E1]">
            <span>{companyName}</span>

            {job.location && (
              <>
                <span aria-hidden="true">·</span>
                <span>{job.location}</span>
              </>
            )}
          </div>

          <p className="mt-5 max-w-2xl text-sm leading-6 text-[#CBD5E1]">
            {alreadyApplied
              ? "You have already submitted an application for this position."
              : "Complete the application form below. Review your information carefully before submitting your application."}
          </p>
        </div>
      </header>

      {/* Application content */}
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {applicationError ? (
          <section
            role="alert"
            className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm"
          >
            <h2 className="text-xl font-bold text-red-700">
              Unable to verify application status
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#475569]">
              We could not determine whether you have already applied for
              this job. Please try again before submitting another
              application.
            </p>

            <Link
              href="/application-status"
              className="mt-5 inline-flex rounded-xl bg-[#3151D5] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1E40AF]"
            >
              View my applications
            </Link>
          </section>
        ) : !alreadyApplied && job.status !== "open" ? (
          <section
            role="status"
            className="rounded-2xl border border-[#E3E6EB] bg-white p-8 shadow-sm"
          >
            <h2 className="text-xl font-bold text-[#0E1726]">
              This job is no longer accepting applications
            </h2>
            <Link
              href="/jobs"
              className="mt-5 inline-flex text-sm font-semibold text-[#3151D5] hover:underline"
            >
              Browse open jobs
            </Link>
          </section>
        ) : alreadyApplied ? (
          <section
            role="status"
            className="rounded-2xl border border-[#C7D2FE] bg-white p-8 shadow-sm sm:p-10"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF] text-[#3151D5]">
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12 2.5 2.5L16 9" />
              </svg>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-[#0E1726]">
              You have already applied for this job
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#475569]">
              Your application for{" "}
              <strong>{jobTitle}</strong> at{" "}
              <strong>{companyName}</strong> has already been
              submitted. You cannot submit another application
              for the same job.
            </p>

            {existingApplication?.status && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-2 text-sm font-semibold text-[#3151D5]">
                <span
                  className="h-2 w-2 rounded-full bg-[#3151D5]"
                  aria-hidden="true"
                />
                Status: {existingApplication.status}
              </div>
            )}

            {existingApplication && !existingApplication.cover_letter_path && (
              <CoverLetterUpload applicationId={existingApplication.id} />
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/application-status"
                className="inline-flex items-center justify-center rounded-xl bg-[#3151D5] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF]"
              >
                View my applications
              </Link>

              <Link
                href={`/jobs?selectedJob=${encodeURIComponent(job.id)}`}
                className="inline-flex items-center justify-center rounded-xl border border-[#DDE3ED] bg-white px-5 py-3 text-sm font-semibold text-[#0E1726] transition-colors hover:bg-[#F5F6F8]"
              >
                Back to job listings
              </Link>
            </div>
          </section>
        ) : (
          <JobApplicationForm
            jobId={job.id}
            jobTitle={jobTitle}
            company={companyName}
          />
        )}
      </div>
    </main>
  );
}