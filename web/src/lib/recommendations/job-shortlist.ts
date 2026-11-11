// Picks the open postings worth showing to the AI for one job seeker.
//
// Why this exists: we never send every posting to the AI model. This plain, deterministic
// code scores each posting against the seeker's profile and keeps the best few. The AI
// (task #200) then ranks and explains only that short list. Same input, same output,
// so it is easy to test and to explain.
//
// Score out of 100:
//   skills overlap 45 | desired role vs title 20 | work mode 15
//   experience needed 10 | location 5 | employment type 5

import { computeSkillMatch, parseRequiredSkills, type SkillMatch } from "@/lib/recruiter/skill-match";
import type { DesiredPosition, DesiredWorkMode, SeekerSnapshot } from "./seeker-state";
import { totalYearsOfExperience } from "@/lib/recruiter/candidate-state";

export type JobForMatching = {
  id: string;
  title: string | null;
  firm_name: string | null;
  location: string | null;
  work_mode: string | null;
  employment_type: string | null;
  required_skills: string | null;
  salary: number | null;
  experience: number | null;
  description: string | null;
  status: string | null;
  created_at: string;
};

export type ShortlistedJob = {
  job: JobForMatching;
  /** 0 to 100. */
  score: number;
  skill_match: SkillMatch | null;
  /** Short plain-language reasons, in the order they were found. */
  reasons: string[];
};

export const DEFAULT_SHORTLIST_SIZE = 10;

export const MAX_POINTS = {
  skills: 45,
  role: 20,
  workMode: 15,
  experience: 10,
  location: 5,
  employmentType: 5,
} as const;

/** Points given when we have no information to judge a part, so unknowns do not sink a job. */
const NEUTRAL_POINTS = {
  skills: 20,
  role: 8,
  workMode: 10,
  location: 2,
  employmentType: 2,
} as const;

const WORK_MODE_LABEL: Record<Exclude<DesiredWorkMode, "no_preference">, string> = {
  remote: "remote",
  hybrid: "hybrid",
  on_site: "on-site",
};

const EMPLOYMENT_LABEL: Record<DesiredPosition, string> = {
  full_time: "full-time",
  part_time: "part-time",
  internship: "internship",
  contract: "contract",
};

function tokens(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .map((part) => part.replace(/\.+$/, ""))
      .filter((part) => part.length >= 3),
  );
}

function overlapRatio(wanted: Set<string>, title: Set<string>): number {
  if (wanted.size === 0 || title.size === 0) return 0;
  let shared = 0;
  for (const word of wanted) if (title.has(word)) shared += 1;
  return Math.min(1, shared / Math.min(wanted.size, title.size));
}

function isOpen(job: JobForMatching): boolean {
  return (job.status ?? "").trim().toLowerCase() === "open";
}

function sameWorkMode(preferred: DesiredWorkMode, jobMode: string): boolean {
  const normalized = jobMode.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return normalized === preferred.replace(/_/g, "");
}

