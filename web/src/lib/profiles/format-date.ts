const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Formats an ISO date ("2023-09-01") as "Sep 2023".
 * The string is parsed by hand so the result never shifts with the time zone.
 */
export function formatMonthYear(date: string | null | undefined): string {
  if (!date) {
    return "";
  }

  const match = /^(\d{4})-(\d{2})/.exec(date);
  if (!match) {
    return date;
  }

  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return date;
  }

  return `${MONTHS[month - 1]} ${match[1]}`;
}

/**
 * Formats a start/end pair as "Sep 2023 – Apr 2027", or "Sep 2023 – Present"
 * when there is no end date.
 */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const from = formatMonthYear(start);
  const to = end ? formatMonthYear(end) : "Present";

  return from ? `${from} – ${to}` : to;
}
