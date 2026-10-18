// Pure helpers for the dashboard page. No Supabase calls here, so they are easy to test.
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";

export type DashboardStatusCounts = {
  total: number;
  inProgress: number;
  interview: number;
  offers: number;
  rejected: number;
};

/**
 * Counts applications per status.
 * Uses the same status values as the application status page
 * ("In Progress", "Interview", "Accepted" = offer, "Rejected").
 */
export function countApplicationStatuses(
  applications: Pick<ApplicationCardData, "status">[]
): DashboardStatusCounts {
  const counts: DashboardStatusCounts = {
    total: applications.length,
    inProgress: 0,
    interview: 0,
    offers: 0,
    rejected: 0,
  };

  for (const { status } of applications) {
    if (status === "In Progress") counts.inProgress += 1;
    else if (status === "Interview") counts.interview += 1;
    else if (status === "Accepted") counts.offers += 1;
    else if (status === "Rejected") counts.rejected += 1;
  }

  return counts;
}

function cleanName(fullName: string | null | undefined): string {
  return (fullName ?? "").replace(/\s+/g, " ").trim();
}

/** First name for the greeting. Falls back to the part of the email before "@". */
export function getFirstName(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  const name = cleanName(fullName);
  if (name) return name.split(" ")[0];

  const local = (email ?? "").split("@")[0].trim();
  return local || "there";
}

/** Up to two initials for the avatar. Falls back to the first letter of the email. */
export function getInitials(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  const parts = cleanName(fullName).split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }

  const first = (email ?? "").trim()[0];
  return first ? first.toUpperCase() : "?";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Today", "Yesterday", "3 days ago", "2 weeks ago", otherwise a short date like "Sep 4, 2026".
 * `now` is a parameter so tests do not depend on the real clock.
 */
export function formatAppliedDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "Date not available";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date not available";

  const days = Math.floor((now.getTime() - date.getTime()) / DAY_MS);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  });
}

export type StatusTone = "progress" | "interview" | "offer" | "rejected" | "unknown";

export function getStatusTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case "In Progress":
      return "progress";
    case "Interview":
      return "interview";
    case "Accepted":
      return "offer";
    case "Rejected":
      return "rejected";
    default:
      return "unknown";
  }
}

/** Label shown in the status pill. "Accepted" is shown as "Offer" to match the stat tiles. */
export function getStatusLabel(status: string | null | undefined): string {
  if (status === "Accepted") return "Offer";
  return status?.trim() || "Unknown";
}

/** Number of colour pairs available for company letter tiles. */
export const COMPANY_TILE_COUNT = 6;

/** Picks the same tile colour every time for the same company name. */
export function getCompanyTileIndex(name: string | null | undefined): number {
  const text = (name ?? "").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % COMPANY_TILE_COUNT;
}

export type NextStep = {
  id: "name" | "resume" | "apply";
  label: string;
  href: string;
  done: boolean;
};

/** Checklist built only from data the app already stores, linking only to pages that exist. */
export function buildNextSteps(input: {
  hasName: boolean;
  resumeCount: number;
  applicationCount: number;
}): NextStep[] {
  return [
    { id: "name", label: "Add your name to your profile", href: "/profile", done: input.hasName },
    { id: "resume", label: "Upload a resume", href: "/upload-resume", done: input.resumeCount > 0 },
    { id: "apply", label: "Apply to your first job", href: "/jobs", done: input.applicationCount > 0 },
  ];
}
