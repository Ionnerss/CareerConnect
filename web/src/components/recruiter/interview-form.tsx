"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createInterviewAction, updateInterviewAction } from "@/app/recruiter/interviews/actions";
import { ui } from "@/components/profile/profile-ui";
import {
  INTERVIEW_DURATIONS,
  MAX_INTERVIEW_NOTES_LENGTH,
  RECRUITER_INTERVIEWS_PATH,
  formatDuration,
  validateInterviewDetails,
  type InterviewField,
  type InterviewFieldErrors,
  type InterviewFormValues,
} from "@/lib/recruiter/interview-schedule";

type InterviewFormProps = {
  /** Fixed details shown above the fields. */
  details: {
    jobTitle: string;
    companyName: string | null;
    employerName: string | null;
    applicantName: string | null;
  };
  /** Values to start from when editing. The date is "YYYY-MM-DDTHH:mm" in Montreal time. */
  initialValues?: Partial<InterviewFormValues>;
  cancelHref: string;
} & ({ applicationId: string; interviewId?: never } | { interviewId: string; applicationId?: never });

// Locked fields look greyed out when rescheduling.
const LOCKED = "disabled:cursor-not-allowed disabled:bg-[#F3F4F6] disabled:text-[#6B7280]";
const inputClass = `${ui.input} ${LOCKED}`;
const textareaClass = `${ui.textarea} ${LOCKED}`;

const EMPTY_VALUES: InterviewFormValues = {
  scheduledAt: "",
  responseDeadline: "",
  durationMinutes: "",
  location: "",
  meetingUrl: "",
  notes: "",
};

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: InterviewField;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={`interview-${id}`} className={ui.label}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`interview-${id}-hint`} className="text-xs text-[#6B7280]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`interview-${id}-error`} className={ui.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

export function InterviewForm(props: InterviewFormProps) {
  const { details, initialValues, cancelHref } = props;
  const isEditing = props.interviewId !== undefined;

  const router = useRouter();
  const [values, setValues] = useState<InterviewFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [errors, setErrors] = useState<InterviewFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  function update(field: InterviewField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  /** Props that connect an input to its label, hint and error for screen readers. */
  function fieldProps(field: InterviewField, hasHint = false) {
    // Once sent, only the time and reply deadline can be changed (through rescheduling).
    const locked = isEditing && field !== "scheduledAt" && field !== "responseDeadline";
    const describedBy = errors[field]
      ? `interview-${field}-error`
      : hasHint
        ? `interview-${field}-hint`
        : undefined;
    return {
      id: `interview-${field}`,
      name: field,
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": describedBy,
      disabled: locked || undefined,
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const validation = validateInterviewDetails(values);
    if (!validation.success) {
      setErrors(validation.fieldErrors);
      return;
    }

    startTransition(async () => {
      const result =
        props.interviewId !== undefined
          ? await updateInterviewAction(props.interviewId, values)
          : await createInterviewAction(props.applicationId, values);

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        return;
      }

      router.push(RECRUITER_INTERVIEWS_PATH);
      router.refresh();
    });
  }

  const summary = [
    { label: "Job title", value: details.jobTitle },
    { label: "Company", value: details.companyName ?? "Not provided" },
    { label: "Employer", value: details.employerName ?? "You" },
    { label: "Job seeker", value: details.applicantName ?? "Name not available" },
  ];

  return (
    <form noValidate onSubmit={handleSubmit} className={`${ui.card} space-y-5`}>
      <dl className="grid gap-3 rounded-xl border border-[#E3E6EB] bg-[#F9FAFB] p-4 sm:grid-cols-2">
        {summary.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-[#0E1726]">{value}</dd>
          </div>
        ))}
      </dl>

      {formError && (
        <p role="alert" className={ui.error}>
          {formError}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="scheduledAt"
          label="Date and time"
          hint="Montreal time."
          error={errors.scheduledAt}
        >
          <input
            type="datetime-local"
            className={inputClass}
            value={values.scheduledAt}
            onChange={(event) => update("scheduledAt", event.target.value)}
            {...fieldProps("scheduledAt", true)}
          />
        </Field>

        <Field
          id="responseDeadline"
          label="Reply by"
          hint="Montreal time. Must be before the interview."
          error={errors.responseDeadline}
        >
          <input
            type="datetime-local"
            className={inputClass}
            value={values.responseDeadline}
            onChange={(event) => update("responseDeadline", event.target.value)}
            {...fieldProps("responseDeadline", true)}
          />
        </Field>

        <Field id="durationMinutes" label="Duration" error={errors.durationMinutes}>
          <select
            className={inputClass}
            value={values.durationMinutes}
            onChange={(event) => update("durationMinutes", event.target.value)}
            {...fieldProps("durationMinutes")}
          >
            <option value="">Choose a duration</option>
            {INTERVIEW_DURATIONS.map((minutes) => (
              <option key={minutes} value={String(minutes)}>
                {formatDuration(minutes)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="location"
          label="Location"
          hint="Address or room. Leave blank for an online interview."
          error={errors.location}
        >
          <input
            type="text"
            className={inputClass}
            value={values.location}
            placeholder="1455 De Maisonneuve Blvd W, Room 2.101"
            onChange={(event) => update("location", event.target.value)}
            {...fieldProps("location", true)}
          />
        </Field>

        <Field
          id="meetingUrl"
          label="Meeting link"
          hint="Teams, Zoom or Google Meet link, if online."
          error={errors.meetingUrl}
        >
          <input
            type="url"
            className={inputClass}
            value={values.meetingUrl}
            placeholder="https://"
            onChange={(event) => update("meetingUrl", event.target.value)}
            {...fieldProps("meetingUrl", true)}
          />
        </Field>
      </div>

      <Field
        id="notes"
        label="Notes for the applicant"
        hint={`Optional. Up to ${MAX_INTERVIEW_NOTES_LENGTH} characters.`}
        error={errors.notes}
      >
        <textarea
          rows={4}
          maxLength={MAX_INTERVIEW_NOTES_LENGTH}
          className={textareaClass}
          value={values.notes}
          placeholder="What to bring, who they will meet, how to prepare…"
          onChange={(event) => update("notes", event.target.value)}
          {...fieldProps("notes", true)}
        />
      </Field>

      {isEditing && (
        <p className="text-sm text-[#4B5563]">
          Rescheduling sends the applicant a new invitation to accept. To change the place, link or
          notes, cancel this interview and send a new one.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={ui.primaryButton}>
          {isPending ? "Saving…" : isEditing ? "Reschedule" : "Send interview"}
        </button>
        <Link href={cancelHref} className={ui.secondaryButton}>
          Go back
        </Link>
      </div>
    </form>
  );
}
