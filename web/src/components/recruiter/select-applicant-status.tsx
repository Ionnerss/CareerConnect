
"use client";

import { useState, useTransition } from "react";
import {
  updateApplicantStatus,
  type ApplicationStatus,
} from "@/app/recruiter/jobs/[jobId]/applicants/actions";

type Props = {
  applicationId: string;
  jobId: string;
  initialStatus: ApplicationStatus;
};

const statuses: ApplicationStatus[] = [
  "In Progress",
  "Interview",
  "Accepted",
  "Rejected",
];

export default function ApplicantStatusSelect({
  applicationId,
  jobId,
  initialStatus,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleChange(newStatus: ApplicationStatus) {
    const previousStatus = status;

    setStatus(newStatus);
    setError("");

    startTransition(async () => {
      const result = await updateApplicantStatus(
        applicationId,
        jobId,
        newStatus
      );

      if (!result.success) {
        setStatus(previousStatus);
        setError(result.error ?? "Unable to update status.");
      }
    });
  }

  return (
    <div>
      <select
        value={status}
        disabled={isPending}
        onChange={(e) =>
          handleChange(e.target.value as ApplicationStatus)
        }
        className="rounded-full border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-semibold text-[#1D4ED8] disabled:opacity-50"
      >
        {statuses.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
