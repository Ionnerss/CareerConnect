import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { profileProjectLinkSchema } from "@/lib/validations/profile-projects";

const linkFields = "id, project_id, label, url, created_at";

export async function getCurrentProjectLinks(projectId: string) {
    const parsedId = z.uuid().safeParse(projectId);

    if (!parsedId.success) {
        return { success: false, error: "Invalid project ID." };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { data: project, error: projectError } = await supabase
        .from("profile_projects")
        .select("id")
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .maybeSingle();

    if (projectError) {
        return {
            success: false,
            error: "Unable to load your project. Please try again.",
        };
    }

    if (!project) {
        return { success: false, error: "Project not found." };
    }

    const { data: links, error: linksError } = await supabase
        .from("profile_project_links")
        .select(linkFields)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

    if (linksError) {
        return {
            success: false,
            error: "Unable to load project links. Please try again.",
        };
    }

    return { success: true, links: links ?? [] };
}

export async function addProjectLink(
    projectId: string,
    input: unknown,
) {
    const parsedId = z.uuid().safeParse(projectId);
    const parsed = profileProjectLinkSchema.safeParse(input);

    if (!parsedId.success || !parsed.success) {
        return {
            success: false,
            error: "Please check your project link details.",
        };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { data: project, error: projectError } = await supabase
        .from("profile_projects")
        .select("id")
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .maybeSingle();

    if (projectError) {
        return {
            success: false,
            error: "Unable to load your project. Please try again.",
        };
    }

    if (!project) {
        return { success: false, error: "Project not found." };
    }

    const { data: link, error: insertError } = await supabase
        .from("profile_project_links")
        .insert({
            project_id: project.id,
            label: parsed.data.label,
            url: parsed.data.url,
        })
        .select(linkFields)
        .maybeSingle();

    if (insertError || !link) {
        return {
            success: false,
            error: "Unable to add your project link. Please try again.",
        };
    }

    return { success: true, link };
}

export async function updateProjectLink(
    linkId: string,
    input: unknown,
) {
    const parsedId = z.uuid().safeParse(linkId);
    const parsed = profileProjectLinkSchema.safeParse(input);

    if (!parsedId.success || !parsed.success) {
        return {
            success: false,
            error: "Please check your project link details.",
        };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { data: existingLink, error: lookupError } = await supabase
        .from("profile_project_links")
        .select("id, project_id")
        .eq("id", parsedId.data)
        .maybeSingle();

    if (lookupError) {
        return {
            success: false,
            error: "Unable to load your project link. Please try again.",
        };
    }

    if (!existingLink) {
        return { success: false, error: "Project link not found." };
    }

    const { data: project, error: projectError } = await supabase
        .from("profile_projects")
        .select("id")
        .eq("id", existingLink.project_id)
        .eq("profile_id", user.id)
        .maybeSingle();

    if (projectError) {
        return {
            success: false,
            error: "Unable to check project ownership. Please try again.",
        };
    }

    if (!project) {
        return { success: false, error: "Project link not found." };
    }

    const { data: link, error: updateError } = await supabase
        .from("profile_project_links")
        .update({
            label: parsed.data.label,
            url: parsed.data.url,
        })
        .eq("id", parsedId.data)
        .eq("project_id", project.id)
        .select(linkFields)
        .maybeSingle();

    if (updateError) {
        return {
            success: false,
            error: "Unable to update your project link. Please try again.",
        };
    }

    if (!link) {
        return { success: false, error: "Project link not found." };
    }

    return { success: true, link };
}

export async function deleteProjectLink(linkId: string) {
    const parsedId = z.uuid().safeParse(linkId);

    if (!parsedId.success) {
        return { success: false, error: "Invalid project link ID." };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again.",
        };
    }

    const { data: existingLink, error: lookupError } = await supabase
        .from("profile_project_links")
        .select("id, project_id")
        .eq("id", parsedId.data)
        .maybeSingle();

    if (lookupError) {
        return {
            success: false,
            error: "Unable to load your project link. Please try again.",
        };
    }

    if (!existingLink) {
        return { success: false, error: "Project link not found." };
    }

    const { data: project, error: projectError } = await supabase
        .from("profile_projects")
        .select("id")
        .eq("id", existingLink.project_id)
        .eq("profile_id", user.id)
        .maybeSingle();

    if (projectError) {
        return {
            success: false,
            error: "Unable to check project ownership. Please try again.",
        };
    }

    if (!project) {
        return { success: false, error: "Project link not found." };
    }

    const { data: deletedLink, error: deleteError } = await supabase
        .from("profile_project_links")
        .delete()
        .eq("id", parsedId.data)
        .eq("project_id", project.id)
        .select("id")
        .maybeSingle();

    if (deleteError) {
        return {
            success: false,
            error: "Unable to delete your project link. Please try again.",
        };
    }

    if (!deletedLink) {
        return { success: false, error: "Project link not found." };
    }

    return { success: true, linkId: deletedLink.id };
}