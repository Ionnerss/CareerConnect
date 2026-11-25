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

  it.each([
    { range: "1d", expectedBuckets: 25 },
    { range: "7d", expectedBuckets: 7 },
    { range: "30d", expectedBuckets: 30 },
    { range: "3m", expectedBuckets: 14 },
    { range: "1y", expectedBuckets: 13 },
  ] as const)(
    "$range: preserves empty chart buckets and returns no history",
    ({ range, expectedBuckets }) => {
      const buckets = bucketApplications([], range, NOW);
      const history = applicationsInRange([], range, NOW);

      expect(buckets).toHaveLength(expectedBuckets);
      expect(buckets.map((bucket) => bucket.count)).toEqual(
        Array(expectedBuckets).fill(0),
      );
      expect(history).toEqual([]);
    },
  );

  it.each([
    {
      range: "7d",
      cutoff: new Date(2026, 10, 3, 0, 0),
    },
    {
      range: "30d",
      cutoff: new Date(2026, 9, 11, 0, 0),
    },
  ] as const)(
    "$range: includes the exact cutoff and now, excluding dates outside them",
    ({ range, cutoff }) => {
      const applications = [
        {
          id: "before-cutoff",
          created_at: new Date(cutoff.getTime() - 1).toISOString(),
        },
        {
          id: "at-cutoff",
          created_at: cutoff.toISOString(),
        },
        {
          id: "at-now",
          created_at: NOW.toISOString(),
        },
        {
          id: "after-now",
          created_at: new Date(NOW.getTime() + 1).toISOString(),
        },
      ];

      const history = applicationsInRange(applications, range, NOW);
      const buckets = bucketApplications(applications, range, NOW);

      expect(history.map((application) => application.id)).toEqual([
        "at-now",
        "at-cutoff",
      ]);

      expect(buckets[0].count).toBe(1);
      expect(buckets.at(-1)?.count).toBe(1);
      expect(
        buckets.reduce((total, bucket) => total + bucket.count, 0),
      ).toBe(2);
    },
  );

  it("counts applications at a daily bucket boundary exactly once", () => {
    const applications = [
      app(new Date(2026, 10, 5, 23, 59, 59, 999).toISOString()),
      app(new Date(2026, 10, 6, 0, 0, 0, 0).toISOString()),
      app(new Date(2026, 10, 6, 0, 0, 0, 1).toISOString()),
    ];

    const buckets = bucketApplications(applications, "7d", NOW);

    expect(
      buckets.find((bucket) => bucket.key === "2026-11-05")?.count,
    ).toBe(1);

    expect(
      buckets.find((bucket) => bucket.key === "2026-11-06")?.count,
    ).toBe(2);

    expect(
      buckets.reduce((total, bucket) => total + bucket.count, 0),
    ).toBe(3);
  });

  it("1 day: handles an exact-hour now without dropping boundary applications", () => {
    const now = new Date(2026, 10, 9, 12, 0, 0, 0);
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const applications = [
      {
        id: "before-cutoff",
        created_at: new Date(cutoff.getTime() - 1).toISOString(),
      },
      {
        id: "at-cutoff",
        created_at: cutoff.toISOString(),
      },
      {
        id: "before-now",
        created_at: new Date(now.getTime() - 1).toISOString(),
      },
      {
        id: "at-now",
        created_at: now.toISOString(),
      },
      {
        id: "after-now",
        created_at: new Date(now.getTime() + 1).toISOString(),
      },
    ];

    const buckets = bucketApplications(applications, "1d", now);
    const history = applicationsInRange(applications, "1d", now);

    expect(buckets).toHaveLength(25);

    expect(buckets[0]).toMatchObject({
      key: cutoff.toISOString(),
      count: 1,
    });

    expect(buckets.at(-2)?.count).toBe(1);

    expect(buckets.at(-1)).toMatchObject({
      key: now.toISOString(),
      count: 1,
    });

    expect(history.map((application) => application.id)).toEqual([
      "at-now",
      "before-now",
      "at-cutoff",
    ]);

    expect(
      buckets.reduce((total, bucket) => total + bucket.count, 0),
    ).toBe(3);

    expect(new Set(buckets.map((bucket) => bucket.key)).size).toBe(
      buckets.length,
    );
  });

  it("1 year: clamps a leap-day cutoff to February 28 of the previous year", () => {
    const now = new Date(2028, 1, 29, 12, 30);
    const cutoff = new Date(2027, 1, 28, 12, 30);

    const applications = [
      {
        id: "before-cutoff",
        created_at: new Date(cutoff.getTime() - 1).toISOString(),
      },
      {
        id: "at-cutoff",
        created_at: cutoff.toISOString(),
      },
      {
        id: "march-first",
        created_at: new Date(2027, 2, 1, 0, 0).toISOString(),
      },
      {
        id: "at-now",
        created_at: now.toISOString(),
      },
      {
        id: "after-now",
        created_at: new Date(now.getTime() + 1).toISOString(),
      },
    ];

    const buckets = bucketApplications(applications, "1y", now);
    const history = applicationsInRange(applications, "1y", now);

    expect(buckets).toHaveLength(13);

    expect(buckets[0]).toMatchObject({
      key: "2027-02",
      fullLabel: "Feb 2027",
      count: 1,
    });

    expect(
      buckets.find((bucket) => bucket.key === "2027-03")?.count,
    ).toBe(1);

    expect(buckets.at(-1)).toMatchObject({
      key: "2028-02",
      fullLabel: "Feb 2028",
      count: 1,
    });

    expect(history.map((application) => application.id)).toEqual([
      "at-now",
      "march-first",
      "at-cutoff",
    ]);

    expect(
      buckets.reduce((total, bucket) => total + bucket.count, 0),
    ).toBe(3);
  });

  it.each([
    { range: "1d", expectedIds: ["today", "yesterday"] },
    { range: "7d", expectedIds: ["today", "yesterday", "five-days"] },
    {
      range: "30d",
      expectedIds: ["today", "yesterday", "five-days", "twenty-days"],
    },
    {
      range: "3m",
      expectedIds: [
        "today",
        "yesterday",
        "five-days",
        "twenty-days",
        "two-months",
      ],
    },
    {
      range: "1y",
      expectedIds: [
        "today",
        "yesterday",
        "five-days",
        "twenty-days",
        "two-months",
        "six-months",
      ],
    },
  ] as const)(
    "$range: chart counts and history match the expected applications",
    ({ range, expectedIds }) => {
      // Deliberately unsorted, with invalid and out-of-range dates.
      const applications = [
        {
          id: "two-months",
          created_at: new Date(2026, 8, 9, 12).toISOString(),
        },
        {
          id: "future",
          created_at: new Date(NOW.getTime() + 1).toISOString(),
        },
        {
          id: "five-days",
          created_at: new Date(2026, 10, 4, 12).toISOString(),
        },
        {
          id: "missing",
          created_at: null,
        },
        {
          id: "today",
          created_at: new Date(2026, 10, 9, 12).toISOString(),
        },
        {
          id: "six-months",
          created_at: new Date(2026, 4, 9, 12).toISOString(),
        },
        {
          id: "invalid",
          created_at: "not a date",
        },
        {
          id: "twenty-days",
          created_at: new Date(2026, 9, 20, 12).toISOString(),
        },
        {
          id: "too-old",
          created_at: new Date(2025, 0, 1, 12).toISOString(),
        },
        {
          id: "yesterday",
          created_at: new Date(2026, 10, 8, 13).toISOString(),
        },
      ];

      const buckets = bucketApplications(applications, range, NOW);
      const history = applicationsInRange(applications, range, NOW);
      const chartTotal = buckets.reduce(
        (total, bucket) => total + bucket.count,
        0,
      );

      expect(history.map((application) => application.id)).toEqual(
        [...expectedIds],
      );
      expect(chartTotal).toBe(expectedIds.length);
      expect(chartTotal).toBe(history.length);
    },
  );

  it.each([
  {
    scenario: "spring clock change",
    nowIso: "2026-03-08T03:30:00-04:00",
    earlierIso: "2026-03-08T01:30:00-05:00",
    earlierBucketKey: "2026-03-08T06:00:00.000Z",
    currentBucketKey: "2026-03-08T07:00:00.000Z",
  },
  {
    scenario: "autumn repeated hour",
    nowIso: "2026-11-01T01:30:00-05:00",
    earlierIso: "2026-11-01T01:30:00-04:00",
    earlierBucketKey: "2026-11-01T05:00:00.000Z",
    currentBucketKey: "2026-11-01T06:00:00.000Z",
  },
])(
  "1 day: preserves the elapsed 24-hour window during the $scenario",
    ({
      nowIso,
      earlierIso,
      earlierBucketKey,
      currentBucketKey,
    }) => {
      const now = new Date(nowIso);
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const applications = [
        {
          id: "before-cutoff",
          created_at: new Date(cutoff.getTime() - 1).toISOString(),
        },
        {
          id: "at-cutoff",
          created_at: cutoff.toISOString(),
        },
        {
          id: "earlier-hour",
          created_at: new Date(earlierIso).toISOString(),
        },
        {
          id: "at-now",
          created_at: now.toISOString(),
        },
        {
          id: "after-now",
          created_at: new Date(now.getTime() + 1).toISOString(),
        },
      ];

      const buckets = bucketApplications(applications, "1d", now);
      const history = applicationsInRange(applications, "1d", now);

      expect(buckets).toHaveLength(25);

      expect(buckets[0].count).toBe(1);

      expect(
        buckets.find((bucket) => bucket.key === earlierBucketKey)?.count,
      ).toBe(1);

      expect(buckets.at(-1)).toMatchObject({
        key: currentBucketKey,
        count: 1,
      });

      expect(new Set(buckets.map((bucket) => bucket.key)).size).toBe(
        buckets.length,
      );

      expect(history.map((application) => application.id)).toEqual([
        "at-now",
        "earlier-hour",
        "at-cutoff",
      ]);

      expect(
        buckets.reduce((total, bucket) => total + bucket.count, 0),
      ).toBe(3);
    },
  );
});

