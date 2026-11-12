"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Clock, ExternalLink, Hourglass, MapPin, Pencil, XCircle } from "lucide-react";
import { cancelInterviewAction } from "@/app/recruiter/interviews/actions";
import { ui } from "@/components/profile/profile-ui";
import {
  canCancelInterview,
  canModifyInterview,
  formatDuration,
  formatInterviewDateTime,
  formatInterviewStatus,
} from "@/lib/recruiter/interview-schedule";
import type { RecruiterInterview } from "@/lib/recruiter/interviews";

const STATUS_STYLES: Record<string, string> = {
  pending: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
  accepted: "border-[#BBF7D0] bg-[#F0FDF4] text-[#047857]",
  declined: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
  cancelled: "border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563]",
  expired: "border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563]",
};

export function InterviewStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
        STATUS_STYLES[status] ?? STATUS_STYLES.pending
      }`}
    >
      {formatInterviewStatus(status)}
    </span>
  );
}

function InterviewCard({
  interview,
  upcoming,
  onCancelled,
}: {
  interview: RecruiterInterview;
  upcoming: boolean;
  onCancelled: (id: string) => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const applicant = interview.applicantName ?? "A candidate";
  const canEdit = upcoming && canModifyInterview(interview.status);
  const canCancel = upcoming && canCancelInterview(interview.status);
  const editLabel = "Reschedule";

  function cancel() {
    setError("");
    startTransition(async () => {
      const result = await cancelInterviewAction(interview.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      onCancelled(interview.id);
      router.refresh();
    });
  }

  return (
    <li className={ui.card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={ui.entryTitle}>{applicant}</p>
          <p className={ui.entrySubtitle}>
            {interview.jobTitle}
            {interview.companyName && <span className="text-[#6B7280]"> · {interview.companyName}</span>}
          </p>
        </div>
        <InterviewStatusBadge status={interview.status} />
      </div>

      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[#4B5563]">
        <li className="flex items-center gap-2">
          <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-[#6B7280]" />
          <time dateTime={interview.scheduledAt}>{formatInterviewDateTime(interview.scheduledAt)}</time>
        </li>
        <li className="flex items-center gap-2">
          <Clock aria-hidden="true" className="size-4 shrink-0 text-[#6B7280]" />
          {formatDuration(interview.durationMinutes)}
        </li>
        {interview.status === "pending" && interview.responseDeadline && (
          <li className="flex items-center gap-2">
            <Hourglass aria-hidden="true" className="size-4 shrink-0 text-[#6B7280]" />
            <span>
              Reply by{" "}
              <time dateTime={interview.responseDeadline}>
                {formatInterviewDateTime(interview.responseDeadline)}
              </time>
            </span>
          </li>
        )}
        {interview.location && (
          <li className="flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-4 shrink-0 text-[#6B7280]" />
            {interview.location}
          </li>
        )}
        {interview.meetingUrl && (
          <li className="flex items-center gap-2">
            <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-[#6B7280]" />
            <a
              href={interview.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ui.textLink} break-all`}
            >
              Meeting link
            </a>
          </li>
        )}
      </ul>

      {interview.notes && <p className={ui.entryBody}>{interview.notes}</p>}

      {(canEdit || canCancel) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canEdit && (
            <Link
              href={`/recruiter/interviews/${interview.id}/edit`}
              aria-label={`${editLabel} interview with ${applicant}`}
              className={ui.secondaryButton}
            >
              <Pencil aria-hidden="true" className="size-4" />
              {editLabel}
            </Link>
          )}

          {!canCancel ? null : confirming ? (
            <div role="group" aria-label="Confirm cancellation" className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[#1F2937]">Cancel this interview?</span>
              <button type="button" onClick={cancel} disabled={isPending} className={ui.confirmButton}>
                {isPending ? "Cancelling…" : "Yes, cancel it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className={ui.keepButton}
              >
                Keep it
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Cancel interview with ${applicant}`}
              className={ui.secondaryButton}
            >
              <XCircle aria-hidden="true" className="size-4" />
              Cancel interview
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
    </li>
  );
}

function Section({
  title,
  interviews,
  upcoming,
  onCancelled,
}: {
  title: string;
  interviews: RecruiterInterview[];
  upcoming: boolean;
  onCancelled: (id: string) => void;
}) {
  if (interviews.length === 0) return null;

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-[#0E1726]">
        {title} <span className="font-normal text-[#6B7280]">({interviews.length})</span>
      </h2>
      <ul className="flex flex-col gap-3">
        {interviews.map((interview) => (
          <InterviewCard
            key={interview.id}
            interview={interview}
            upcoming={upcoming}
            onCancelled={onCancelled}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * The recruiter's interviews: upcoming ones first (soonest at the top), then past and
 * cancelled ones (most recent at the top). `now` is an ISO string so the server and
 * the browser split the list the same way.
 */
export function RecruiterInterviewsList({
  interviews,
  now,
}: {
  interviews: RecruiterInterview[];
  now: string;
}) {
  const [cancelledIds, setCancelledIds] = useState<string[]>([]);
  const nowMs = new Date(now).getTime();

  if (interviews.length === 0) {
    return (
      <div className={`${ui.card} text-center`}>
        <p className="font-semibold text-[#0E1726]">No interviews yet.</p>
        <p className="mt-1 text-sm text-[#6B7280]">
          Open the applicants of one of your job postings and choose “Schedule” to invite someone.
        </p>
        <Link href="/recruiter/jobs" className={`${ui.textLink} mt-3`}>
          Go to my job postings
        </Link>
      </div>
    );
  }

  const withLocalChanges = interviews.map((interview) =>
    cancelledIds.includes(interview.id) ? { ...interview, status: "cancelled" } : interview,
  );

  const isUpcoming = (interview: RecruiterInterview) =>
    interview.status !== "cancelled" && new Date(interview.scheduledAt).getTime() >= nowMs;

  const upcoming = withLocalChanges.filter(isUpcoming);
  const past = withLocalChanges.filter((interview) => !isUpcoming(interview)).reverse();

  const markCancelled = (id: string) => setCancelledIds((ids) => [...ids, id]);

  return (
    <div className="flex flex-col gap-8">
      <Section title="Upcoming" interviews={upcoming} upcoming onCancelled={markCancelled} />
      <Section title="Past and cancelled" interviews={past} upcoming={false} onCancelled={markCancelled} />
    </div>
  );
}
