// This is the file to handle logic for managing all resumes
"use server";
import { requireMfaForAction } from "@/lib/auth/require-mfa";

export type ResumeCardData = {
    id: string,
    uploaded_at: string | null,
    file_path: string,
    file_name: string,
    archived_at: string | null
};

export async function getUserResumes(): Promise<ResumeCardData[]> {
    const { supabase, user } = await requireMfaForAction();
    if (!user) return [];

    const { data, error } = await supabase
        .from("resumes")
        .select("id, uploaded_at, file_path, file_name, archived_at")
        .order("uploaded_at", { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch resumes: ${error.message}`);
    }

    return data ?? [];
}

