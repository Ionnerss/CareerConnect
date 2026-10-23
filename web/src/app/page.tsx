import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import HomeNavigation from "@/components/home/home-navigation";
import HomeHero from "@/components/home/home-hero";
import HomeStatement from "@/components/home/home-statement";
import JobSeekerSection from "@/components/home/job-seeker-section";
import OpportunitiesSection from "@/components/home/opportunities-section";
import RecruiterSection from "@/components/home/recruiter-section";
import HowItWorksSection from "@/components/home/how-it-works-section";
import { HomeEnding, HomeFooter } from "@/components/home/home-ending";
import { HomeAnchors } from "@/components/home/home-motion";
import styles from "@/components/home/home.module.css";

// The homepage look (font + navy/blue colours) is scoped to this page only,
// the same way the dashboard does it, so no shared theme changes.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "CareerConnect · Job search and application tracking",
  description:
    "Build a profile with your skills, experience and projects, search for jobs, and keep track of every application. Recruiters see who applied and how their skills match.",
  openGraph: {
    title: "CareerConnect · Job search and application tracking",
    description:
      "Showcase your skills, explore opportunities, and keep your next move organized.",
    type: "website",
  },
};

export default function Home() {
  return (
    <div className={`${jakarta.className} ${styles.home}`} data-home-root>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>

      <HomeAnchors />
      <HomeNavigation />

      <main id="main-content" tabIndex={-1}>
        <HomeHero />
        <HomeStatement />
        <JobSeekerSection />
        <OpportunitiesSection />
        <RecruiterSection />
        <HowItWorksSection />
        <HomeEnding />
      </main>
      <HomeFooter />
    </div>
  );
}
