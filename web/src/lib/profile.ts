import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "./validations/profile";

export async function getCurrentProfile() {
    const supabase = await createClient();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            success: false,
            error: "Unable to authenticate. Please sign in again."
        };
    }

    const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, bio, location, contact_email")
    .eq("id", user.id)
    .maybeSingle();

    if (profileError) {
        return {
            success: false,
            error: "Unable to load your profile. Please try again."
        };
    }
    if (!profile) {
        return {
            success: false,
            error: "Profile not found."
        };
    }

    return {
        success: true,
        profile
    };
}

export async function updateCurrentProfile(input: unknown) {
    const parsed = profileSchema.safeParse(input);

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

    const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({
        full_name: parsed.data.full_name,
        bio: parsed.data.bio,
        location: parsed.data.location,
        contact_email: parsed.data.contact_email
    })
    .eq("id", user.id)
    .select("id, full_name, bio, location, contact_email")
    .maybeSingle();

    if(profileError) {
        return {
            success: false,
            error: "Unable to save your profile. Please try again."
        }
    }

    if(!profile) {
        return {
            success: false,
            error: "Profile not found."
        }
    }

    return {
        success: true,
        profile
    }
}