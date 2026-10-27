import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { profileProjectSchema } from "@/lib/validations/profile-projects";

const PROJECT_COLUMNS =
    "id, profile_id, name, short_description, created_at";

export async function getCurrentProjects() {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { data: projects, error: projectsError } = await supabase
        .from("profile_projects")
        .select(PROJECT_COLUMNS)
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false });

    if (projectsError) {
        return {
            success: false,
            error: "Unable to load your projects. Please try again.",
        };
    }

    return {
        success: true,
        projects: projects ?? [],
    };
}

export async function addCurrentProject(input: unknown) {
    const parsed = profileProjectSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            error: "Please check your project details.",
        };
    }

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { data: project, error: projectError } = await supabase
        .from("profile_projects")
        .insert({
            profile_id: user.id,
            name: parsed.data.name,
            short_description: parsed.data.short_description,
        })
        .select(PROJECT_COLUMNS)
        .single();

    if (projectError) {
        return {
            success: false,
            error: "Unable to add your project. Please try again.",
        };
    }

    if (!project) {
        return {
            success: false,
            error: "Project was not returned. Please try again.",
        };
    }

    return {
        success: true,
        project,
    };
}

export async function updateCurrentProject(
    projectId: string,
    input: unknown,
) {
    const parsedId = z.uuid().safeParse(projectId);
    const parsedInput = profileProjectSchema.safeParse(input);

    if (!parsedId.success || !parsedInput.success) {
        return {
            success: false,
            error: "Please check your project details.",
        };
    }

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { data: project, error: projectError } = await supabase
        .from("profile_projects")
        .update({
            name: parsedInput.data.name,
            short_description: parsedInput.data.short_description,
        })
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .select(PROJECT_COLUMNS)
        .maybeSingle();

    if (projectError) {
        return {
            success: false,
            error: "Unable to update your project. Please try again.",
        };
    }

    if (!project) {
        return {
            success: false,
            error: "Project not found.",
        };
    }

    return {
        success: true,
        project,
    };
}

export async function deleteCurrentProject(projectId: string) {
    const parsedId = z.uuid().safeParse(projectId);

    if (!parsedId.success) {
        return {
            success: false,
            error: "Invalid project ID.",
        };
    }

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    // Confirm ownership before attempting deletion.
    const { data: existingProject, error: readError } = await supabase
        .from("profile_projects")
        .select("id")
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .maybeSingle();

    if (readError) {
        return {
            success: false,
            error: "Unable to load your project. Please try again.",
        };
    }

    if (!existingProject) {
        return {
            success: false,
            error: "Project not found.",
        };
    }

    const { data: deletedProject, error: deleteError } = await supabase
        .from("profile_projects")
        .delete()
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .select("id")
        .maybeSingle();

    if (deleteError || !deletedProject) {
        // A failed or missing response does not establish whether the DELETE
        // committed. Check before touching Storage.
        const { data: remainingProject, error: checkError } = await supabase
            .from("profile_projects")
            .select("id")
            .eq("id", parsedId.data)
            .eq("profile_id", user.id)
            .maybeSingle();

        if (checkError) {
            return {
                success: false,
                error:
                    "Could not confirm whether your project was deleted. " +
                    "Please refresh before trying again.",
            };
        }

        if (remainingProject) {
            return {
                success: false,
                error: "Unable to delete your project. Please try again.",
            };
        }
    }

    // The project is confirmed deleted. Its image metadata rows cascade away,
    // but the actual Storage objects must be removed through the Storage API.
    const folder = `${user.id}/${parsedId.data}`;
    const bucket = supabase.storage.from("project-images");

    while (true) {
        const { data: entries, error: listError } = await bucket.list(
            folder,
            { limit: 100, offset: 0 },
        );

        if (listError || !entries) {
            console.error("Failed to list deleted project's images:", listError);

            return {
                success: true,
                projectId: parsedId.data,
                cleanupPending: true,
            };
        }

        const paths = entries
            .filter((entry) => entry.id !== null)
            .map((entry) => `${folder}/${entry.name}`);

        if (paths.length === 0) {
            return {
                success: true,
                projectId: parsedId.data,
                cleanupPending: false,
            };
        }

        const { error: removeError } = await bucket.remove(paths);

        if (removeError) {
            console.error(
                "Failed to remove deleted project's images:",
                removeError,
            );

            return {
                success: true,
                projectId: parsedId.data,
                cleanupPending: true,
            };
        }

        // List offset 0 again because the previous batch has been removed.
    }
}