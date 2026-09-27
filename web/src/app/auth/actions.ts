"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function logout() {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
        return { error: "Unable to sign out. Please try again." };
    }
    redirect("/auth/login");
}
