import { createClient } from "@/lib/supabase/server";

export async function getMfaStatus() {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("You must be logged in.");

    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) throw error;
    if (!data) throw new Error("Unable to determine MFA status.");

    const { currentLevel, nextLevel } = data;

    if (currentLevel === 'aal1' && nextLevel === 'aal1') {
        return {
            accessAllowed: true,
            status: "authenticated"
        }
    }
    if (currentLevel === 'aal1' && nextLevel === 'aal2') {
        return {
            accessAllowed: false,
            status: "mfa_required"
        }
    }
    if (currentLevel === 'aal2' && nextLevel === 'aal2') {
        return {
            accessAllowed: true,
            status: "authenticated"
        }
    }
    if (currentLevel === 'aal2' && nextLevel === 'aal1') {
        return {
            accessAllowed: false,
            status: "session_stale"
        }
    }
    
    return {
        accessAllowed: false,
        status: "auth_info_unavailable"
    }
}