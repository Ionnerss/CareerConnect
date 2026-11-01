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
            isVerified ||
            enrollmentData
        ) {
            return;
        }

        setErrorMessage(null);
        setIsEnrolling(true);

        try {
            const supabase = createClient();

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
            isVerifying ||
            isVerified
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
            ) : isVerified ? (
                /* MFA already enabled */
                <div
                    role="status"
                    className="space-y-3 rounded-lg border border-green-300 bg-green-50 p-6"
                >
                    <h3 className="text-xl font-semibold text-green-800">
                        Two-Factor Authentication Enabled
                    </h3>

                    <p className="text-sm text-green-700">
                        Your account has a verified authenticator.
                        Two-factor authentication is enabled.
                    </p>

                    <p className="text-sm text-green-700">
                        Your authenticator will be required during login
                        once the MFA login challenge is implemented.
                    </p>
                </div>
            ) : !enrollmentData ? (
                /* No verified MFA factor */
                <button
                    type="button"
                    onClick={handleEnroll}
                    disabled={isEnrolling}
                    className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isEnrolling
                        ? "Setting up..."
                        : "Enable Two-Factor Authentication"}
                </button>
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
                                isVerifying ||
                                isVerified
                            }
                            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isVerifying
                                ? "Verifying..."
                                : "Verify and Enable 2FA"}
                        </button>
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
