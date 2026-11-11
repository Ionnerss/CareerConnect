// Builds the data about one job seeker that the job-recommendation feature works with.
//
// PRIVACY: this is the only place that decides what about a seeker is handed to the AI
// model. It never includes the seeker's name, email or any identifier, and it never
// includes company or school names (same rule as the recruiter comparison, agreed on
// Oct 18: less bias, fewer personal details leave our system).
// Years of experience are calculated in code, not left to the model.

import {
  buildCandidateState,
  totalYearsOfExperience,
  type CandidateState,
  type EducationRow,
  type ExperienceRow,
  type SkillRow,
} from "@/lib/recruiter/candidate-state";

export type DesiredPosition = "full_time" | "part_time" | "internship" | "contract";
export type DesiredWorkMode = "remote" | "hybrid" | "on_site" | "no_preference";

export type SeekerPreferences = {
  desired_role: string | null;
  desired_position: DesiredPosition | null;
  desired_salary: number | null;
  work_mode: DesiredWorkMode | null;
};

/** Everything we load about the signed-in seeker, before anything is trimmed for the AI. */
export type SeekerSnapshot = {
  skills: SkillRow[];
  education: EducationRow[];
  experience: ExperienceRow[];
  preferences: SeekerPreferences | null;
  /** Free-text city/region from the profile, if any. */
  location: string | null;
};

export type SeekerState = CandidateState & {
  location: string | null;
  preferences: {
    desired_role: string | null;
    desired_position: DesiredPosition | null;
    desired_salary: number | null;
    work_mode: DesiredWorkMode | null;
  };
};

/** Limits keep the AI request small and cheap, however long a profile is. */
export const MAX_SKILLS = 40;
export const MAX_EDUCATION = 5;
export const MAX_EXPERIENCE = 8;
export const MAX_DESCRIPTION_LENGTH = 400;

function clip(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_DESCRIPTION_LENGTH
    ? `${trimmed.slice(0, MAX_DESCRIPTION_LENGTH)}…`
    : trimmed;
}

/** Newest first. Rows with an unreadable date go last. */
function byStartDateDesc<T extends { start_date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.start_date.localeCompare(a.start_date));
}

/**
 * True when there is nothing useful to match on yet: no skills, no work history, no
 * education and no desired role. The recommendations page shows "complete your profile"
 * in this case and the AI is never called.
 */
export function isProfileEmpty(snapshot: SeekerSnapshot): boolean {
  return (
    snapshot.skills.length === 0 &&
    snapshot.experience.length === 0 &&
    snapshot.education.length === 0 &&
    !snapshot.preferences?.desired_role?.trim()
  );
}

export function buildSeekerState(
  snapshot: SeekerSnapshot,
  options: { now?: Date } = {},
): SeekerState {
  const now = options.now ?? new Date();

  const base = buildCandidateState(
    {
      skills: snapshot.skills.slice(0, MAX_SKILLS),
      education: byStartDateDesc(snapshot.education)
        .slice(0, MAX_EDUCATION)
        .map((row) => ({ ...row, description: clip(row.description) })),
      experience: byStartDateDesc(snapshot.experience)
        .slice(0, MAX_EXPERIENCE)
        .map((row) => ({ ...row, description: clip(row.description) })),
    },
    // Never send company or school names.
    { includeOrganizations: false, now },
  );

  const preferences = snapshot.preferences;

  return {
    ...base,
    // Use the full work history for the total, even if only the newest roles are sent.
    total_years_of_experience: totalYearsOfExperience(snapshot.experience, now),
    location: snapshot.location?.trim() || null,
    preferences: {
      desired_role: preferences?.desired_role?.trim() || null,
      desired_position: preferences?.desired_position ?? null,
      desired_salary: preferences?.desired_salary ?? null,
      work_mode: preferences?.work_mode ?? null,
    },
  };
}
