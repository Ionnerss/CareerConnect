import { describe, expect, it } from "vitest";
import {
  ANALYTICS_RANGES,
  applicationsInRange,
  bucketApplications,
  formatHistoryDate,
} from "./analytics";

// Dates are built in local time so the tests pass in any time zone.
const NOW = new Date(2026, 10, 9, 12, 30); // Nov 9, 2026, 12:30 PM
const at = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month, day, hour).toISOString();
const app = (created_at: string | null) => ({ created_at });

describe("ANALYTICS_RANGES", () => {
  it("offers the five ranges from the issue", () => {
    expect(ANALYTICS_RANGES.map((range) => range.label)).toEqual([
      "1 day",
      "7 days",
      "30 days",
      "3 months",
      "1 year",
    ]);
  });
});

describe("bucketApplications", () => {
  it("1 day: one bar per hour, ending with the current hour", () => {
    const buckets = bucketApplications(
      [
        app(new Date(2026, 10, 9, 10, 15).toISOString()), // 2 hours ago
        app(new Date(2026, 10, 9, 10, 45).toISOString()),
        app(new Date(2026, 10, 8, 11, 0).toISOString()), // 25 hours ago, outside
      ],
      "1d",
      NOW,
    );

    expect(buckets).toHaveLength(24);
    expect(buckets.at(-1)?.label).toBe("12 PM");
    expect(buckets[21]).toMatchObject({ label: "10 AM", count: 2 });
    expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2);
  });

  it("7 days: one bar per day, ending today", () => {
    const buckets = bucketApplications(
      [app(at(2026, 10, 9)), app(at(2026, 10, 9, 8)), app(at(2026, 10, 3)), app(at(2026, 10, 2))],
      "7d",
      NOW,
    );

    expect(buckets.map((bucket) => bucket.label)).toEqual([
      "Nov 3",
      "Nov 4",
      "Nov 5",
      "Nov 6",
      "Nov 7",
      "Nov 8",
      "Nov 9",
    ]);
    expect(buckets.map((bucket) => bucket.count)).toEqual([1, 0, 0, 0, 0, 0, 2]);
  });

  it("30 days: one bar per day", () => {
    const buckets = bucketApplications([app(at(2026, 9, 11)), app(at(2026, 9, 10))], "30d", NOW);

    expect(buckets).toHaveLength(30);
    expect(buckets[0]).toMatchObject({ label: "Oct 11", count: 1 });
  });

  it("3 months: one bar per week, the last week ending today", () => {
    const buckets = bucketApplications([app(at(2026, 9, 30)), app(at(2026, 10, 5))], "3m", NOW);

    expect(buckets).toHaveLength(13);
    expect(buckets.at(-1)).toMatchObject({ fullLabel: "Nov 3 – Nov 9", count: 1 });
    expect(buckets.at(-2)).toMatchObject({ fullLabel: "Oct 27 – Nov 2", count: 1 });
  });

  it("1 year: one bar per month, ending with the current month", () => {
    const buckets = bucketApplications(
      [app(at(2026, 0, 15)), app(at(2026, 10, 1)), app(at(2025, 9, 20))],
      "1y",
      NOW,
    );

    expect(buckets).toHaveLength(12);
    expect(buckets[0]).toMatchObject({ label: "Dec", fullLabel: "Dec 2025", count: 0 });
    expect(buckets[1]).toMatchObject({ label: "Jan", count: 1 });
    expect(buckets.at(-1)).toMatchObject({ label: "Nov", count: 1 });
  });

  it("ignores missing, invalid and future dates", () => {
    const buckets = bucketApplications(
      [app(null), app("not a date"), app(at(2026, 10, 10))],
      "7d",
      NOW,
    );

    expect(buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

describe("applicationsInRange", () => {
  it("keeps only applications in the range, newest first", () => {
    const older = { id: "a", created_at: at(2026, 10, 4) };
    const newer = { id: "b", created_at: at(2026, 10, 8) };
    const outside = { id: "c", created_at: at(2026, 9, 1) };

    expect(applicationsInRange([older, outside, newer], "7d", NOW).map((a) => a.id)).toEqual(["b", "a"]);
  });
});

describe("formatHistoryDate", () => {
  it("formats a date and handles bad input", () => {
    expect(formatHistoryDate(at(2026, 10, 9))).toBe("Nov 9, 2026");
    expect(formatHistoryDate(null)).toBe("Date not available");
    expect(formatHistoryDate("nope")).toBe("Date not available");
  });
});
