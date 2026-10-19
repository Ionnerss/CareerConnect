"use client";

import { JobDetails } from "@/components/job-applications/JobDetails";
import type { JobSearchResult } from "@/lib/jobs/search";

const previewJob: JobSearchResult = {
  id: "preview-job-1",
  title: "Software Developer",
  firm_name: "Concordia Company",
  location: "Montreal",
  description:
    "Develop web applications using TypeScript and React.",
  required_skills: "TypeScript, React, SQL, Git",
  salary: 100000,
  status: "Open",
  created_at: "2026-10-13T12:00:00Z",
};

export default function PreviewApplicationsPage() {
  return (
    <main className="p-8">
      <JobDetails
        job={previewJob}
        onClose={() => {}}
      />
    </main>
  );
}
