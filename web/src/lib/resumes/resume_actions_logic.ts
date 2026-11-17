"use server";

import { requireMfaForAction } from "@/lib/auth/require-mfa";

export async function archiveResume(resumeId: string) {
    const { supabase, user } = await requireMfaForAction();

    const { data, error } = await supabase
        .from("resumes")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();

    if (error) throw error;
    if (!data) {
        throw new Error("Resume not found or already archived.");
    }
}

export async function unarchiveResume(resumeId: string) {
    const { supabase, user } = await requireMfaForAction();

    const { data, error } = await supabase
        .from("resumes")
        .update({ archived_at: null })
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .not("archived_at", "is", null)
        .select("id")
        .maybeSingle();

    if (error) throw error;
    if (!data) {
        throw new Error("Resume not found or not archived.");
    }
}

export async function downloadResume(resumeId: string) {
    const { supabase, user } = await requireMfaForAction();

    const { data: resume, error } = await supabase
        .from("resumes")
        .select("file_path, file_name")
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .single();

    if (error) throw error;

    const { data, error: storageError } = await supabase.storage
        .from("resumes")
        .createSignedUrl(resume.file_path, 60, {
            download: resume.file_name,
        });

    if (storageError) throw storageError;

    return data.signedUrl;
}

export async function viewResume(resumeId: string) {
    const { supabase, user } = await requireMfaForAction();

    const { data: resume, error } = await supabase
        .from("resumes")
        .select("file_path")
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .single();

    if (error) throw error;

    const { data, error: storageError } = await supabase.storage
        .from("resumes")
        .createSignedUrl(resume.file_path, 60);

    if (storageError) throw storageError;

    return data.signedUrl;
}

export async function renameResume(
    resumeId: string,
    newName: string
) {
    const { supabase, user } = await requireMfaForAction();

    const baseName = newName
        .trim()
        .replace(/\.pdf$/i, "")
        .trim();

    if (!baseName || baseName.length > 100) {
        throw new Error(
            "Enter a filename between 1 and 100 characters."
        );
    }

    const { data, error } = await supabase
        .from("resumes")
        .update({ file_name: `${baseName}.pdf` })
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Resume not found.");
}

export async function replaceResume(
    resumeId: string,
    formData: FormData
) {
    const { supabase, user } = await requireMfaForAction();

    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
        throw new Error("Select a PDF file.");
    }

    if (
        file.type !== "application/pdf" ||
        !file.name.toLowerCase().endsWith(".pdf")
    ) {
        throw new Error("Only PDF files are allowed.");
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new Error("The PDF must be 5 MB or smaller.");
    }

    const { data: resume, error } = await supabase
        .from("resumes")
        .select("file_path")
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .single();

    if (error) throw error;

    const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(resume.file_path, file, {
            upsert: true,
            contentType: "application/pdf",
        });

    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
        .from("resumes")
        .update({
            file_name: file.name,
            uploaded_at: new Date().toISOString(),
        })
        .eq("id", resumeId)
        .eq("user_id", user.id);

    if (updateError) throw updateError;
}

export async function deleteResume(resumeId: string) {
    const { supabase, user } = await requireMfaForAction();

    const { data: resume, error } = await supabase
        .from("resumes")
        .select("file_path")
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .single();

    if (error) throw error;

    const { error: storageError } = await supabase.storage
        .from("resumes")
        .remove([resume.file_path]);

    if (storageError) throw storageError;

    const { error: deleteError } = await supabase
        .from("resumes")
        .delete()
        .eq("id", resumeId)
        .eq("user_id", user.id);

    if (deleteError) throw deleteError;
}
