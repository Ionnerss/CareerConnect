import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/profiles/profile";
import { getCurrentEducation } from "@/lib/profiles/profile-education";
import { getCurrentExperience } from "@/lib/profiles/profile-experience";
import { getCurrentSkills } from "@/lib/profiles/profile-skills";
import { getCurrentProjects } from "@/lib/profiles/profile-projects";
import { getCurrentProjectLinks } from "@/lib/profiles/profile-project-links";
import {
  getCurrentProjectImages,
  getProjectImageUrl,
} from "@/lib/profiles/profile-project-images";
import { ProfileEditor, type ProfileData } from "@/components/profile/profile-editor";
import { EducationSection, type EducationEntry } from "@/components/profile/education-section";
import { ExperienceSection, type ExperienceEntry } from "@/components/profile/experience-section";
import { SkillsSection, type SkillEntry } from "@/components/profile/skills-section";
import { ProjectsSection, type ProjectEntry } from "@/components/profile/projects-section";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { DashboardShortcuts } from "@/components/dashboard/dashboard-sidebar";
import { getInitials } from "@/lib/profiles/profile-image-url";

// Same font and colours as the dashboard so the two pages feel like one app.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "My profile · CareerConnect",
  description: "Manage your profile, experience, education, skills and projects.",
};

function ProfileShell({ initials, children }: { initials: string; children: ReactNode }) {
  return (
    <div className={`${jakarta.className} min-h-screen bg-[#F5F6F8] text-[#1F2937]`}>
      <DashboardHeader initials={initials} activeHref={null} />

      <main>
        <section className="relative overflow-hidden bg-[#0E1726] text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:22px_22px]"
          />
          <div className="relative mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-4 px-4 pb-20 pt-10 sm:px-6">
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#A9C1FF]">
                Profile
              </p>
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                My profile
              </h1>
              <p className="text-base text-[#C7D0DD]">
                Keep it up to date so recruiters see your best side.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-[#A9C1FF] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B93FF]"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to dashboard
            </Link>
          </div>
        </section>

        <div className="relative z-10 mx-auto -mt-12 max-w-[1200px] px-4 pb-16 sm:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export default async function ProfilePage() {
  const result = await getCurrentProfile();

  if (!("profile" in result) || !result.profile) {
    const error = "error" in result ? result.error : "Unable to load your profile.";

    if (error.startsWith("Unable to authenticate")) {
      redirect("/auth/login");
    }

    return (
      <ProfileShell initials="?">
        <p
          role="alert"
          className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-sm font-medium text-[#B91C1C]"
        >
          {error}
        </p>
      </ProfileShell>
    );
  }

  const educationResult = await getCurrentEducation();
  const education: EducationEntry[] =
    "profileEducation" in educationResult && educationResult.profileEducation
      ? educationResult.profileEducation.map((entry) => ({
          id: entry.id,
          school: entry.school,
          degree: entry.degree,
          field_of_study: entry.field_of_study ?? null,
          start_date: entry.start_date,
          end_date: entry.end_date ?? null,
          description: entry.description ?? null,
        }))
      : [];
  const educationError =
    "error" in educationResult && educationResult.error ? educationResult.error : null;

  const experienceResult = await getCurrentExperience();
  const experience: ExperienceEntry[] =
    "profileExperience" in experienceResult && experienceResult.profileExperience
      ? experienceResult.profileExperience.map((entry) => ({
          id: entry.id,
          company_name: entry.company_name,
          job_role: entry.job_role,
          start_date: entry.start_date,
          end_date: entry.end_date ?? null,
          description: entry.description ?? null,
        }))
      : [];
  const experienceError =
    "error" in experienceResult && experienceResult.error ? experienceResult.error : null;

  const skillsResult = await getCurrentSkills();
  const skills: SkillEntry[] =
    "skills" in skillsResult && skillsResult.skills
      ? skillsResult.skills.map((entry) => ({
          id: entry.id,
          name: entry.name,
          proficiency: entry.proficiency,
        }))
      : [];
  const skillsError =
    "error" in skillsResult && skillsResult.error ? skillsResult.error : null;

  const projectsResult = await getCurrentProjects();
  const projectRows =
    "projects" in projectsResult && projectsResult.projects ? projectsResult.projects : [];
  const projects: ProjectEntry[] = await Promise.all(
    projectRows.map(async (project) => {
      const linksResult = await getCurrentProjectLinks(project.id);
      const links =
        "links" in linksResult && linksResult.links
          ? linksResult.links.map((link) => ({
              id: link.id,
              label: link.label,
              url: link.url,
            }))
          : [];

      const imagesResult = await getCurrentProjectImages(project.id);
      const imageRows =
        "images" in imagesResult && imagesResult.images ? imagesResult.images : [];
      const images = await Promise.all(
        imageRows.map(async (image) => {
          const signed = await getProjectImageUrl(image.id);
          return {
            id: image.id,
            url: signed.success && "url" in signed ? String(signed.url) : null,
            alt_text: image.alt_text ?? null,
          };
        }),
      );

      return {
        id: project.id,
        name: project.name,
        short_description: project.short_description,
        links,
        images,
      };
    }),
  );
  const projectsError =
    "error" in projectsResult && projectsResult.error ? projectsResult.error : null;

  const profile: ProfileData = {
    full_name: result.profile.full_name ?? null,
    bio: result.profile.bio ?? null,
    location: result.profile.location ?? null,
    contact_email: result.profile.contact_email ?? null,
    avatar_path: result.profile.avatar_path ?? null,
    background_path: result.profile.background_path ?? null,
  };

  return (
    <ProfileShell initials={getInitials(profile.full_name)}>
      <ProfileEditor initialProfile={profile} />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ExperienceSection initialExperience={experience} loadError={experienceError} />
          <EducationSection initialEducation={education} loadError={educationError} />
          <ProjectsSection initialProjects={projects} loadError={projectsError} />
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
          <SkillsSection initialSkills={skills} loadError={skillsError} />
          <DashboardShortcuts />
        </aside>
      </div>
    </ProfileShell>
  );
}