describe("applicationsInRange", () => {
  it("keeps only applications in the range, newest first", () => {
    const older = { id: "a", created_at: at(2026, 10, 4) };
    const newer = { id: "b", created_at: at(2026, 10, 8) };
    const outside = { id: "c", created_at: at(2026, 9, 1) };

    expect(applicationsInRange([older, outside, newer], "7d", NOW).map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("returns matching applications newest first without modifying the input", () => {
    const older = {
      id: "older",
      created_at: new Date(2026, 10, 4, 12).toISOString(),
    };
    const newest = {
      id: "newest",
      created_at: new Date(2026, 10, 9, 10).toISOString(),
    };
    const middle = {
      id: "middle",
      created_at: new Date(2026, 10, 7, 12).toISOString(),
    };
    const outside = {
      id: "outside",
      created_at: new Date(2026, 9, 1, 12).toISOString(),
    };

    const applications = [older, outside, newest, middle];
    const original = applications.map((application) => ({ ...application }));

    const history = applicationsInRange(applications, "7d", NOW);

    expect(history.map((application) => application.id)).toEqual([
      "newest",
      "middle",
      "older",
    ]);

    expect(applications).toEqual(original);
    expect(history).not.toBe(applications);
  });
});

describe("formatHistoryDate", () => {
  it("formats a date and handles bad input", () => {
    expect(formatHistoryDate(at(2026, 10, 9))).toBe("Nov 9, 2026");
    expect(formatHistoryDate(null)).toBe("Date not available");
    expect(formatHistoryDate("nope")).toBe("Date not available");
  });
});
