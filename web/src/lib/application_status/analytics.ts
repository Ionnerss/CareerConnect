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
    const hourMs = 60 * 60 * 1000;
    const cutoff = now.getTime() - 24 * hourMs;

    // Round down to the start of the current local clock hour.
    // Subtracting elapsed minutes preserves the correct hour during
    // the repeated hour when daylight saving time ends.
    const currentHourStart =
      now.getTime() -
      (now.getMinutes() * 60 + now.getSeconds()) * 1000 -
      now.getMilliseconds();

    for (
      let hourStart = currentHourStart;
      hourStart + hourMs > cutoff;
      hourStart -= hourMs
    ) {
      const hour = new Date(hourStart);

      slots.push({
        start: new Date(Math.max(hourStart, cutoff)),
        end: new Date(hourStart + hourMs),
        key: hour.toISOString(),
        label: hourLabel(hour.getHours()),
        fullLabel: `${shortDay(hour)}, ${hourLabel(hour.getHours())}`,
      });
    }

    return slots.reverse();
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
    // Find the target month first, then clamp the day. For example,
    // May 31 minus three months becomes February 28 in 2026.
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const lastDayOfTargetMonth = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0,
    ).getDate();

    const cutoff = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth(),
      Math.min(now.getDate(), lastDayOfTargetMonth),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );

    // Retain the existing weekly alignment: the final bar ends
    // tomorrow, and each preceding bar covers seven local days.
    let end = addDays(startOfDay(now), 1);

    while (true) {
      const weekStart = addDays(end, -7);
      const start =
        weekStart.getTime() < cutoff.getTime() ? cutoff : weekStart;
      const lastDay = addDays(end, -1);

      slots.unshift({
        start,
        end,
        key: dayKey(weekStart),
        label: shortDay(start),
        fullLabel: `${shortDay(start)} – ${shortDay(lastDay)}`,
      });

      if (weekStart.getTime() <= cutoff.getTime()) break;
      end = weekStart;
    }

    return slots;
  }

  // 1 year: monthly bars from the exact calendar-year cutoff through now.
  // Clamp February 29 to February 28 when the previous year is not a leap year.
  const lastDayOfTargetMonth = new Date(
    now.getFullYear() - 1,
    now.getMonth() + 1,
    0,
  ).getDate();

  const cutoff = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    Math.min(now.getDate(), lastDayOfTargetMonth),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );

  let monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  while (true) {
    const end = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      1,
    );

    slots.unshift({
      start: monthStart.getTime() < cutoff.getTime() ? cutoff : monthStart,
      end,
      key: `${monthStart.getFullYear()}-${pad(monthStart.getMonth() + 1)}`,
      label: MONTHS[monthStart.getMonth()],
      fullLabel: `${MONTHS[monthStart.getMonth()]} ${monthStart.getFullYear()}`,
    });

    if (monthStart.getTime() <= cutoff.getTime()) break;

    monthStart = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() - 1,
      1,
    );
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
