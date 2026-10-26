"use server";

import { getCurrentProfile } from "@/lib/profiles/profile";
import { getCurrentEducation } from "@/lib/profiles/profile-education";
import { getCurrentExperience } from "@/lib/profiles/profile-experience";
import { getCurrentSkills } from "@/lib/profiles/profile-skills";
import { getCurrentPreferenceLanguages } from "@/lib/profiles/profile-preferences";

function month(value: string | null | undefined): string {
  return value ? String(value).slice(0, 7) : "";
}

export async function getApplicationProfileImport() {
  const profileResult = await getCurrentProfile();
  if (!("profile" in profileResult) || !profileResult.profile) {
    return { success: false as const, error: "Unable to load your profile. Please sign in again." };
  }

  const [educationResult, experienceResult, skillsResult, languagesResult] = await Promise.all([
    getCurrentEducation(),
    getCurrentExperience(),
    getCurrentSkills(),
    getCurrentPreferenceLanguages(),
  ]);

  const profile = profileResult.profile;
  const fullName = (profile.full_name ?? "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);

  const education = "profileEducation" in educationResult && educationResult.profileEducation
    ? educationResult.profileEducation.map((entry) => ({
        school: entry.school ?? "",
        degree: entry.degree ?? "",
        field: entry.field_of_study ?? "",
        start: month(entry.start_date),
        end: month(entry.end_date),
      }))
    : [];

  const experience = "profileExperience" in experienceResult && experienceResult.profileExperience
    ? experienceResult.profileExperience.map((entry) => ({
        title: entry.job_role ?? "",
        employer: entry.company_name ?? "",
        start: month(entry.start_date),
        end: month(entry.end_date),
        description: entry.description ?? "",
      }))
    : [];

  const skills = "skills" in skillsResult && skillsResult.skills
    ? skillsResult.skills.map((entry) => entry.name).filter((name): name is string => Boolean(name))
    : [];

  const languages = "languages" in languagesResult && languagesResult.languages
    ? languagesResult.languages.map((entry) => entry.name).filter((name): name is string => Boolean(name))
    : [];

  return {
    success: true as const,
    personal: {
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
      email: profile.contact_email ?? "",
      phone: "",
    },
    education,
    experience,
    skills,
    languages,
  };
}
