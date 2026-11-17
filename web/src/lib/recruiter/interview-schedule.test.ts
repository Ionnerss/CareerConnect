import { describe, expect, it } from "vitest";
import {
  canCancelInterview,
  canModifyInterview,
  formatDuration,
  formatInterviewDateTime,
  formatInterviewStatus,
  montrealInputToIso,
  toMontrealInputValue,
  validateInterviewDetails,
} from "./interview-schedule";

const NOW = new Date("2026-11-12T20:00:00Z");

const validInput = {
  scheduledAt: "2026-11-19T14:30",
  responseDeadline: "2026-11-17T17:00",
  durationMinutes: "30",
  location: "",
  meetingUrl: "https://meet.example.com/abc",
  notes: "",
};

describe("formatInterviewStatus", () => {
  it.each([
    ["pending", "Pending"],
    ["accepted", "Accepted"],
    ["declined", "Rejected"],
    ["cancelled", "Cancelled"],
    ["expired", "Expired"],
    ["something else", "Unknown"],
  ])("shows %s as %s", (status, label) => {
    expect(formatInterviewStatus(status)).toBe(label);
  });

  it("only treats cancelled interviews as final", () => {
    expect(canModifyInterview("pending")).toBe(true);
    expect(canModifyInterview("accepted")).toBe(true);
    expect(canModifyInterview("declined")).toBe(true);
    expect(canModifyInterview("expired")).toBe(true);
    expect(canModifyInterview("cancelled")).toBe(false);
  });

  it("only lets waiting or accepted interviews be cancelled, like the database", () => {
    expect(canCancelInterview("pending")).toBe(true);
    expect(canCancelInterview("accepted")).toBe(true);
    expect(canCancelInterview("declined")).toBe(false);
    expect(canCancelInterview("expired")).toBe(false);
    expect(canCancelInterview("cancelled")).toBe(false);
  });
});

describe("formatDuration", () => {
  it.each([
    [30, "30 min"],
    [60, "1 hour"],
    [90, "1 hour 30 min"],
    [120, "2 hours"],
    [null, "Duration not set"],
  ])("shows %s as %s", (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });
});

describe("Montreal time conversion", () => {
  it("converts winter and summer times using the right offset", () => {
    expect(montrealInputToIso("2026-11-19T14:30")).toBe("2026-11-19T19:30:00.000Z");
    expect(montrealInputToIso("2026-07-01T09:00")).toBe("2026-07-01T13:00:00.000Z");
  });

  it("rejects impossible dates, skipped DST times and bad input", () => {
    expect(montrealInputToIso("2026-02-30T10:00")).toBeNull();
    expect(montrealInputToIso("2026-03-08T02:30")).toBeNull();
    expect(montrealInputToIso("")).toBeNull();
    expect(montrealInputToIso("tomorrow")).toBeNull();
  });

  it("turns a stored time back into the input value", () => {
    expect(toMontrealInputValue("2026-11-19T19:30:00Z")).toBe("2026-11-19T14:30");
    expect(toMontrealInputValue("nope")).toBe("");
    expect(toMontrealInputValue(null)).toBe("");
  });

  it("formats the date and time for the list", () => {
    expect(formatInterviewDateTime("2026-11-19T19:30:00Z")).toBe("Thu, Nov 19, 2026, 2:30 PM");
    expect(formatInterviewDateTime(undefined)).toBe("Date not available");
  });
});

describe("validateInterviewDetails", () => {
  it("returns clean details with the time stored as UTC", () => {
    expect(validateInterviewDetails(validInput, NOW)).toEqual({
      success: true,
      data: {
        scheduledAt: "2026-11-19T19:30:00.000Z",
        responseDeadline: "2026-11-17T22:00:00.000Z",
        durationMinutes: 30,
        location: null,
        meetingUrl: "https://meet.example.com/abc",
        notes: null,
      },
    });
  });

  it("trims text and keeps a location without a link", () => {
    const result = validateInterviewDetails(
      { ...validInput, meetingUrl: "  ", location: "  Room 2.101 ", notes: " Bring ID " },
      NOW,
    );
    expect(result.success && result.data).toMatchObject({
      location: "Room 2.101",
      meetingUrl: null,
      notes: "Bring ID",
    });
  });

  it("explains every missing field", () => {
    const result = validateInterviewDetails(
      { scheduledAt: "", responseDeadline: "", durationMinutes: "", location: "", meetingUrl: "zoom", notes: "" },
      NOW,
    );
    expect(result).toEqual({
      success: false,
      fieldErrors: {
        scheduledAt: "Choose a valid date and time.",
        responseDeadline: "Choose when the applicant must reply by.",
        durationMinutes: "Choose how long the interview will last.",
        meetingUrl: "Enter a full link starting with https://",
      },
    });
  });

  it("needs a location or a meeting link", () => {
    const result = validateInterviewDetails({ ...validInput, meetingUrl: "" }, NOW);
    expect(result.success).toBe(false);
    expect(!result.success && result.fieldErrors.location).toMatch(/location or a meeting link/);
  });

  it("refuses an interview or a reply deadline in the past", () => {
    const result = validateInterviewDetails(
      { ...validInput, scheduledAt: "2026-11-12T14:59", responseDeadline: "2026-11-12T14:00" },
      NOW,
    );
    expect(result).toEqual({
      success: false,
      fieldErrors: {
        scheduledAt: "Choose a date and time in the future.",
        responseDeadline: "The reply deadline must be in the future.",
      },
    });
  });

  it("needs the reply deadline to be before the interview", () => {
    const result = validateInterviewDetails({ ...validInput, responseDeadline: "2026-11-19T14:30" }, NOW);
    expect(result).toEqual({
      success: false,
      fieldErrors: { responseDeadline: "The reply deadline must be before the interview." },
    });
  });

  it("only accepts the listed durations and reasonable notes", () => {
    expect(validateInterviewDetails({ ...validInput, durationMinutes: "25" }, NOW).success).toBe(false);
    const longNotes = validateInterviewDetails({ ...validInput, notes: "a".repeat(1001) }, NOW);
    expect(!longNotes.success && longNotes.fieldErrors.notes).toMatch(/under 1000/);
  });
});
