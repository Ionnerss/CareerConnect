import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MfaChallenge from "@/components/auth/mfa-challenge";

export const metadata: Metadata = {
    title: "Verify Your Identity | CareerConnect",
    description: "Complete two-factor authentication to access your account.",
};

export default async function MfaPage() {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        redirect("/auth/login");
    }

    return (
        <main className="mx-auto max-w-3xl px-4 py-10">
            <h1 className="mb-4 text-3xl font-bold">
                Verify Your Identity
            </h1>

            <p className="mb-6 text-gray-600">
                Enter the six-digit code from your authenticator
                app to continue.
            </p>

            <section className="rounded-lg border p-6">
                <h2 className="mb-4 text-xl font-semibold">
                    Two-Factor Authentication
                </h2>

                <MfaChallenge />
            </section>
        </main>
    );
}
