"use server";

import { revalidatePath } from "next/cache";
import {
  cancelInterview,
  createInterview,
  updateInterview,
  type InterviewMutationResult,
} from "@/lib/recruiter/interviews";

const INTERVIEWS_PATH = "/recruiter/interviews";

function refresh(result: InterviewMutationResult) {
  if (!result.success) return;
  revalidatePath(INTERVIEWS_PATH);
  if (result.jobId) revalidatePath(`/recruiter/jobs/${result.jobId}/applicants`);
}

export async function createInterviewAction(applicationId: unknown, input: unknown) {
  const result = await createInterview(applicationId, input);
  refresh(result);
  return result;
}

export async function updateInterviewAction(interviewId: unknown, input: unknown) {
  const result = await updateInterview(interviewId, input);
  refresh(result);
  return result;
}

export async function cancelInterviewAction(interviewId: unknown) {
  const result = await cancelInterview(interviewId);
  refresh(result);
  return result;
}
