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

    expect(buckets.at(-1)?.label).toBe("12 PM");
    expect(buckets).toHaveLength(25);
    expect(buckets[22]).toMatchObject({ label: "10 AM", count: 2 });
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

  it("3 months: weekly bars reach the exact calendar-month cutoff", () => {
    const buckets = bucketApplications([app(at(2026, 9, 30)), app(at(2026, 10, 5))], "3m", NOW);

    expect(buckets).toHaveLength(14);
    expect(buckets.at(-1)).toMatchObject({ fullLabel: "Nov 3 – Nov 9", count: 1 });
    expect(buckets.at(-2)).toMatchObject({ fullLabel: "Oct 27 – Nov 2", count: 1 });
  });

  it("1 year: one bar per month, ending with the current month", () => {
    const buckets = bucketApplications(
      [app(at(2026, 0, 15)), app(at(2026, 10, 1)), app(at(2025, 9, 20))],
      "1y",
      NOW,
    );

    expect(buckets).toHaveLength(13);
    expect(buckets[0]).toMatchObject({
      label: "Nov",
      fullLabel: "Nov 2025",
      count: 0,
    });
    expect(buckets[2]).toMatchObject({ label: "Jan", count: 1 });
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

  it("uses the exact last 24 hours for both the chart and history", () => {
    const atCutoff = {
      id: "at-cutoff",
      created_at: new Date(2026, 10, 8, 12, 30, 0).toISOString(),
    };
    const beforeCutoff = {
      id: "before-cutoff",
      created_at: new Date(2026, 10, 8, 12, 29, 59).toISOString(),
    };
    const atNow = {
      id: "at-now",
      created_at: NOW.toISOString(),
    };
    const afterNow = {
      id: "after-now",
      created_at: new Date(2026, 10, 9, 12, 30, 1).toISOString(),
    };

    const applications = [beforeCutoff, atCutoff, atNow, afterNow];
    const history = applicationsInRange(applications, "1d", NOW);
    const buckets = bucketApplications(applications, "1d", NOW);

    expect(history.map((application) => application.id)).toEqual([
      "at-now",
      "at-cutoff",
    ]);
    expect(buckets).toHaveLength(25);
    expect(buckets[0].count).toBe(1);
    expect(buckets.at(-1)?.count).toBe(1);
    expect(buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(
      history.length,
    );
    expect(new Set(buckets.map((bucket) => bucket.key)).size).toBe(
      buckets.length,
    );
  });

  it("3 months starts on the same local date three months earlier", () => {
    // NOW is November 9, 2026 at 12:30 PM.
    // Three calendar months earlier is August 9 at 12:30 PM.
    const beforeCutoff = {
      id: "before-cutoff",
      created_at: new Date(2026, 7, 9, 12, 29, 59).toISOString(),
    };
    const atCutoff = {
      id: "at-cutoff",
      created_at: new Date(2026, 7, 9, 12, 30).toISOString(),
    };

    const applications = [beforeCutoff, atCutoff];
    const history = applicationsInRange(applications, "3m", NOW);
    const buckets = bucketApplications(applications, "3m", NOW);

    expect(history.map((application) => application.id)).toEqual(["at-cutoff"]);
    expect(buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(1);
  });

  it("3 months clamps the cutoff to the last day of a shorter month", () => {
    const now = new Date(2026, 4, 31, 12, 30); // May 31
    const applications = [
      {
        id: "before",
        created_at: new Date(2026, 1, 28, 12, 29, 59).toISOString(),
      },
      {
        id: "at-cutoff",
        created_at: new Date(2026, 1, 28, 12, 30).toISOString(),
      },
    ];

    const history = applicationsInRange(applications, "3m", now);
    const buckets = bucketApplications(applications, "3m", now);

    expect(history.map((application) => application.id)).toEqual(["at-cutoff"]);
    expect(buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(
      history.length,
    );
  });

  it("1 year starts at the exact calendar-year cutoff", () => {
    // NOW is November 9, 2026 at 12:30 PM.
    const applications = [
      {
        id: "before-cutoff",
        created_at: new Date(2025, 10, 9, 12, 29, 59).toISOString(),
      },
      {
        id: "at-cutoff",
        created_at: new Date(2025, 10, 9, 12, 30).toISOString(),
      },
      {
        id: "at-now",
        created_at: NOW.toISOString(),
      },
    ];

    const history = applicationsInRange(applications, "1y", NOW);
    const buckets = bucketApplications(applications, "1y", NOW);

    expect(history.map((application) => application.id)).toEqual([
      "at-now",
      "at-cutoff",
    ]);
    expect(buckets).toHaveLength(13);
    expect(buckets[0]).toMatchObject({
      label: "Nov",
      fullLabel: "Nov 2025",
      count: 1,
    });
    expect(buckets.at(-1)?.count).toBe(1);
    expect(buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(
      history.length,
    );
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
