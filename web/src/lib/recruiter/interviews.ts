import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSignedInRecruiter } from "@/lib/recruiter/applicants";
import {
  canModifyInterview,
  validateInterviewDetails,
  type InterviewDetails,
  type InterviewFieldErrors,
} from "./interview-schedule";

/** One interview as the recruiter sees it in their list. */
export type RecruiterInterview = {
  id: string;
  applicationId: string;
  jobId: string | null;
  jobTitle: string;
  companyName: string | null;
  applicantName: string | null;
  scheduledAt: string;
  responseDeadline: string | null;
  durationMinutes: number | null;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
  status: string;
};

/** The fixed details shown at the top of the interview form. */
export type InterviewContext = {
  applicationId: string;
  jobId: string | null;
  jobTitle: string;
  companyName: string | null;
  applicantName: string | null;
  employerName: string | null;
};

type Failure = { success: false; error: string };

export type InterviewMutationResult =
  | { success: true; interviewId: string; jobId: string | null }
  | (Failure & { fieldErrors?: InterviewFieldErrors });

export const INTERVIEWS_LOAD_ERROR = "Unable to load your interviews. Please try again.";
export const APPLICATION_NOT_FOUND_ERROR =
  "This application was not found, or it is not for one of your job postings.";
export const INTERVIEW_NOT_FOUND_ERROR = "This interview was not found.";
export const INTERVIEW_CANCELLED_ERROR = "This interview was cancelled and can no longer be changed.";
export const INTERVIEW_SAVE_ERROR = "Unable to save the interview. Please try again.";
export const INTERVIEW_FORM_ERROR = "Please fix the highlighted fields.";
export const NOTHING_TO_RESCHEDULE_ERROR = "Change the date, time or reply deadline to reschedule.";

const idSchema = z.uuid();
const JOB_TITLE_FALLBACK = "your job posting";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Supabase returns a joined row as an object or a one-item array depending on the relationship. */
function one<T>(value: T | T[] | null | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

const clean = (value: string | null | undefined) => value?.trim() || null;

/**
 * The database functions raise plain-English messages ("This interview cannot be cancelled.").
 * Show those to the recruiter; hide anything else behind a generic message.
 */
function databaseMessage(error: { code?: string; message?: string } | null, fallback: string) {
  return error?.code === "P0001" && error.message ? error.message : fallback;
}

type JobRow = { title: string | null; firm_name: string | null; recruiter_id?: string | null };
type ApplicationRow = { job_id: string | null; job: JobRow | JobRow[] | null };
type InterviewRow = {
  id: string;
  application_id: string;
  scheduled_at: string;
  response_deadline: string | null;
  duration_minutes: number | null;
  location: string | null;
  meeting_url: string | null;
  notes: string | null;
  status: string;
  applicant: { full_name: string | null } | { full_name: string | null }[] | null;
  application: ApplicationRow | ApplicationRow[] | null;
};

// The interviews table has two links to profiles (applicant and recruiter), so name the one we want.
const INTERVIEW_SELECT =
  "id, application_id, scheduled_at, response_deadline, duration_minutes, location, meeting_url, notes, status, applicant:profiles!interviews_applicant_id_fkey(full_name), application:applications(job_id, job(title, firm_name))";

function toRecruiterInterview(row: InterviewRow): RecruiterInterview {
  const application = one(row.application);
  const job = one(application?.job);

  return {
    id: row.id,
    applicationId: row.application_id,
    jobId: application?.job_id ?? null,
    jobTitle: clean(job?.title) ?? JOB_TITLE_FALLBACK,
    companyName: clean(job?.firm_name),
    applicantName: clean(one(row.applicant)?.full_name),
    scheduledAt: row.scheduled_at,
    responseDeadline: row.response_deadline,
    durationMinutes: row.duration_minutes,
    location: row.location,
    meetingUrl: row.meeting_url,
    notes: row.notes,
    status: row.status,
  };
}

/** Details saved with a new invitation. Later changes to the time go through reschedule_interview. */
function toDetailColumns(details: InterviewDetails) {
  return {
    duration_minutes: details.durationMinutes,
    location: details.location,
    meeting_url: details.meetingUrl,
    notes: details.notes,
  };
}

async function getEmployerName(supabase: SupabaseClient, recruiterId: string) {
  const { data } = await supabase.from("profiles").select("full_name").eq("id", recruiterId).maybeSingle();
  return clean((data as { full_name: string | null } | null)?.full_name);
}

/** Loads an application only if it was made to one of this recruiter's postings. */
async function getOwnApplication(supabase: SupabaseClient, recruiterId: string, applicationId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, applicant_id, job_id, profiles(full_name), job(title, firm_name, recruiter_id)")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) return { ok: false as const, error: INTERVIEW_SAVE_ERROR };

  const row = data as {
    id: string;
    applicant_id: string;
    job_id: string;
    profiles: { full_name: string | null } | { full_name: string | null }[] | null;
    job: JobRow | JobRow[] | null;
  } | null;
  const job = one(row?.job);

  if (!row || job?.recruiter_id !== recruiterId) {
    return { ok: false as const, error: APPLICATION_NOT_FOUND_ERROR };
  }

  return {
    ok: true as const,
    application: {
      id: row.id,
      applicantId: row.applicant_id,
      jobId: row.job_id,
      jobTitle: clean(job?.title) ?? JOB_TITLE_FALLBACK,
      companyName: clean(job?.firm_name),
      applicantName: clean(one(row.profiles)?.full_name),
    },
  };
}

/** Every interview the signed-in recruiter scheduled, soonest first. */
export async function getRecruiterInterviews(): Promise<
  { success: true; interviews: RecruiterInterview[] } | Failure
> {
  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);
  if (!recruiter.success) return recruiter;

  const { data, error } = await supabase
    .from("interviews")
    .select(INTERVIEW_SELECT)
    .eq("recruiter_id", recruiter.userId)
    .order("scheduled_at", { ascending: true });

  if (error) return { success: false, error: INTERVIEWS_LOAD_ERROR };

  return { success: true, interviews: ((data ?? []) as unknown as InterviewRow[]).map(toRecruiterInterview) };
}

