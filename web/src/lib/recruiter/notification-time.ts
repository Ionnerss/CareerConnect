// Pure time helpers for recruiter notifications. `now` is a parameter so tests do not depend on the clock.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Full date and time shown on hover, e.g. "Nov 9, 2026, 2:30 PM" (Montreal time). */
export function formatNotificationDate(iso: string | null | undefined): string {
  if (!iso) return "Date not available";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date not available";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  })
    // Newer Node/browsers put a narrow no-break space before AM/PM; use a normal space.
    .replace(/\u202f/g, " ");
}

/**
 * Short timestamp for the list: "Just now", "5 minutes ago", "3 hours ago",
 * "Yesterday", "4 days ago", then the full date after a week.
 */
export function formatNotificationTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "Date not available";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "Date not available";

  const diff = Math.max(0, now.getTime() - time);

  if (diff < MINUTE_MS) return "Just now";
  if (diff < HOUR_MS) {
    const minutes = Math.floor(diff / MINUTE_MS);
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  if (diff < DAY_MS) {
    const hours = Math.floor(diff / HOUR_MS);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.floor(diff / DAY_MS);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return formatNotificationDate(iso);
}
