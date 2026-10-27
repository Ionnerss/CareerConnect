
"use server";

import { getCurrentProfile } from "@/lib/profiles/profile";
import { getCurrentEducation } from "@/lib/profiles/profile-education";
import { getCurrentExperience } from "@/lib/profiles/profile-experience";
import { getCurrentSkills } from "@/lib/profiles/profile-skills";
import { getCurrentPreferenceLanguages } from "@/lib/profiles/profile-preferences";

type LanguageRow = {
  name: string | null;
};

function toMonth(date: string | null | undefined): string {
  return date ? date.slice(0, 7) : "";
}

function extractLanguages(
  result: Awaited<ReturnType<typeof getCurrentPreferenceLanguages>>
): string[] {
  if (!("languages" in result)) {
    return [];
  }

  const rows: LanguageRow[] = result.languages ?? [];

  return rows
    .map((item: LanguageRow) => String(item.name ?? "").trim())
    .filter((name: string) => name.length > 0);
}

export async function getApplicationProfileImport() {
  try {
    const [
      profileResult,
      educationResult,
      experienceResult,
      skillsResult,
      languagesResult,
    ] = await Promise.all([
      getCurrentProfile(),
      getCurrentEducation(),
      getCurrentExperience(),
      getCurrentSkills(),
      getCurrentPreferenceLanguages(),
    ]);

    if (
      !profileResult.success ||
      !educationResult.success ||
      !experienceResult.success ||
      !skillsResult.success ||
      !languagesResult.success
    ) {
      return {
        success: false as const,
        error:
          "Unable to load all your profile information. Please try again.",
      };
    }

    const profile = profileResult.profile;

    if (!profile) {
      return {
        success: false as const,
        error: "Profile information was not found.",
      };
    }

    // Personal information
    const nameParts = (profile.full_name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const personal = {
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" "),
      email: profile.contact_email ?? "",
      phone: "",
    };

    // Education
    const education = (educationResult.profileEducation ?? []).map(
      (item) => ({
        school: item.school ?? "",
        degree: item.degree ?? "",
        field: item.field_of_study ?? "",
        start: toMonth(item.start_date),
        end: toMonth(item.end_date),
      })
    );

    // Work experience
    const experience = (experienceResult.profileExperience ?? []).map(
      (item) => ({
        title: item.job_role ?? "",
        employer: item.company_name ?? "",
        start: toMonth(item.start_date),
        end: toMonth(item.end_date),
        description: item.description ?? "",
      })
    );

    // Skills
    const skills: string[] = (skillsResult.skills ?? [])
      .map((item) => String(item.name ?? "").trim())
      .filter((name) => name.length > 0);

    // Languages
    const languages = extractLanguages(languagesResult);

    return {
      success: true as const,
      personal,
      education,
      experience,
      skills,
      languages,
    };
  } catch {
    return {
      success: false as const,
      error: "Unable to import your profile. Please try again.",
    };
  }
}
