import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
    profilePreferenceLanguageSchema,
    profilePreferencesSchema,
} from "@/lib/validations/profile-preferences";

const preferenceColumns =
    "profile_id, desired_role, desired_position, desired_salary, work_mode, created_at";

const languageColumns = "id, profile_id, name, created_at";

const authFailure = {
    success: false,
    error: "Unable to authenticate. Please sign in again.",
};

export async function getCurrentPreferences() {
    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) return authFailure;

    const { data: preferences, error } = await supabase
        .from("profile_preferences")
        .select(preferenceColumns)
        .eq("profile_id", user.id)
        .maybeSingle();

    if (error) {
        return {
            success: false,
            error: "Unable to load your preferences. Please try again.",
        };
    }

    return {
        success: true,
        preferences: preferences ?? null,
    };
}

export async function saveCurrentPreferences(input: unknown) {
    const parsed = profilePreferencesSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            error: "Please check your preference details.",
        };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) return authFailure;

    const { data: preferences, error } = await supabase
        .from("profile_preferences")
        .upsert(
            {
                profile_id: user.id,
                desired_role: parsed.data.desired_role,
                desired_position: parsed.data.desired_position,
                desired_salary: parsed.data.desired_salary,
                work_mode: parsed.data.work_mode,
            },
            { onConflict: "profile_id" },
        )
        .select(preferenceColumns)
        .single();

    if (error) {
    console.error("Preferences upsert failed:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
    });

    return {
        success: false,
        error: "Unable to save your preferences. Please try again.",
    };
}

if (!preferences) {
    console.error("Preferences upsert returned no row and no error");

    return {
        success: false,
        error: "Unable to save your preferences. Please try again.",
    };
}

    return { success: true, preferences };
}

export async function deleteCurrentPreferences() {
    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) return authFailure;

    const { data: deleted, error } = await supabase
        .from("profile_preferences")
        .delete()
        .eq("profile_id", user.id)
        .select("profile_id")
        .maybeSingle();

    if (error) {
        return {
            success: false,
            error: "Unable to delete your preferences. Please try again.",
        };
    }

    if (!deleted) {
        return {
            success: false,
            error: "Preferences not found.",
        };
    }

    return { success: true, profileId: deleted.profile_id };
}

export async function getCurrentPreferenceLanguages() {
    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) return authFailure;

    const { data: languages, error } = await supabase
        .from("profile_preference_languages")
        .select(languageColumns)
        .eq("profile_id", user.id)
        .order("name", { ascending: true });

    if (error) {
        return {
            success: false,
            error: "Unable to load your languages. Please try again.",
        };
    }

    return { success: true, languages: languages ?? [] };
}

export async function addPreferenceLanguage(input: unknown) {
    const parsed = profilePreferenceLanguageSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            error: "Please enter a language name of 1–100 characters.",
        };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) return authFailure;

    const { data: language, error } = await supabase
        .from("profile_preference_languages")
        .insert({
            profile_id: user.id,
            name: parsed.data.name,
        })
        .select(languageColumns)
        .single();

    if (error?.code === "23505") {
        return {
            success: false,
            error: "You already added that language.",
        };
    }

    if (error || !language) {
        return {
            success: false,
            error: "Unable to add your language. Please try again.",
        };
    }

    return { success: true, language };
}

export async function updatePreferenceLanguage(
    languageId: string,
    input: unknown,
) {
    const parsedId = z.uuid().safeParse(languageId);
    const parsed = profilePreferenceLanguageSchema.safeParse(input);

    if (!parsedId.success || !parsed.success) {
        return {
            success: false,
            error: "Please check the language ID and name.",
        };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) return authFailure;

    const { data: language, error } = await supabase
        .from("profile_preference_languages")
        .update({ name: parsed.data.name })
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .select(languageColumns)
        .maybeSingle();

    if (error?.code === "23505") {
        return {
            success: false,
            error: "You already added that language.",
        };
    }

    if (error) {
        return {
            success: false,
            error: "Unable to update your language. Please try again.",
        };
    }

    if (!language) {
        return {
            success: false,
            error: "Language not found.",
        };
    }

    return { success: true, language };
}

export async function deletePreferenceLanguage(languageId: string) {
    const parsedId = z.uuid().safeParse(languageId);

    if (!parsedId.success) {
        return {
            success: false,
            error: "Invalid language ID.",
        };
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } =
        await supabase.auth.getUser();

    if (authError || !user) return authFailure;

    const { data: deleted, error } = await supabase
        .from("profile_preference_languages")
        .delete()
        .eq("id", parsedId.data)
        .eq("profile_id", user.id)
        .select("id")
        .maybeSingle();

    if (error) {
        return {
            success: false,
            error: "Unable to delete your language. Please try again.",
        };
    }

    if (!deleted) {
        return {
            success: false,
            error: "Language not found.",
        };
    }

    return { success: true, languageId: deleted.id };
}