/** Details for the "Schedule interview" form of one application. */
export async function getInterviewSchedulingContext(
  applicationId: unknown,
): Promise<{ success: true; context: InterviewContext } | Failure> {
  const parsedId = idSchema.safeParse(applicationId);
  if (!parsedId.success) return { success: false, error: APPLICATION_NOT_FOUND_ERROR };

  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);
  if (!recruiter.success) return recruiter;

  const result = await getOwnApplication(supabase, recruiter.userId, parsedId.data);
  if (!result.ok) return { success: false, error: result.error };

  const { application } = result;
  return {
    success: true,
    context: {
      applicationId: application.id,
      jobId: application.jobId,
      jobTitle: application.jobTitle,
      companyName: application.companyName,
      applicantName: application.applicantName,
      employerName: await getEmployerName(supabase, recruiter.userId),
    },
  };
}

/** One of the recruiter's interviews, with the details the edit form needs. */
export async function getInterviewForEditing(
  interviewId: unknown,
): Promise<{ success: true; interview: RecruiterInterview; context: InterviewContext } | Failure> {
  const parsedId = idSchema.safeParse(interviewId);
  if (!parsedId.success) return { success: false, error: INTERVIEW_NOT_FOUND_ERROR };

  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);
  if (!recruiter.success) return recruiter;

  const { data, error } = await supabase
    .from("interviews")
    .select(INTERVIEW_SELECT)
    .eq("id", parsedId.data)
    .eq("recruiter_id", recruiter.userId)
    .maybeSingle();

  if (error) return { success: false, error: INTERVIEWS_LOAD_ERROR };
  if (!data) return { success: false, error: INTERVIEW_NOT_FOUND_ERROR };

  const interview = toRecruiterInterview(data as unknown as InterviewRow);
  if (!canModifyInterview(interview.status)) return { success: false, error: INTERVIEW_CANCELLED_ERROR };

  return {
    success: true,
    interview,
    context: {
      applicationId: interview.applicationId,
      jobId: interview.jobId,
      jobTitle: interview.jobTitle,
      companyName: interview.companyName,
      applicantName: interview.applicantName,
      employerName: await getEmployerName(supabase, recruiter.userId),
    },
  };
}

