
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getHomePathForRole } from "@/lib/auth/roles";

export default function MfaChallenge() {
    const router = useRouter();

    const [verificationCode, setVerificationCode] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

            // Step 1: Retrieve the user's MFA factors.
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
                (factor) => factor.status === "verified"
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
                setErrorMessage(
                    "Invalid, expired, or rejected verification code. Please try again."
                );
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

            router.replace(getHomePathForRole(profile.role));
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
                    verificationCode.length !== 6 ||
                    isVerifying
                }
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isVerifying
                    ? "Verifying..."
                    : "Verify and Continue"}
            </button>
        </form>
    );
}
