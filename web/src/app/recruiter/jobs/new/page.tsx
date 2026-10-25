import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageBody, PageHero, Surface } from "@/components/app/page-hero";
import { JobPostingForm } from "@/components/recruiter/job-posting-form";

export const metadata: Metadata = {
  title: "Post a job · CareerConnect",
  description: "Create a new job posting for job seekers to apply to.",
};

// The recruiter layout already signs the user in and keeps job seekers out.
export default function NewJobPage() {
  return (
    <main>
      <PageHero
        label="Recruiter"
        title="Post a job"
        description="Fill in the details below. Your posting goes live as soon as you post it."
        action={
          <Link
            href="/recruiter/jobs"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-[#A9C1FF] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B93FF]"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to my postings
          </Link>
        }
      />

      <PageBody>
        <Surface className="p-5 shadow-[0_10px_30px_-22px_rgba(14,23,38,0.35)] sm:p-8">
          <JobPostingForm />
        </Surface>
      </PageBody>
    </main>
  );
}
