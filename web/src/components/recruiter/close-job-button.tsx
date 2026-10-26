"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  closeJob,
  reopenJob,
} from "@/app/recruiter/jobs/actions";

type JobStatus = "open" | "closed";

type CloseJobButtonProps = {
  jobId: string;
  status?: JobStatus;
};

export function CloseJobButton({
  jobId,
  status = "open",
}: CloseJobButtonProps) {
  const router = useRouter();

  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReopening = status === "closed";

  async function handleStatusChange() {
    if (isSaving || isComplete) return;

    setIsSaving(true);
    setError(null);

    try {
      const result = isReopening
        ? await reopenJob(jobId)
        : await closeJob(jobId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setIsComplete(true);
      setIsConfirming(false);

      // Refresh the server-rendered job list.
      router.refresh();
    } catch {
      setError(
        "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  // Display a short confirmation while the page refreshes.
  if (isComplete) {
    return (
      <span
        role="status"
        className="text-sm font-semibold text-[#4B5563]"
      >
        {isReopening ? "Reopened" : "Closed"}
      </span>
    );
  }

  // Initial button
  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsConfirming(true);
        }}
        className={
          isReopening
            ? "rounded-lg border border-green-200 px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500"
            : "rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        }
      >
        {isReopening ? "Reopen job" : "Close job"}
      </button>
    );
  }

  // Confirmation UI
  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[#0E1726]">
          {isReopening
            ? "Reopen this job posting?"
            : "Stop accepting applications?"}
        </p>

        {isReopening && (
          <p className="max-w-sm text-sm text-[#4B5563]">
            This job will become visible to job seekers
            again and will start accepting new applications.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      
        <div className="mx-auto grid w-full max-w-[400px] grid-cols-2 gap-3">
            <button
                type="button"
                onClick={() => void handleStatusChange()}
                disabled={isSaving}
                style={{
                backgroundColor: isReopening ? "#16A34A" : "#DC2626",
                color: "#FFFFFF",
                }}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isSaving
                ? isReopening
                    ? "Reopening..."
                    : "Closing..."
                : isReopening
                    ? "Confirm reopen"
                    : "Confirm close"}
            </button>

            <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                setIsConfirming(false);
                setError(null);
                }}
                className="w-full rounded-lg border border-[#E3E6EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#4B5563] transition-colors hover:bg-[#F5F6F8] disabled:opacity-50"
            >
                Cancel
            </button>
        </div>
    </div>
  );
}
