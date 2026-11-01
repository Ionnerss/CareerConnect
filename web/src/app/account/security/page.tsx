import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MfaEnrollment from "@/components/auth/mfa-enrollment";

export default async function SecurityPage() {
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
        Two-Factor Authentication
        </h1>

        <section className="rounded-lg border p-6">
            <h2 className="mb-2 text-xl font-semibold">
                Account Security
            </h2>

            <p className="mb-4 text-gray-600">
                Protect your account by enabling two-factor
                authentication using an authenticator app.
            </p>

            <MfaEnrollment />
        </section>
    </main>
    );

}