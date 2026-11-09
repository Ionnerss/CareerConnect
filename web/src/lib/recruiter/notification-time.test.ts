import { describe, expect, it } from "vitest";
import { formatNotificationDate, formatNotificationTime } from "./notification-time";

const NOW = new Date("2026-11-09T20:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatNotificationTime", () => {
  it.each([
    [10 * 1000, "Just now"],
    [1 * MINUTE, "1 minute ago"],
    [45 * MINUTE, "45 minutes ago"],
    [1 * HOUR, "1 hour ago"],
    [5 * HOUR, "5 hours ago"],
    [1 * DAY + HOUR, "Yesterday"],
    [3 * DAY, "3 days ago"],
  ])("shows %i ms ago as %s", (ms, expected) => {
    expect(formatNotificationTime(ago(ms), NOW)).toBe(expected);
  });

  it("shows the full date after a week", () => {
    expect(formatNotificationTime("2026-10-20T18:30:00Z", NOW)).toBe("Oct 20, 2026, 2:30 PM");
  });

  it("treats a time slightly in the future as just now", () => {
    expect(formatNotificationTime(new Date(NOW.getTime() + 5000).toISOString(), NOW)).toBe("Just now");
  });

  it("handles missing or invalid dates", () => {
    expect(formatNotificationTime(null, NOW)).toBe("Date not available");
    expect(formatNotificationTime("nope", NOW)).toBe("Date not available");
  });
});

describe("formatNotificationDate", () => {
  it("formats the date and time in Montreal time", () => {
    expect(formatNotificationDate("2026-11-09T19:30:00Z")).toBe("Nov 9, 2026, 2:30 PM");
  });

  it("handles missing or invalid dates", () => {
    expect(formatNotificationDate(undefined)).toBe("Date not available");
    expect(formatNotificationDate("nope")).toBe("Date not available");
  });
});
