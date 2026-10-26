"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";

import { openApplicantDocument } from "@/app/recruiter/jobs/[jobId]/applicants/actions";

type DocumentKind = "resume" | "cover_letter";
type DocumentMode = "view" | "download";

type Props = {
  applicationId: string;
  hasResume: boolean;
  hasCoverLetter: boolean;
};

export function ApplicantDocuments({
  applicationId,
  hasResume,
  hasCoverLetter,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDocument(
    kind: DocumentKind,
    mode: DocumentMode
  ) {
    if (busy !== null) return;

    setError(null);

    // Open a tab synchronously to avoid popup blockers
    // after the asynchronous Server Action finishes.
    const tab =
      mode === "view"
        ? window.open("about:blank", "_blank")
        : null;

    if (mode === "view" && !tab) {
      setError("Please allow pop-ups to view this PDF.");
      return;
    }

    if (tab) {
      tab.opener = null;
    }

    setBusy(`${kind}:${mode}`);

    try {
      const result = await openApplicantDocument({
        applicationId,
        kind,
        mode,
      });

      if (!result.success) {
        tab?.close();
        setError(result.error);
        return;
      }

      if (mode === "view") {
        tab?.location.replace(result.url);
      } else {
        window.location.assign(result.url);
      }
    } catch {
      tab?.close();
      setError(
        "Unable to access the document. Please try again."
      );
    } finally {
      setBusy(null);
    }
  }

  function renderActions(
    kind: DocumentKind,
    available: boolean,
    label: string
  ) {
    if (!available) {
      return (
        <span className="text-xs text-[#64748B]">
          Not provided
        </span>
      );
    }

    const isBusy = busy !== null;

    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-label={`View ${label.toLowerCase()}`}
          disabled={isBusy}
          onClick={() => void handleDocument(kind, "view")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#D9E2F5] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:bg-[#EEF2FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Eye aria-hidden="true" className="h-3.5 w-3.5" />
          View
        </button>

        <button
          type="button"
          aria-label={`Download ${label.toLowerCase()}`}
          disabled={isBusy}
          onClick={() => void handleDocument(kind, "download")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E3E6EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F5F6F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Download
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-[170px] space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-[#475569]">
          Resume
        </p>
        {renderActions("resume", hasResume, "Resume")}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-[#475569]">
          Cover letter
        </p>
        {renderActions(
          "cover_letter",
          hasCoverLetter,
          "Cover letter"
        )}
      </div>

      {busy && (
        <p role="status" className="text-xs text-[#64748B]">
          Opening document...
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
