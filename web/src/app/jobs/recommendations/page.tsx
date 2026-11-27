import type { Metadata } from "next";
import { PageBody, PageHero } from "@/components/app/page-hero";
import BackgroundRefreshControl from "@/components/recommendations/background-refresh-control";
import RecommendationsPanel from "@/components/recommendations/recommendations-panel";

export const metadata: Metadata = {
  title: "Recommended jobs",
};

// The /jobs layout enforces authentication, MFA when required,
// and the job_seeker role.
export default function RecommendedJobsPage() {
  return (
    <main className="min-h-screen bg-[#F5F6F8] text-[#1F2937]">
      <PageHero
        label="AI JOB MATCHING"
        title="Recommended for you"
        description="Open jobs that fit your skills, experience and preferences, ranked by AI and explained in plain words."
      />

      <PageBody>
        <div className="space-y-5">
          <BackgroundRefreshControl />

          <section aria-label="Job recommendations">
            <RecommendationsPanel />
          </section>
        </div>
      </PageBody>
    </main>
  );
}