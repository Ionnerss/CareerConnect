// This is the file to handle logic for managing all resumes
import { createClient } from "@/lib/supabase/server";

export type ResumeCardData = {
    id: string,
    uploaded_at: string | null,
    file_path: string,
    file_name: string,
    archived_at: string | null
};

export async function getUserResumes(): Promise<ResumeCardData[]> {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) return [];

    const { data, error } = await supabase
        .from("resumes")
        .select("id, uploaded_at, file_path, file_name, archived_at")
        .is("archived_at", null)
        .order("uploaded_at", { ascending: false });

    if (error) {
        throw new Error(`Failed to fetch resumes: ${error.message}`);
    }

    return data ?? [];
}