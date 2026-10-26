"use client";

import { useState, type FormEvent } from "react";
import { uploadApplicationCoverLetter } from "@/app/jobs/cover-letter-actions";

export default function CoverLetterUpload({
  applicationId,
}: {
  applicationId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [attached, setAttached] = useState(false);
  const [message, setMessage] = useState("");

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;

    const formData = new FormData(event.currentTarget);
    formData.set("applicationId", applicationId);

    setUploading(true);
    setMessage("");

    try {
      const result = await uploadApplicationCoverLetter(formData);

      if (result.ok || result.reason === "already_attached") {
        setAttached(true);
        setMessage("Cover letter attached.");
      } else {
        setMessage(
          result.reason === "invalid_file"
            ? "Choose a PDF smaller than 5 MB."
            : result.reason === "signed_out"
              ? "Please sign in and try again."
              : "Could not attach the cover letter. You can retry here later."
        );
      }
    } catch {
      setMessage(
        "Could not confirm the upload. Refresh this page to check before retrying."
      );
    } finally {
      setUploading(false);
    }
  }

  if (attached) return <p role="status">{message}</p>;

  return (
    <form onSubmit={handleUpload} className="mt-6 space-y-3">
      <label className="block text-sm font-semibold" htmlFor="cover-letter">
        Optional cover letter (PDF, up to 5 MB)
      </label>
      <input
        id="cover-letter"
        name="file"
        type="file"
        accept="application/pdf,.pdf"
        required
        disabled={uploading}
      />
      <button
        type="submit"
        disabled={uploading}
        className="block rounded-xl bg-[#3151D5] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "Attach cover letter"}
      </button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  );
}