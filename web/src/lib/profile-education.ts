import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { profileEducationSchema } from "./validations/profile-education";

export async function getCurrentEducation() {
    const supabase = await createClient();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again."
        };
    }

    const { data: profileEducation, error: profileEducationError } = await supabase
    .from("profile_education")
    .select("id, profile_id, created_at, school, degree, start_date, field_of_study, end_date, description")
    .eq("profile_id", user.id)
    .order("start_date", { ascending: false })

    if (profileEducationError) {
        return {
            success: false,
            error: "Unable to load your education entries. Please try again."
        };
    }

    return {
        success: true,
        profileEducation
    };
}

export async function addCurrentEducation(input: unknown) {
    const parsed = profileEducationSchema.safeParse(input);

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

    const { data: education, error: educationError } = await supabase
    .from("profile_education")
    .insert({
        profile_id: user.id,
        school: parsed.data.school,
        degree: parsed.data.degree,
        start_date: parsed.data.start_date,
        field_of_study: parsed.data.field_of_study ?? null,
        end_date: parsed.data.end_date ?? null,
        description: parsed.data.description ?? null
    })
    .select("id, profile_id, created_at, school, degree, start_date, field_of_study, end_date, description")
    .single();

    if(educationError) {
        return {
            success: false,
            error: "Unable to save entry Please try again."
        }
    }

    if(!education) {
        return {
            success: false,
            error: "Entry was not returned. Please try again."
        }
    }

    return {
        success: true,
        education
    }
}

export async function updateCurrentEducation(educationId: string, input: unknown) {
    const parsedId = z.uuid().safeParse(educationId);
    const parsed = profileEducationSchema.safeParse(input);

    if (!parsedId.success || !parsed.success) {
        return {
            success: false,
            error: "Please check your education details.",
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

    const { data: education, error: updateError } = await supabase
        .from("profile_education")
        .update({
            school: parsed.data.school,
            degree: parsed.data.degree,
            start_date: parsed.data.start_date,
            field_of_study: parsed.data.field_of_study ?? null,
            end_date: parsed.data.end_date ?? null,
            description: parsed.data.description ?? null,
        })
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .select(
            "id, profile_id, created_at, school, degree, start_date, field_of_study, end_date, description",
        )
        .maybeSingle();

    if (updateError) {
        return {
            success: false,
            error: "Unable to update your education entry. Please try again.",
        };
    }

    if (!education) {
        return {
            success: false,
            error: "Education entry not found.",
        };
    }

    return {
        success: true,
        education,
    };
}

export async function deleteCurrentEducation(educationId: string) {
    const parsedId = z.uuid().safeParse(educationId);

    if (!parsedId.success) {
        return {
            success: false,
            error: "Invalid education entry ID.",
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

    const { data: deletedEducation, error: deleteError } = await supabase
        .from("profile_education")
        .delete()
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .select("id")
        .maybeSingle();

    if (deleteError) {
        return {
            success: false,
            error: "Unable to delete your education entry. Please try again.",
        };
    }

    if (!deletedEducation) {
        return {
            success: false,
            error: "Education entry not found.",
        };
    }

    return {
        success: true,
        educationId: deletedEducation.id,
    };
}