/** Sends a new interview invitation to the applicant behind an application. */
export async function createInterview(
  applicationId: unknown,
  input: unknown,
  now: Date = new Date(),
): Promise<InterviewMutationResult> {
  const parsedId = idSchema.safeParse(applicationId);
  if (!parsedId.success) return { success: false, error: APPLICATION_NOT_FOUND_ERROR };

  const details = validateInterviewDetails(input, now);
  if (!details.success) {
    return { success: false, error: INTERVIEW_FORM_ERROR, fieldErrors: details.fieldErrors };
  }

  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);
  if (!recruiter.success) return recruiter;

  const result = await getOwnApplication(supabase, recruiter.userId, parsedId.data);
  if (!result.ok) return { success: false, error: result.error };
  const { application } = result;

  const { data, error } = await supabase
    .from("interviews")
    .insert({
      application_id: application.id,
      recruiter_id: recruiter.userId,
      applicant_id: application.applicantId,
      scheduled_at: details.data.scheduledAt,
      response_deadline: details.data.responseDeadline,
      ...toDetailColumns(details.data),
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: INTERVIEW_SAVE_ERROR };

  // Move a new application to the Interview stage so the applicant sees it on their status page.
  // The interview is already saved, so a failure here is not reported as an error.
  await supabase
    .from("applications")
    .update({ status: "Interview" })
    .eq("id", application.id)
    .eq("status", "In Progress");

  return { success: true, interviewId: (data as { id: string }).id, jobId: application.jobId };
}

/**
 * Reschedules an interview through the database's reschedule_interview function, which sends
 * the applicant a new invitation to accept. Recruiters cannot update the interviews table
 * directly, so the duration, place and notes stay as they were sent.
 */
export async function updateInterview(
  interviewId: unknown,
  input: unknown,
  now: Date = new Date(),
): Promise<InterviewMutationResult> {
  const parsedId = idSchema.safeParse(interviewId);
  if (!parsedId.success) return { success: false, error: INTERVIEW_NOT_FOUND_ERROR };

  const details = validateInterviewDetails(input, now);
  if (!details.success) {
    return { success: false, error: INTERVIEW_FORM_ERROR, fieldErrors: details.fieldErrors };
  }

  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);
  if (!recruiter.success) return recruiter;

  const { data: existing, error: loadError } = await supabase
    .from("interviews")
    .select("id, status, scheduled_at, response_deadline, application:applications(job_id)")
    .eq("id", parsedId.data)
    .eq("recruiter_id", recruiter.userId)
    .maybeSingle();

  if (loadError) return { success: false, error: INTERVIEW_SAVE_ERROR };
  if (!existing) return { success: false, error: INTERVIEW_NOT_FOUND_ERROR };

  const current = existing as {
    status: string;
    scheduled_at: string;
    response_deadline: string | null;
    application: { job_id: string | null } | { job_id: string | null }[] | null;
  };
  if (!canModifyInterview(current.status)) return { success: false, error: INTERVIEW_CANCELLED_ERROR };

  const sameTime = (stored: string | null, next: string) =>
    stored !== null && new Date(stored).getTime() === new Date(next).getTime();
  if (
    sameTime(current.scheduled_at, details.data.scheduledAt) &&
    sameTime(current.response_deadline, details.data.responseDeadline)
  ) {
    return { success: false, error: NOTHING_TO_RESCHEDULE_ERROR };
  }

  const { error } = await supabase.rpc("reschedule_interview", {
    p_interview_id: parsedId.data,
    p_scheduled_at: details.data.scheduledAt,
    p_response_deadline: details.data.responseDeadline,
  });
  if (error) return { success: false, error: databaseMessage(error, INTERVIEW_SAVE_ERROR) };

  return { success: true, interviewId: parsedId.data, jobId: one(current.application)?.job_id ?? null };
}

/**
 * Cancels one of the recruiter's interviews through the database's cancel_interview function,
 * which also tells the applicant. The row is kept so both sides can still see it.
 */
export async function cancelInterview(interviewId: unknown): Promise<InterviewMutationResult> {
  const parsedId = idSchema.safeParse(interviewId);
  if (!parsedId.success) return { success: false, error: INTERVIEW_NOT_FOUND_ERROR };

  const supabase = await createClient();
  const recruiter = await getSignedInRecruiter(supabase);
  if (!recruiter.success) return recruiter;

  const { error } = await supabase.rpc("cancel_interview", { p_interview_id: parsedId.data });
  if (error) return { success: false, error: databaseMessage(error, INTERVIEW_SAVE_ERROR) };

  return { success: true, interviewId: parsedId.data, jobId: null };
}
