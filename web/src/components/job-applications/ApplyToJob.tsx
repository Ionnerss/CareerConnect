"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import {
  getActiveApplicationResumes,
  submitJobApplication,
} from "@/app/jobs/actions";

type ResumeOption = {
  id: string;
  file_name: string;
};

type ApplyToJobProps = {
  jobId: string;
};

function getErrorMessage(reason: string): string {
  switch (reason) {
    case "invalid_input":
      return "Invalid application details.";

    case "signed_out":
      return "Please sign in again.";

    case "job_unavailable":
      return "This job is no longer accepting applications.";

    case "resume_unavailable":
      return "The selected resume is no longer available.";

    case "already_applied":
      return "You have already applied to this job.";

    default:
      return "Unable to submit your application. Please try again.";
  }
}

export function ApplyToJob({ jobId }: ApplyToJobProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function loadResumes() {
    if (isLoading || isSubmitting) return;

    setIsLoading(true);
    setError(null);
    setResumes([]);
    setSelectedResumeId("");

    try {
      const result = await getActiveApplicationResumes();

      if (!result.ok) {
        setError(
          result.reason === "signed_out"
            ? "Please sign in to apply."
            : "Unable to load your resumes."
        );
        return;
      }

      setResumes(result.resumes);
    } catch {
      setError("Unable to load your resumes.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpen() {
    setIsOpen(true);
    void loadResumes();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    if (!selectedResumeId) {
      setError("Please select a resume.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitJobApplication({
        jobId,
        resumeId: selectedResumeId,
      });

      if (!result.ok) {
        setError(getErrorMessage(result.reason));
        return;
      }

      setSubmitted(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Successful application
  if (submitted) {
    return (
      <div
        role="status"
        className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4"
      >
        <p className="font-semibold text-green-800">
          Application submitted successfully!
        </p>

        <p className="text-sm text-green-700">
          Your application has been saved.
        </p>

        <Link
          href="/application-status"
          className="text-sm font-semibold text-blue-700 hover:underline"
        >
          View my applications
        </Link>
      </div>
    );
  }

  // Initial Apply button
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        Apply for this job
      </button>
    );
  }

  // Application form
  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <div>
        <h3 className="text-base font-semibold">
          Apply for this job
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Choose which resume you want to submit.
        </p>
      </div>

      {isLoading ? (
        <p
          role="status"
          className="text-sm text-muted-foreground"
        >
          Loading resumes...
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {resumes.length > 0 && (
            <div className="space-y-2">
              <label
                htmlFor={`resume-${jobId}`}
                className="block text-sm font-medium"
              >
                Select resume
              </label>

              <select
                id={`resume-${jobId}`}
                value={selectedResumeId}
                onChange={(event) => {
                  setSelectedResumeId(event.target.value);
                  setError(null);
                }}
                disabled={isSubmitting}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm"
              >
                <option value="">Choose a resume</option>

                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.file_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {resumes.length === 0 && !error && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                You have no active resumes.
              </p>

              <Link
                href="/upload-resume"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                Upload a resume
              </Link>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {resumes.length > 0 && (
              <button
                type="submit"
                disabled={!selectedResumeId || isSubmitting}
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? "Submitting..."
                  : "Submit application"}
              </button>
            )}

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsOpen(false);
                setError(null);
              }}
              className="rounded-lg border border-border px-5 py-3 text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>

            {error && !isSubmitting && (
              <button
                type="button"
                onClick={() => void loadResumes()}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Refresh resumes
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
