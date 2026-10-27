"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type UploadResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid_file"
        | "signed_out"
        | "application_unavailable"
        | "already_attached"
        | "upload_failed";
    };

export async function uploadApplicationCoverLetter(
  formData: FormData
): Promise<UploadResult> {
  const parsedId = z.string().uuid().safeParse(formData.get("applicationId"));
  const file = formData.get("file");

  if (
    !parsedId.success ||
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 5 * 1024 * 1024 ||
    (file.type !== "" && file.type !== "application/pdf")
  ) {
    return { ok: false, reason: "invalid_file" };
  }

  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== "%PDF-") {
    return { ok: false, reason: "invalid_file" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, reason: "signed_out" };
  }

  const { data: application, error: lookupError } = await supabase
    .from("applications")
    .select("id, cover_letter_path")
    .eq("id", parsedId.data)
    .eq("applicant_id", user.id)
    .maybeSingle();

  if (lookupError || !application) {
    return { ok: false, reason: "application_unavailable" };
  }

  if (application.cover_letter_path) {
    return { ok: false, reason: "already_attached" };
  }

  const path =
    `${user.id}/${application.id}/${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("cover_letters")
    .upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, reason: "upload_failed" };
  }

  const { data: updated, error: updateError } = await supabase
    .from("applications")
    .update({ cover_letter_path: path })
    .eq("id", application.id)
    .eq("applicant_id", user.id)
    .is("cover_letter_path", null)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    await supabase.storage.from("cover_letters").remove([path]);
    return { ok: false, reason: "upload_failed" };
  }

  return { ok: true };
}