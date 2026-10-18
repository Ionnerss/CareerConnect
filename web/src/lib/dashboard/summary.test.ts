import { describe, expect, it } from "vitest";
import {
  COMPANY_TILE_COUNT,
  buildNextSteps,
  countApplicationStatuses,
  formatAppliedDate,
  getCompanyTileIndex,
  getFirstName,
  getInitials,
  getStatusLabel,
  getStatusTone,
} from "./summary";

describe("countApplicationStatuses", () => {
  it("returns zeros for no applications", () => {
    expect(countApplicationStatuses([])).toEqual({
      total: 0,
      inProgress: 0,
      interview: 0,
      offers: 0,
      rejected: 0,
    });
  });

  it("counts each known status and keeps unknown ones only in the total", () => {
    const counts = countApplicationStatuses([
      { status: "In Progress" },
      { status: "In Progress" },
      { status: "Interview" },
      { status: "Accepted" },
      { status: "Rejected" },
      { status: null },
      { status: "Something else" },
    ]);

    expect(counts).toEqual({
      total: 7,
      inProgress: 2,
      interview: 1,
      offers: 1,
      rejected: 1,
    });
  });
});

describe("getFirstName", () => {
  it("uses the first word of the full name", () => {
    expect(getFirstName("  Sam   Tremblay ", "sam@example.com")).toBe("Sam");
  });

  it("falls back to the email before the @", () => {
    expect(getFirstName(null, "sam.t@example.com")).toBe("sam.t");
    expect(getFirstName("   ", "sam.t@example.com")).toBe("sam.t");
  });

  it("falls back to 'there' when nothing is available", () => {
    expect(getFirstName(null, null)).toBe("there");
    expect(getFirstName("", "")).toBe("there");
  });
});

describe("getInitials", () => {
  it("uses first and last name", () => {
    expect(getInitials("sam alex tremblay", null)).toBe("ST");
  });

  it("uses one letter for a single name", () => {
    expect(getInitials("Sam", null)).toBe("S");
  });

  it("falls back to the email, then to ?", () => {
    expect(getInitials(null, "yousef@example.com")).toBe("Y");
    expect(getInitials(null, null)).toBe("?");
  });
});

describe("formatAppliedDate", () => {
  const now = new Date("2026-10-18T16:00:00Z");

  it("handles missing and invalid dates", () => {
    expect(formatAppliedDate(null, now)).toBe("Date not available");
    expect(formatAppliedDate("not a date", now)).toBe("Date not available");
  });

  it("returns relative labels for recent dates", () => {
    expect(formatAppliedDate("2026-10-18T10:00:00Z", now)).toBe("Today");
    expect(formatAppliedDate("2026-10-19T10:00:00Z", now)).toBe("Today");
    expect(formatAppliedDate("2026-10-17T10:00:00Z", now)).toBe("Yesterday");
    expect(formatAppliedDate("2026-10-15T10:00:00Z", now)).toBe("3 days ago");
    expect(formatAppliedDate("2026-10-10T10:00:00Z", now)).toBe("1 week ago");
    expect(formatAppliedDate("2026-10-01T10:00:00Z", now)).toBe("2 weeks ago");
  });

  it("returns a short date after 30 days", () => {
    expect(formatAppliedDate("2026-09-04T16:00:00Z", now)).toBe("Sep 4, 2026");
  });
});

describe("status helpers", () => {
  it("maps statuses to tones", () => {
    expect(getStatusTone("In Progress")).toBe("progress");
    expect(getStatusTone("Interview")).toBe("interview");
    expect(getStatusTone("Accepted")).toBe("offer");
    expect(getStatusTone("Rejected")).toBe("rejected");
    expect(getStatusTone(null)).toBe("unknown");
  });

  it("shows Accepted as Offer and handles empty values", () => {
    expect(getStatusLabel("Accepted")).toBe("Offer");
    expect(getStatusLabel("Interview")).toBe("Interview");
    expect(getStatusLabel("  ")).toBe("Unknown");
    expect(getStatusLabel(null)).toBe("Unknown");
  });
});

describe("getCompanyTileIndex", () => {
  it("is stable, case-insensitive and in range", () => {
    const a = getCompanyTileIndex("Lumen Analytics");
    expect(getCompanyTileIndex(" lumen analytics ")).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(COMPANY_TILE_COUNT);
    expect(getCompanyTileIndex(null)).toBe(0);
  });
});

describe("buildNextSteps", () => {
  it("marks steps done from real data", () => {
    const steps = buildNextSteps({ hasName: true, resumeCount: 0, applicationCount: 2 });
    expect(steps.map((s) => [s.id, s.done])).toEqual([
      ["name", true],
      ["resume", false],
      ["apply", true],
    ]);
  });
});
