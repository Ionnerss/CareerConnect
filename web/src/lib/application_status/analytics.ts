// Pure helpers for the Application Analytics page. No Supabase calls, so they are easy to test.
// `now` is always a parameter so tests do not depend on the real clock.

export const ANALYTICS_RANGES = [
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "3m", label: "3 months" },
  { value: "1y", label: "1 year" },
] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]["value"];

export const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = "30d";

export type ChartBucket = {
  /** Stable key for React lists, e.g. "2026-11-09" or "2026-11-09T14". */
  key: string;
  /** Short label under the bar, e.g. "2 PM", "Nov 9", "Nov 3", "Nov". */
  label: string;
  /** Longer label for screen readers and tooltips, e.g. "Nov 3 – Nov 9". */
  fullLabel: string;
  count: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shortDay(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function hourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

type Slot = { start: Date; end: Date; key: string; label: string; fullLabel: string };

/**
 * The time slots shown in the chart for a range, oldest first:
 * 1 day = 24 hours, 7 days and 30 days = one bar per day,
 * 3 months = 13 weeks, 1 year = 12 months. The last slot always contains `now`.
 */
function buildSlots(range: AnalyticsRange, now: Date): Slot[] {
  const slots: Slot[] = [];

  if (range === "1d") {
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    for (let i = 23; i >= 0; i -= 1) {
      const start = new Date(currentHour.getTime() - i * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      slots.push({
        start,
        end,
        key: `${dayKey(start)}T${pad(start.getHours())}`,
        label: hourLabel(start.getHours()),
        fullLabel: `${shortDay(start)}, ${hourLabel(start.getHours())}`,
      });
    }
    return slots;
  }

  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    const today = startOfDay(now);
    for (let i = days - 1; i >= 0; i -= 1) {
      const start = addDays(today, -i);
      slots.push({
        start,
        end: addDays(start, 1),
        key: dayKey(start),
        label: shortDay(start),
        fullLabel: shortDay(start),
      });
    }
    return slots;
  }

  if (range === "3m") {
    // 13 weeks; the last week ends today (inclusive).
    const tomorrow = addDays(startOfDay(now), 1);
    for (let i = 12; i >= 0; i -= 1) {
      const end = addDays(tomorrow, -7 * i);
      const start = addDays(end, -7);
      const lastDay = addDays(end, -1);
      slots.push({
        start,
        end,
        key: dayKey(start),
        label: shortDay(start),
        fullLabel: `${shortDay(start)} – ${shortDay(lastDay)}`,
      });
    }
    return slots;
  }

  // 1 year: the current month and the 11 before it.
  for (let i = 11; i >= 0; i -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    slots.push({
      start,
      end,
      key: `${start.getFullYear()}-${pad(start.getMonth() + 1)}`,
      label: MONTHS[start.getMonth()],
      fullLabel: `${MONTHS[start.getMonth()]} ${start.getFullYear()}`,
    });
  }
  return slots;
}

function toTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : time;
}

/** Counts applications per time slot for the chosen range. Dates outside the range or invalid are ignored. */
export function bucketApplications(
  applications: { created_at: string | null }[],
  range: AnalyticsRange,
  now: Date = new Date(),
): ChartBucket[] {
  const slots = buildSlots(range, now);
  const counts = slots.map(() => 0);
  const nowTime = now.getTime();

  for (const application of applications) {
    const time = toTime(application.created_at);
    if (time === null || time > nowTime) continue;

    const index = slots.findIndex((slot) => time >= slot.start.getTime() && time < slot.end.getTime());
    if (index !== -1) counts[index] += 1;
  }

  return slots.map((slot, index) => ({
    key: slot.key,
    label: slot.label,
    fullLabel: slot.fullLabel,
    count: counts[index],
  }));
}

/** The applications submitted inside the chosen range, newest first. */
export function applicationsInRange<T extends { created_at: string | null }>(
  applications: T[],
  range: AnalyticsRange,
  now: Date = new Date(),
): T[] {
  const slots = buildSlots(range, now);
  const from = slots[0].start.getTime();
  const to = now.getTime();

  return applications
    .filter((application) => {
      const time = toTime(application.created_at);
      return time !== null && time >= from && time <= to;
    })
    .sort((a, b) => (toTime(b.created_at) ?? 0) - (toTime(a.created_at) ?? 0));
}

/** "Mon, Nov 9, 2026" style date for the history list. */
export function formatHistoryDate(iso: string | null | undefined): string {
  const time = toTime(iso);
  if (time === null) return "Date not available";
  const date = new Date(time);
  return `${shortDay(date)}, ${date.getFullYear()}`;
}