/** Scores one posting against one seeker. Exported so it can be tested on its own. */
export function scoreJob(
  seeker: SeekerSnapshot,
  job: JobForMatching,
  now: Date = new Date(),
): ShortlistedJob {
  const reasons: string[] = [];
  let score = 0;

  // 1. Skills (45)
  const required = parseRequiredSkills(job.required_skills);
  const owned = seeker.skills.map((skill) => skill.name);
  const skillMatch = computeSkillMatch(required, owned);
  if (skillMatch) {
    score += (skillMatch.percent / 100) * MAX_POINTS.skills;
    if (skillMatch.matched.length > 0) {
      reasons.push(`You list ${skillMatch.matched.length} of ${required.length} required skills`);
    } else {
      reasons.push("None of the required skills are on your profile yet");
    }
  } else {
    score += NEUTRAL_POINTS.skills;
  }

  // 2. Desired role / recent role vs job title (20)
  const titleWords = tokens(job.title);
  const latest = [...seeker.experience].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  const desiredWords = tokens(seeker.preferences?.desired_role);
  const latestWords = tokens(latest?.job_role);
  if (desiredWords.size === 0 && latestWords.size === 0) {
    score += NEUTRAL_POINTS.role;
  } else {
    const ratio = Math.max(overlapRatio(desiredWords, titleWords), overlapRatio(latestWords, titleWords));
    score += ratio * MAX_POINTS.role;
    if (ratio >= 0.5) reasons.push("The title fits the role you are looking for");
  }

  // 3. Work mode (15)
  const preferredMode = seeker.preferences?.work_mode ?? null;
  if (!preferredMode || preferredMode === "no_preference" || !job.work_mode) {
    score += NEUTRAL_POINTS.workMode;
  } else if (sameWorkMode(preferredMode, job.work_mode)) {
    score += MAX_POINTS.workMode;
    reasons.push(`It is ${WORK_MODE_LABEL[preferredMode]}, as you prefer`);
  }

  // 4. Experience needed (10)
  if (job.experience === null || job.experience <= 0) {
    score += MAX_POINTS.experience;
  } else {
    const years = totalYearsOfExperience(seeker.experience, now);
    score += Math.min(1, years / job.experience) * MAX_POINTS.experience;
    reasons.push(
      years >= job.experience
        ? `You have the ${job.experience}+ years of experience it asks for`
        : `It asks for ${job.experience}+ years; you have ${years}`,
    );
  }

  // 5. Location (5). Remote jobs fit anywhere.
  const seekerLocation = seeker.location?.trim().toLowerCase() ?? "";
  const jobIsRemote = (job.work_mode ?? "").toLowerCase() === "remote";
  if (jobIsRemote) {
    score += MAX_POINTS.location;
  } else if (!seekerLocation || !job.location) {
    score += NEUTRAL_POINTS.location;
  } else if (job.location.toLowerCase().includes(seekerLocation) || seekerLocation.includes(job.location.toLowerCase())) {
    score += MAX_POINTS.location;
    reasons.push("It is in your area");
  }

  // 6. Employment type (5)
  const preferredType = seeker.preferences?.desired_position ?? null;
  if (!preferredType || !job.employment_type) {
    score += NEUTRAL_POINTS.employmentType;
  } else if (job.employment_type.toLowerCase().replace(/[\s_-]+/g, "") === preferredType.replace(/_/g, "")) {
    score += MAX_POINTS.employmentType;
    reasons.push(`It is ${EMPLOYMENT_LABEL[preferredType]}, as you prefer`);
  }

  return { job, score: Math.round(score), skill_match: skillMatch, reasons };
}

export type ShortlistOptions = {
  /** How many postings to keep. Defaults to 10. */
  limit?: number;
  /** Postings the seeker already applied to; they are never recommended. */
  appliedJobIds?: Iterable<string>;
  now?: Date;
};

/**
 * Returns the best open postings for this seeker, best first.
 * Closed postings and postings the seeker already applied to are left out.
 * Ties are broken by newest posting, then by id, so the order is always the same.
 */
export function shortlistJobs(
  seeker: SeekerSnapshot,
  jobs: JobForMatching[],
  options: ShortlistOptions = {},
): ShortlistedJob[] {
  const limit = Math.max(0, options.limit ?? DEFAULT_SHORTLIST_SIZE);
  const applied = new Set(options.appliedJobIds ?? []);
  const seen = new Set<string>();

  const candidates: ShortlistedJob[] = [];
  for (const job of jobs) {
    if (!isOpen(job) || applied.has(job.id) || seen.has(job.id)) continue;
    seen.add(job.id);
    candidates.push(scoreJob(seeker, job, options.now));
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      b.job.created_at.localeCompare(a.job.created_at) ||
      a.job.id.localeCompare(b.job.id),
  );

  return candidates.slice(0, limit);
}
