// Builds the data about one applicant that is sent to the AI model.
//
// PRIVACY: this is the only place that decides what leaves our system. It never includes
// the applicant's own name or contact email. Company and school names are included by
// default (recruiters look at them), but can be switched off with
// `includeOrganizations: false` (for example for blind screening).
// Years of experience are calculated here in code, not left to the model.

export type SkillRow = { name: string; proficiency: string };

export type EducationRow = {
  school?: string | null;
  degree: string;
  field_of_study?: string | null;
  start_date: string;
  end_date?: string | null;
  description?: string | null;
};

export type ExperienceRow = {
  company_name?: string | null;
  job_role: string;
  start_date: string;
  end_date?: string | null;
  description?: string | null;
};

export type CandidateState = {
  skills: { name: string; proficiency: string }[];
  education: {
    school?: string | null;
    degree: string;
    field_of_study: string | null;
    start: string;
    end: string | null;
    description: string | null;
  }[];
  experience: {
    company?: string | null;
    role: string;
    start: string;
    end: string | null;
    years: number;
    description: string | null;
  }[];
  total_years_of_experience: number;
};

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * (365.25 / 12);

function parseDate(value: string): Date | null {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toMonth(value: string): string {
  return value.slice(0, 7);
}

function roundYears(months: number): number {
  return Math.round((months / 12) * 10) / 10;
}

function monthsBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / MS_PER_MONTH);
}

/**
 * Total years of work, counting overlapping roles only once. A role without an end date
 * runs until `now`. Roles with an unreadable start date are skipped.
 */
export function totalYearsOfExperience(rows: ExperienceRow[], now: Date = new Date()): number {
  const ranges = rows
    .flatMap((row) => {
      const start = parseDate(row.start_date);
      if (!start) return [];
      const end = row.end_date ? (parseDate(row.end_date) ?? now) : now;
      return end.getTime() >= start.getTime() ? [{ start, end }] : [];
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let months = 0;
  let current: { start: Date; end: Date } | null = null;

  for (const range of ranges) {
    if (current && range.start.getTime() <= current.end.getTime()) {
      if (range.end.getTime() > current.end.getTime()) current.end = range.end;
    } else {
      if (current) months += monthsBetween(current.start, current.end);
      current = { start: range.start, end: range.end };
    }
  }
  if (current) months += monthsBetween(current.start, current.end);

  return roundYears(months);
}

export type BuildCandidateStateOptions = {
  /** Include company and school names. Defaults to true. */
  includeOrganizations?: boolean;
  /** Reference date for roles that have no end date. Defaults to today. */
  now?: Date;
};

export function buildCandidateState(
  input: { skills: SkillRow[]; education: EducationRow[]; experience: ExperienceRow[] },
  options: BuildCandidateStateOptions = {},
): CandidateState {
  const now = options.now ?? new Date();
  const includeOrganizations = options.includeOrganizations ?? true;

  return {
    skills: input.skills.map((skill) => ({ name: skill.name, proficiency: skill.proficiency })),
    education: input.education.map((row) => ({
      ...(includeOrganizations ? { school: row.school ?? null } : {}),
      degree: row.degree,
      field_of_study: row.field_of_study ?? null,
      start: toMonth(row.start_date),
      end: row.end_date ? toMonth(row.end_date) : null,
      description: row.description ?? null,
    })),
    experience: input.experience.map((row) => {
      const start = parseDate(row.start_date);
      const end = row.end_date ? (parseDate(row.end_date) ?? now) : now;
      return {
        ...(includeOrganizations ? { company: row.company_name ?? null } : {}),
        role: row.job_role,
        start: toMonth(row.start_date),
        end: row.end_date ? toMonth(row.end_date) : null,
        years: start ? roundYears(monthsBetween(start, end)) : 0,
        description: row.description ?? null,
      };
    }),
    total_years_of_experience: totalYearsOfExperience(input.experience, now),
  };
}
