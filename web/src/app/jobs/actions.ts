"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { submitApplication } from "@/lib/jobs/submit-application";

type ApplicationResume = {
  id: string;
  file_name: string;
};

type ActiveResumesResult =
  | { ok: true; resumes: ApplicationResume[] }
  | { ok: false; reason: "signed_out" | "database_error" };

export async function getActiveApplicationResumes(): Promise<ActiveResumesResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, reason: "signed_out" };
  }

  const { data, error } = await supabase
    .from("resumes")
    .select("id, file_name")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return { ok: false, reason: "database_error" };
  }

  return {
    ok: true,
    resumes: data ?? [],
  };
}

export async function submitJobApplication(input: unknown) {
  const result = await submitApplication(input);

  if (result.ok) {
    revalidatePath("/application-status");
    revalidatePath("/dashboard");
  }

  return result;
}
