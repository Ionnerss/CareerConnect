
"use server";

import { revalidatePath } from "next/cache";

import { createJobPosting } from "@/lib/jobs/create-job";
import { closeJobPosting } from "@/lib/jobs/close-job";
import { reopenJobPosting } from "@/lib/jobs/reopen-job";
import { updateJobPosting } from "@/lib/jobs/update-job";

function refreshJobPages(jobId: string) {
  revalidatePath("/recruiter/jobs");
  revalidatePath("/jobs");
  revalidatePath(`/recruiter/jobs/${jobId}/applicants`);
}

export async function createJob(input: unknown) {
  const result = await createJobPosting(input);

  if (result.success) {
    revalidatePath("/recruiter/jobs");
    revalidatePath("/jobs");
  }

  return result;
}

export async function updateJob(jobId: unknown, input: unknown) {
  const result = await updateJobPosting(jobId, input);

  if (result.success) {
    refreshJobPages(result.jobId);
    revalidatePath(`/recruiter/jobs/${result.jobId}/edit`);
  }

  return result;
}

export async function closeJob(jobId: unknown) {
  const result = await closeJobPosting(jobId);

  if (result.success) {
    refreshJobPages(result.jobId);
  }

  return result;
}

export async function reopenJob(jobId: unknown) {
  const result = await reopenJobPosting(jobId);

  if (result.success) {
    refreshJobPages(result.jobId);
  }

  return result;
}
