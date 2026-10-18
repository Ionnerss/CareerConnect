import { describe, expect, it } from "vitest";
import { formatDateRange, formatMonthYear } from "./format-date";

describe("formatMonthYear", () => {
  it.each([
    ["2023-09-01", "Sep 2023"],
    ["2027-01-15", "Jan 2027"],
    ["2024-12-31", "Dec 2024"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatMonthYear(input)).toBe(expected);
  });

  it.each([null, undefined, ""])("returns an empty string for %j", (input) => {
    expect(formatMonthYear(input)).toBe("");
  });

  it("returns the original text when it is not an ISO date", () => {
    expect(formatMonthYear("soon")).toBe("soon");
  });
});

describe("formatDateRange", () => {
  it("formats a start and end date", () => {
    expect(formatDateRange("2023-09-01", "2027-04-30")).toBe("Sep 2023 – Apr 2027");
  });

  it("shows Present when there is no end date", () => {
    expect(formatDateRange("2023-09-01", null)).toBe("Sep 2023 – Present");
  });
});
