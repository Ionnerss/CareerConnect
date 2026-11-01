import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMfaStatus } from "@/lib/auth/mfa";


export type MfaActionErrorCode =
  | "UNAUTHENTICATED"
  | "MFA_REQUIRED"
  | "AUTH_UNAVAILABLE";

export class MfaActionError extends Error {
  constructor(
    public readonly code: MfaActionErrorCode,
    message: string
  ) {
    super(message);
    this.name = "MfaActionError";
  }
}

async function checkProtectedSession() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      state: "unauthenticated" as const,
    };
  }

  try {
    const mfa = await getMfaStatus();

    if (
      mfa.status === "authenticated" &&
      mfa.accessAllowed === true
    ) {
      return {
        state: "allowed" as const,
        supabase,
        user,
      };
    }

    if (mfa.status === "mfa_required") {
      return {
        state: "mfa_required" as const,
      };
    }

    return {
      state: "unavailable" as const,
    };
  } catch {
    // Never grant access when assurance verification fails.
    return {
      state: "unavailable" as const,
    };
  }
}

/**
 * For protected Server Components and pages.
 * Redirects to MFA only when a challenge is required.
 */
export async function requireMfaForPage() {
  const result = await checkProtectedSession();

  if (result.state === "unauthenticated") {
    redirect("/auth/login");
  }

  if (result.state === "mfa_required") {
    redirect("/auth/mfa");
  }

  if (result.state !== "allowed") {
    throw new Error(
      "Unable to verify your authentication security level."
    );
  }

  return {
    supabase: result.supabase,
    user: result.user,
  };
}

/**
 * For Server Actions and sensitive data operations.
 * Rejects requests without an authorized MFA session.
 */

export async function requireMfaForAction() {
  const result = await checkProtectedSession();

  if (result.state === "unauthenticated") {
    throw new MfaActionError(
      "UNAUTHENTICATED",
      "Authentication required."
    );
  }

  if (result.state === "mfa_required") {
    throw new MfaActionError(
      "MFA_REQUIRED",
      "Complete two-factor authentication to continue."
    );
  }

  if (result.state !== "allowed") {
    throw new MfaActionError(
      "AUTH_UNAVAILABLE",
      "Unable to verify your authentication security level."
    );
  }

  return {
    supabase: result.supabase,
    user: result.user,
  };
}

