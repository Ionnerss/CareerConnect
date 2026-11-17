// Pure helpers for recruiter interviews: form validation, Montreal time conversion and labels.
// `now` is a parameter so tests do not depend on the clock.

import { z } from "zod";

export const RECRUITER_INTERVIEWS_PATH = "/recruiter/interviews";

/** Interviews are entered and shown in Montreal time, whatever the device's time zone. */
export const INTERVIEW_TIME_ZONE = "America/Toronto";

export const INTERVIEW_STATUSES = ["pending", "accepted", "declined", "cancelled", "expired"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

const STATUS_LABELS: Record<InterviewStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  // The database stores the job seeker's answer as "declined"; the task calls it "Rejected".
  declined: "Rejected",
  cancelled: "Cancelled",
  // The applicant did not answer before the response deadline.
  expired: "Expired",
};

export function formatInterviewStatus(status: string): string {
  return STATUS_LABELS[status as InterviewStatus] ?? "Unknown";
}

/** A cancelled interview is final; every other one can still be edited or rescheduled. */
export function canModifyInterview(status: string): boolean {
  return status !== "cancelled";
}

/** The database only lets recruiters cancel invitations that are waiting or accepted. */
export function canCancelInterview(status: string): boolean {
  return status === "pending" || status === "accepted";
}

export const INTERVIEW_DURATIONS = [15, 30, 45, 60, 90, 120] as const;

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "Duration not set";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourText = hours === 1 ? "1 hour" : `${hours} hours`;
  return rest === 0 ? hourText : `${hourText} ${rest} min`;
}

/** e.g. "Thu, Nov 19, 2026, 2:30 PM" in Montreal time. */
export function formatInterviewDateTime(iso: string | null | undefined): string {
  if (!iso) return "Date not available";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date not available";

  return date
    .toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: INTERVIEW_TIME_ZONE,
    })
    // Newer Node/browsers put a narrow no-break space before AM/PM; use a normal space.
    .replace(/ /g, " ");
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: INTERVIEW_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function montrealParts(date: Date) {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** How far Montreal's clock is from UTC at a given instant, in milliseconds (negative). */
function montrealOffsetAt(utcMs: number): number {
  const p = montrealParts(new Date(utcMs));
  const wallClock = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return wallClock - Math.floor(utcMs / 60_000) * 60_000;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** ISO timestamp → "YYYY-MM-DDTHH:mm" for a datetime-local input, in Montreal time. */
export function toMontrealInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const p = montrealParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const INPUT_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * "YYYY-MM-DDTHH:mm" in Montreal time → ISO timestamp. Returns null for impossible
 * dates (Feb 30) and for times skipped when the clocks spring forward.
 */
export function montrealInputToIso(value: string): string | null {
  const match = INPUT_DATE_TIME.exec(value);
  if (!match) return null;

  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);

  // Guess with the offset at the wall-clock instant, then correct once in case DST changes in between.
  let utc = wallClock - montrealOffsetAt(wallClock);
  utc = wallClock - montrealOffsetAt(utc);

  const iso = new Date(utc).toISOString();
  return toMontrealInputValue(iso) === value ? iso : null;
}

export const MAX_INTERVIEW_LOCATION_LENGTH = 200;
export const MAX_INTERVIEW_LINK_LENGTH = 500;
export const MAX_INTERVIEW_NOTES_LENGTH = 1000;

function isWebLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Blank strings become null so the database stores "not provided" instead of "". */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => value || null);

const interviewFormSchema = z
  .object({
    scheduledAt: z
      .string()
      .refine((value) => montrealInputToIso(value) !== null, "Choose a valid date and time."),
    responseDeadline: z
      .string()
      .refine(
        (value) => montrealInputToIso(value) !== null,
        "Choose when the applicant must reply by.",
      ),
    durationMinutes: z.coerce
      .number()
      .refine(
        (value) => (INTERVIEW_DURATIONS as readonly number[]).includes(value),
        "Choose how long the interview will last.",
      ),
    location: optionalText(
      MAX_INTERVIEW_LOCATION_LENGTH,
      `Keep the location under ${MAX_INTERVIEW_LOCATION_LENGTH} characters.`,
    ),
    meetingUrl: optionalText(
      MAX_INTERVIEW_LINK_LENGTH,
      `Keep the link under ${MAX_INTERVIEW_LINK_LENGTH} characters.`,
    ).refine(
      (value) => value === null || isWebLink(value),
      "Enter a full link starting with https://",
    ),
    notes: optionalText(
      MAX_INTERVIEW_NOTES_LENGTH,
      `Keep the notes under ${MAX_INTERVIEW_NOTES_LENGTH} characters.`,
    ),
  })
  .refine((data) => data.location || data.meetingUrl, {
    message: "Add a location or a meeting link so the applicant knows where to go.",
    path: ["location"],
  });

export type InterviewField =
  | "scheduledAt"
  | "responseDeadline"
  | "durationMinutes"
  | "location"
  | "meetingUrl"
  | "notes";
export type InterviewFieldErrors = Partial<Record<InterviewField, string>>;

/** What the form sends: the date and time as typed, in Montreal time. */
export type InterviewFormValues = {
  scheduledAt: string;
  responseDeadline: string;
  durationMinutes: string;
  location: string;
  meetingUrl: string;
  notes: string;
};

/** Validated details, ready to store. Both times are ISO timestamps. */
export type InterviewDetails = {
  scheduledAt: string;
  responseDeadline: string;
  durationMinutes: number;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
};

export type InterviewValidation =
  | { success: true; data: InterviewDetails }
  | { success: false; fieldErrors: InterviewFieldErrors };

/** Used by the form before sending and again on the server before saving. */
export function validateInterviewDetails(input: unknown, now: Date = new Date()): InterviewValidation {
  const parsed = interviewFormSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: InterviewFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as InterviewField | undefined;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    if (Object.keys(fieldErrors).length === 0) fieldErrors.scheduledAt = "Please check the interview details.";
    return { success: false, fieldErrors };
  }

  const scheduledAt = montrealInputToIso(parsed.data.scheduledAt) as string;
  const responseDeadline = montrealInputToIso(parsed.data.responseDeadline) as string;
  const interviewTime = new Date(scheduledAt).getTime();
  const deadlineTime = new Date(responseDeadline).getTime();

  // Same rules as the database's reschedule_interview function.
  const fieldErrors: InterviewFieldErrors = {};
  if (interviewTime <= now.getTime()) {
    fieldErrors.scheduledAt = "Choose a date and time in the future.";
  }
  if (deadlineTime <= now.getTime()) {
    fieldErrors.responseDeadline = "The reply deadline must be in the future.";
  } else if (deadlineTime >= interviewTime) {
    fieldErrors.responseDeadline = "The reply deadline must be before the interview.";
  }
  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };

  return { success: true, data: { ...parsed.data, scheduledAt, responseDeadline } };
}
