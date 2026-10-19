import Link from "next/link";
import { redirect } from "next/navigation";
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

export default async function ProfilePage() {
  const result = await getCurrentProfile();

  if (!("profile" in result) || !result.profile) {
    const error = "error" in result ? result.error : "Unable to load your profile.";

    if (error.startsWith("Unable to authenticate")) {
      redirect("/auth/login");
    }

    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm hover:underline">
            Back to dashboard
          </Link>
        </div>
      </main>
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
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">My profile</h1>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="space-y-6">
          <ProfileEditor initialProfile={profile} />
          <ExperienceSection initialExperience={experience} loadError={experienceError} />
          <EducationSection initialEducation={education} loadError={educationError} />
          <SkillsSection initialSkills={skills} loadError={skillsError} />
          <ProjectsSection initialProjects={projects} loadError={projectsError} />
        </div>
      </div>
    </main>
  );
}
