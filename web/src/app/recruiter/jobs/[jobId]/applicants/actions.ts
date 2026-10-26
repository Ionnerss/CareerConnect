"use server";

import {
  getApplicantDocumentUrl,
  type ApplicantDocumentRequest,
} from "@/lib/recruiter/applicant-documents";

export async function openApplicantDocument(
  input: ApplicantDocumentRequest
) {
  return getApplicantDocumentUrl(input);
}
