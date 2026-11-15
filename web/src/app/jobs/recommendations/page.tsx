import type { Metadata } from "next";
import { PageBody, PageHero } from "@/components/app/page-hero";
import RecommendationsPanel from "@/components/recommendations/recommendations-panel";

export const metadata: Metadata = {
  title: "Recommended jobs",
};

// Job seekers only. The /jobs layout already requires sign-in, two-factor authentication
// when it is on, and the job_seeker role, and sends recruiters to their own pages.
export default function RecommendedJobsPage() {
  return (
    <main className="min-h-screen bg-[#F5F6F8] text-[#1F2937]">
      <PageHero
        label="AI JOB MATCHING"
        title="Recommended for you"
        description="Open jobs that fit your skills, experience and preferences, ranked by AI and explained in plain words."
      />

      <PageBody>
        <section aria-label="Job recommendations">
          <RecommendationsPanel />
        </section>
      </PageBody>
    </main>
  );
}
