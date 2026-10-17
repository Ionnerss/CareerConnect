import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { profileSkillSchema } from "../validations/profile-skills";

const skillColumns = "id, profile_id, name, proficiency, created_at";

export async function getCurrentSkills() {
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

    const { data: skills, error: skillsError } = await supabase
        .from("profile_skills")
        .select(skillColumns)
        .eq("profile_id", user.id)
        .order("name", { ascending: true });

    if (skillsError) {
        return {
            success: false,
            error: "Unable to load your skills. Please try again.",
        };
    }

    return {
        success: true,
        skills: skills ?? [],
    };
}

export async function addCurrentSkill(input: unknown) {
    const parsed = profileSkillSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            error: "Please check your skill details.",
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

    const { data: skill, error: skillError } = await supabase
        .from("profile_skills")
        .insert({
            profile_id: user.id,
            name: parsed.data.name,
            proficiency: parsed.data.proficiency,
        })
        .select(skillColumns)
        .single();

    if (skillError?.code === "23505") {
        return {
            success: false,
            error: "You already have a skill with that name.",
        };
    }

    if (skillError) {
        return {
            success: false,
            error: "Unable to add your skill. Please try again.",
        };
    }

    if (!skill) {
        return {
            success: false,
            error: "Skill was not returned. Please try again.",
        };
    }

    return {
        success: true,
        skill,
    };
}

export async function updateCurrentSkill(skillId: string, input: unknown) {
    const parsedId = z.uuid().safeParse(skillId);
    const parsed = profileSkillSchema.safeParse(input);

    if (!parsedId.success || !parsed.success) {
        return {
            success: false,
            error: "Please check your skill details.",
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

    const { data: skill, error: skillError } = await supabase
        .from("profile_skills")
        .update({
            name: parsed.data.name,
            proficiency: parsed.data.proficiency,
        })
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .select(skillColumns)
        .maybeSingle();

    if (skillError?.code === "23505") {
        return {
            success: false,
            error: "You already have a skill with that name.",
        };
    }

    if (skillError) {
        return {
            success: false,
            error: "Unable to update your skill. Please try again.",
        };
    }

    if (!skill) {
        return {
            success: false,
            error: "Skill not found.",
        };
    }

    return {
        success: true,
        skill,
    };
}

export async function deleteCurrentSkill(skillId: string) {
    const parsedId = z.uuid().safeParse(skillId);

    if (!parsedId.success) {
        return {
            success: false,
            error: "Invalid skill ID.",
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

    const { data: deletedSkill, error: deleteError } = await supabase
        .from("profile_skills")
        .delete()
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .select("id")
        .maybeSingle();

    if (deleteError) {
        return {
            success: false,
            error: "Unable to delete your skill. Please try again.",
        };
    }

    if (!deletedSkill) {
        return {
            success: false,
            error: "Skill not found.",
        };
    }

    return {
        success: true,
        skillId: deletedSkill.id,
    };
}