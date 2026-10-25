"use server";

import { revalidatePath } from "next/cache";
import { createJobPosting } from "@/lib/jobs/create-job";

export async function createJob(input: unknown) {
  const result = await createJobPosting(input);

  if (result.success) {
    // Show the new posting on "My job postings" and in job search right away.
    revalidatePath("/recruiter/jobs");
    revalidatePath("/jobs");
  }

  return result;
}
