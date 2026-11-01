"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type EnrollmentData = {
    factorId: string;
    qrCode: string;
    secret: string;
};

export default function MfaEnrollment() {
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null);

    const [verificationCode, setVerificationCode] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(false);

    // Existing MFA status
    const [isCheckingMfa, setIsCheckingMfa] = useState(true);
    const [mfaCheckFailed, setMfaCheckFailed] = useState(false);
    const [verifiedFactors, setVerifiedFactors] = useState<{ id: string; friendly_name?: string }[]>([]);
    const [selectedFactorId, setSelectedFactorId] = useState("");
    const [freshCode, setFreshCode] = useState("");
    const [isManaging, setIsManaging] = useState(false);

    // Check existing MFA factors when the page loads.
    useEffect(() => {
        let cancelled = false;

        async function checkMfaStatus() {
            try {
                const supabase = createClient();

                const { data, error } = await supabase.auth.mfa.listFactors();

                if (error || !data || !Array.isArray(data.totp)) {
                    throw new Error("Unable to check MFA status.");
                }

                const hasVerifiedTotp = data.totp.some(
                    (factor) => factor.status === "verified"
                );

                if (!cancelled) {
                    setIsVerified(hasVerifiedTotp);
                    setVerifiedFactors(data.totp.filter((factor) => factor.status === "verified"));
                }
            } catch {
                if (!cancelled) {
                    setMfaCheckFailed(true);
                    setErrorMessage(
                        "Unable to check your two-factor authentication status. Please refresh the page."
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsCheckingMfa(false);
                }
            }
        }

        void checkMfaStatus();

        return () => {
            cancelled = true;
        };
    }, []);

    async function handleEnroll() {
        if (
            isEnrolling ||
            isCheckingMfa ||
            mfaCheckFailed ||
            enrollmentData
        ) {
            return;
        }

        setErrorMessage(null);
        setIsEnrolling(true);

        try {
            const supabase = createClient();

            if (isVerified) {
                if (!/^\d{6}$/.test(freshCode) || !selectedFactorId) {
                    setErrorMessage("Select an authenticator and enter its current code.");
                    return;
                }
                const verified = await supabase.auth.mfa.challengeAndVerify({
                    factorId: selectedFactorId, code: freshCode,
                });
                setFreshCode("");
                if (verified.error) {
                    setErrorMessage("Current authenticator verification failed.");
                    return;
                }
            }

            // A refreshed page can leave an unverified setup behind. Only
            // remove this account's unverified TOTP factors before retrying.
            const existing = await supabase.auth.mfa.listFactors();
            if (existing.error || !existing.data) throw new Error("Unable to check existing factors.");
            for (const factor of existing.data.all.filter((item) => item.factor_type === "totp" && item.status === "unverified")) {
                const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
                if (removed.error) throw new Error("Unable to clear the interrupted setup.");
            }

            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: "totp",
                friendlyName: "CareerConnect Authenticator",
            });

            if (error) {
                setErrorMessage(error.message);
                return;
            }

            if (
                !data ||
                !data.id ||
                !data.totp ||
                !data.totp.qr_code ||
                !data.totp.secret
            ) {
                setErrorMessage(
                    "Unable to retrieve authenticator setup information."
                );
                return;
            }

            setEnrollmentData({
                factorId: data.id,
                qrCode: data.totp.qr_code,
                secret: data.totp.secret,
            });
        } catch {
            setErrorMessage(
                "An unexpected error occurred while setting up two-factor authentication. Please try again."
            );
        } finally {
            setIsEnrolling(false);
        }
    }

    async function handleVerify() {
        if (
            !enrollmentData ||
            !/^\d{6}$/.test(verificationCode) ||
            isVerifying
        ) {
            return;
        }

        setErrorMessage(null);
        setIsVerifying(true);

        try {
            const supabase = createClient();

            const { error } =
                await supabase.auth.mfa.challengeAndVerify({
                    factorId: enrollmentData.factorId,
                    code: verificationCode,
                });

            if (error) {
                setErrorMessage(
                    "Unable to verify the code. Please try again."
                );
                return;
            }

            // Verification succeeded.
            setIsVerified(true);
            const factors = await supabase.auth.mfa.listFactors();
            if (!factors.error && factors.data) {
                setVerifiedFactors(factors.data.totp.filter((factor) => factor.status === "verified"));
            }

            // Clear sensitive enrollment information from state.
            setEnrollmentData(null);
            setVerificationCode("");
        } catch {
            setErrorMessage(
                "An unexpected error occurred while verifying the code. Please try again."
            );
        } finally {
            setIsVerifying(false);
        }
    }

    async function handleCancelSetup() {
        if (!enrollmentData || isManaging) return;
        setIsManaging(true);
        try {
            const result = await createClient().auth.mfa.unenroll({ factorId: enrollmentData.factorId });
            if (result.error) throw result.error;
            setEnrollmentData(null);
            setVerificationCode("");
            setErrorMessage(null);
        } catch {
            setErrorMessage("Could not cancel setup. Please retry before starting again.");
        } finally {
            setIsManaging(false);
        }
    }

    async function handleRemoveFactor() {
        if (isManaging || !selectedFactorId || !/^\d{6}$/.test(freshCode)) return;
        const last = verifiedFactors.length === 1;
        if (!window.confirm(last
            ? "Disable two-factor authentication? Password-only sign-in will be allowed again."
            : "Remove this authenticator? Keep your backup available.")) return;
        setIsManaging(true);
        setErrorMessage(null);
        try {
            const supabase = createClient();
            const current = await supabase.auth.mfa.listFactors();
            if (current.error || !current.data?.totp.some(
                (factor) => factor.id === selectedFactorId && factor.status === "verified"
            )) throw new Error("Factor unavailable.");
            const verified = await supabase.auth.mfa.challengeAndVerify({
                factorId: selectedFactorId, code: freshCode,
            });
            setFreshCode("");
            if (verified.error) throw new Error("Fresh verification failed.");
            const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (assurance.error || assurance.data?.currentLevel !== "aal2") throw new Error("Assurance unavailable.");
            const removed = await supabase.auth.mfa.unenroll({ factorId: selectedFactorId });
            if (removed.error) throw removed.error;
            const refresh = await supabase.auth.refreshSession();
            if (refresh.error) throw new Error("Factor removed. Sign out and in again to refresh your session.");
            const factors = await supabase.auth.mfa.listFactors();
            if (factors.error || !factors.data) throw new Error("Factor removed. Refresh this page to check status.");
            const remaining = factors.data.totp.filter((factor) => factor.status === "verified");
            setVerifiedFactors(remaining);
            setIsVerified(remaining.length > 0);
            setSelectedFactorId("");
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to remove authenticator.");
        } finally {
            setIsManaging(false);
        }
    }

    return (
        <div className="space-y-5">
            {/* Display errors */}
            {errorMessage && (
                <p
                    role="alert"
                    className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
                >
                    {errorMessage}
                </p>
            )}

            {isCheckingMfa ? (
                <p role="status" className="text-sm text-gray-600">
                    Checking two-factor authentication status...
                </p>
            ) : mfaCheckFailed ? (
                <p className="text-sm text-gray-600">
                    Authentication settings are temporarily unavailable.
                    Refresh the page to try again.
                </p>
            ) : !enrollmentData ? (
                /* No verified MFA factor */
                <div className="space-y-4">
                {isVerified && <>
                    <p role="status">Two-factor authentication is enabled with {verifiedFactors.length} authenticator(s).</p>
                    <p>Add a second authenticator as a backup. Losing every authenticator may lock you out; password reset does not bypass MFA.</p>
                    <label className="block" htmlFor="existing-factor">Existing authenticator</label>
                    <select id="existing-factor" value={selectedFactorId} disabled={isManaging || isEnrolling}
                        onChange={(event) => setSelectedFactorId(event.target.value)} className="rounded border p-2">
                        <option value="">Select an authenticator</option>
                        {verifiedFactors.map((factor) => <option key={factor.id} value={factor.id}>
                            {factor.friendly_name || `Authenticator ${factor.id.slice(0, 8)}`}
                        </option>)}
                    </select>
                    <label className="block" htmlFor="fresh-code">Fresh code from selected authenticator</label>
                    <input id="fresh-code" value={freshCode} inputMode="numeric" autoComplete="one-time-code"
                        onChange={(event) => setFreshCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        disabled={isManaging || isEnrolling} maxLength={6} className="rounded border p-2" />
                    <button type="button" onClick={handleRemoveFactor}
                        disabled={isManaging || isEnrolling || !selectedFactorId || freshCode.length !== 6}
                        className="block rounded border px-5 py-3">Remove selected authenticator</button>
                </>}
                <button
                    type="button"
                    onClick={handleEnroll}
                    disabled={isEnrolling || isManaging || (isVerified && (!selectedFactorId || freshCode.length !== 6))}
                    className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isEnrolling
                        ? "Setting up..."
                        : isVerified ? "Add backup authenticator" : "Enable Two-Factor Authentication"}
                </button>
                </div>
            ) : (
                /* Authenticator enrollment */
                <div className="space-y-5">
                    <h3 className="text-xl font-semibold">
                        Set up your authenticator
                    </h3>

                    <p className="text-sm text-gray-600">
                        Scan this QR code using your authenticator app.
                    </p>

                    {/* QR code */}
                    <div className="flex justify-center rounded-lg border bg-white p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={
                                enrollmentData.qrCode.startsWith("data:image/")
                                    ? enrollmentData.qrCode
                                    : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollmentData.qrCode)}`
                            }
                            alt="Authenticator setup QR code"
                            width={200}
                            height={200}
                        />
                    </div>

                    {/* Manual setup key */}
                    <div className="space-y-2">
                        <h4 className="font-semibold">
                            Manual setup key
                        </h4>

                        <p className="text-sm text-gray-600">
                            If you cannot scan the QR code, enter
                            this key manually in your authenticator app.
                        </p>

                        <code className="block select-all break-all rounded-lg bg-gray-100 p-3 text-sm">
                            {enrollmentData.secret}
                        </code>
                    </div>

                    {/* Verification */}
                    <div className="space-y-3 border-t pt-5">
                        <h4 className="text-lg font-semibold">
                            Verify your authenticator
                        </h4>

                        <p className="text-sm text-gray-600">
                            Enter the six-digit code generated by
                            your authenticator app.
                        </p>

                        <div className="space-y-2">
                            <label
                                htmlFor="verificationCode"
                                className="block text-sm font-medium"
                            >
                                Verification code
                            </label>

                            <input
                                id="verificationCode"
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
                            type="button"
                            onClick={handleVerify}
                            disabled={
                                verificationCode.length !== 6 ||
                                isVerifying
                            }
                            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isVerifying
                                ? "Verifying..."
                                : "Verify and Enable 2FA"}
                        </button>
                        <button type="button" onClick={handleCancelSetup} disabled={isManaging || isVerifying}
                            className="ml-3 rounded border px-5 py-3">Cancel setup</button>
                    </div>

                    <p
                        role="status"
                        className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
                    >
                        Two-factor authentication is not active yet.
                        Verify your authenticator code to complete setup.
                    </p>
                </div>
            )}
        </div>
    );
}
