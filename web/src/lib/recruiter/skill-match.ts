export type SkillMatch = {
  /** Whole-number percentage of the required skills the applicant lists (0-100). */
  percent: number;
  matched: string[];
  missing: string[];
};

function normalizeSkill(skill: string): string {
  return skill.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Splits a job's required_skills text (e.g. "Typescript, React, SQL, Git") into a clean list.
 * Commas, semicolons and line breaks separate skills; blanks and repeats (ignoring case) are dropped.
 */
export function parseRequiredSkills(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }

  const seen = new Set<string>();
  const skills: string[] = [];

  for (const part of text.split(/[,;\n]+/)) {
    const skill = part.trim().replace(/\s+/g, " ");
    const key = normalizeSkill(skill);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    skills.push(skill);
  }

  return skills;
}

/**
 * Compares the skills a posting requires with the skills an applicant lists.
 * Skills match when the names are equal ignoring case and extra spaces.
 * Returns null when the posting lists no required skills, because there is nothing to compare.
 */
export function computeSkillMatch(
  requiredSkills: string[],
  applicantSkills: string[]
): SkillMatch | null {
  if (requiredSkills.length === 0) {
    return null;
  }

  const owned = new Set(applicantSkills.map(normalizeSkill));
  const matched = requiredSkills.filter((skill) => owned.has(normalizeSkill(skill)));
  const missing = requiredSkills.filter((skill) => !owned.has(normalizeSkill(skill)));

  return {
    percent: Math.round((matched.length / requiredSkills.length) * 100),
    matched,
    missing,
  };
}
