import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { profileExperienceSchema } from "../validations/profile-experience";

export async function getCurrentExperience() {
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

    const { data: profileExperience, error: experienceError } = await supabase
        .from("profile_experience")
        .select(
            "id, profile_id, company_name, job_role, start_date, end_date, description, created_at",
        )
        .eq("profile_id", user.id)
        .order("start_date", { ascending: false });

    if (experienceError) {
        return {
            success: false,
            error: "Unable to load your experience entries. Please try again.",
        };
    }

    return {
        success: true,
        profileExperience: profileExperience ?? [],
    };
}

export async function addCurrentExperience(input: unknown) {
    const parsed = profileExperienceSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            error: "Please check your profile details."
        }
    }

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again."
        };
    }

    const { data: exp, error: expError } = await supabase
    .from("profile_experience")
    .insert({
        profile_id: user.id,
        company_name: parsed.data.company_name,
        job_role: parsed.data.job_role,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date ?? null,
        description: parsed.data.description ?? null
    })
    .select("id, profile_id, created_at, company_name, job_role, start_date, end_date, description")
    .single();

    if(expError) {
        return {
            success: false,
            error: "Unable to save entry. Please try again."
        }
    }

    if(!exp) {
        return {
            success: false,
            error: "Entry was not returned. Please try again."
        }
    }

    return {
        success: true,
        experience: exp
    }
}

export async function updateCurrentExperience(expId: string, input: unknown) {
    const parsedId = z.uuid().safeParse(expId);
    const parsed = profileExperienceSchema.safeParse(input);

    if (!parsedId.success || !parsed.success) {
        return {
            success: false,
            error: "Please check your experience details.",
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

    const { data: exp, error: expError } = await supabase
        .from("profile_experience")
        .update({
            company_name: parsed.data.company_name,
            job_role: parsed.data.job_role,
            start_date: parsed.data.start_date,
            end_date: parsed.data.end_date ?? null,
            description: parsed.data.description ?? null
        })
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .select("id, profile_id, created_at, company_name, job_role, start_date, end_date, description")
        .maybeSingle();

    if (expError) {
        return {
            success: false,
            error: "Unable to update your experience entry. Please try again.",
        };
    }

    if (!exp) {
        return {
            success: false,
            error: "Experience entry not found.",
        };
    }

    return {
        success: true,
        experience: exp
    };
}

export async function deleteCurrentExperience(expId: string) {
    const parsedId = z.uuid().safeParse(expId);

    if (!parsedId.success) {
        return {
            success: false,
            error: "Invalid experience entry ID.",
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

    const { data: deletedExp, error: deleteError } = await supabase
        .from("profile_experience")
        .delete()
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .select("id")
        .maybeSingle();

    if (deleteError) {
        return {
            success: false,
            error: "Unable to delete your experience entry. Please try again.",
        };
    }

    if (!deletedExp) {
        return {
            success: false,
            error: "Experience entry not found.",
        };
    }

    return {
        success: true,
        expId: deletedExp.id,
    };
}