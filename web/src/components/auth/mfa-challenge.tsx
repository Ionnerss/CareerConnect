
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getHomePathForRole } from "@/lib/auth/roles";

export default function MfaChallenge({ returnTo }: { returnTo?: string }) {
    const router = useRouter();

    const [verificationCode, setVerificationCode] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [factors, setFactors] = useState<{ id: string; friendly_name?: string }[]>([]);
    const [factorId, setFactorId] = useState("");
    const [isSigningOut, setIsSigningOut] = useState(false);

    useEffect(() => {
        let active = true;
        void createClient().auth.mfa.listFactors().then(({ data, error }) => {
            if (!active) return;
            if (error || !data) {
                setErrorMessage("Unable to retrieve your authenticators. Please refresh or sign out.");
                return;
            }
            const verified = data.totp.filter((factor) => factor.status === "verified");
            setFactors(verified);
            setFactorId(verified[0]?.id ?? "");
        }).catch(() => {
            if (active) setErrorMessage("Network error. Refresh or sign out.");
        });
        return () => { active = false; };
    }, []);

    async function handleSignOut() {
        if (isSigningOut) return;
        setIsSigningOut(true);
        const { error } = await createClient().auth.signOut({ scope: "global" });
        if (error) {
            setErrorMessage("Unable to sign out. Please try again.");
            setIsSigningOut(false);
            return;
        }
        router.replace("/auth/login");
        router.refresh();
    }

    async function handleVerify(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        // Prevent invalid or duplicate submissions.
        if (isVerifying || !/^\d{6}$/.test(verificationCode)) {
            return;
        }

        setErrorMessage(null);
        setIsVerifying(true);

        try {
            const supabase = createClient();

            // Verify the selected factor still belongs to this account.
            const {
                data: factorsData,
                error: factorsError,
            } = await supabase.auth.mfa.listFactors();

            if (factorsError || !factorsData) {
                setErrorMessage(
                    "Unable to retrieve your authenticator. Please try again."
                );
                return;
            }

            // Step 2: Find a verified TOTP factor.
            const verifiedFactor = factorsData.totp.find(
                (factor) => factor.id === factorId && factor.status === "verified"
            );

            if (!verifiedFactor) {
                setErrorMessage(
                    "No verified authenticator was found for your account."
                );
                return;
            }

            // Step 3: Verify the six-digit code.
            const { error: verifyError } =
                await supabase.auth.mfa.challengeAndVerify({
                    factorId: verifiedFactor.id,
                    code: verificationCode,
                });

            if (verifyError) {
                setErrorMessage(verifyError.status === 429 || verifyError.code?.includes("rate_limit")
                    ? "Too many attempts. Wait a few minutes before trying again."
                    : "Invalid or expired code. Enter the current code and retry.");
                return;
            }

            // Step 4: Confirm that the session reached AAL2.
            const {
                data: aalData,
                error: aalError,
            } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

            if (aalError || aalData?.currentLevel !== "aal2") {
                setErrorMessage(
                    "Unable to confirm two-factor authentication. Please try again."
                );
                return;
            }

            // Step 5: Retrieve the authenticated user.
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                setErrorMessage(
                    "Your session could not be verified. Please sign in again."
                );
                return;
            }

            // Step 6: Retrieve the user's actual role.
            const {
                data: profile,
                error: profileError,
            } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .maybeSingle();

            if (
                profileError ||
                !profile ||
                (profile.role !== "job_seeker" &&
                    profile.role !== "recruiter")
            ) {
                setErrorMessage(
                    "Unable to determine your account role. Please try again."
                );
                return;
            }

            // Step 7: Redirect only after successful MFA.
            setVerificationCode("");

            const safeReturn = returnTo?.startsWith("/") && !returnTo.startsWith("//") &&
                !returnTo.includes("\\") && !returnTo.includes("#") &&
                (profile.role === "recruiter"
                    ? returnTo.startsWith("/recruiter/") || returnTo === "/recruiter"
                    : ["/dashboard", "/upload-resume", "/jobs", "/profile", "/application-status"].some(
                        (path) => returnTo === path || returnTo.startsWith(`${path}/`)));
            router.replace(safeReturn && returnTo ? returnTo : getHomePathForRole(profile.role));
        } catch {
            setErrorMessage(
                "An unexpected error occurred during verification. Please try again."
            );
        } finally {
            setIsVerifying(false);
        }
    }

    return (
        <form onSubmit={handleVerify} className="space-y-5">
            {errorMessage && (
                <p
                    role="alert"
                    className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
                >
                    {errorMessage}
                </p>
            )}

            {factors.length > 1 && <div className="space-y-2">
                <label htmlFor="mfa-factor" className="block text-sm font-medium">Authenticator</label>
                <select id="mfa-factor" value={factorId} onChange={(event) => setFactorId(event.target.value)}
                    disabled={isVerifying} className="rounded border p-2">
                    {factors.map((factor) => <option key={factor.id} value={factor.id}>
                        {factor.friendly_name || `Authenticator ${factor.id.slice(0, 8)}`}
                    </option>)}
                </select>
            </div>}

            <div className="space-y-2">
                <label
                    htmlFor="mfa-code"
                    className="block text-sm font-medium"
                >
                    Authentication code
                </label>

                <input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={verificationCode}
                    disabled={isVerifying}
                    onChange={(event) => {
                        const value = event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6);

                        setVerificationCode(value);
                    }}
                    placeholder="000000"
                    className="w-full max-w-xs rounded-lg border border-gray-300 px-4 py-3 text-center text-xl tracking-widest focus:border-blue-500 focus:outline-none disabled:opacity-60"
                />
            </div>

            <button
                type="submit"
                disabled={
                    !factorId || verificationCode.length !== 6 ||
                    isVerifying
                }
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isVerifying
                    ? "Verifying..."
                    : "Verify and Continue"}
            </button>
            <button type="button" onClick={handleSignOut} disabled={isSigningOut || isVerifying}
                className="ml-3 rounded border px-5 py-3">{isSigningOut ? "Signing out..." : "Cancel and sign out"}</button>
        </form>
    );
}
