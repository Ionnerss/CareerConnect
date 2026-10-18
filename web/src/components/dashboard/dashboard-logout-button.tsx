"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { logout } from "@/app/auth/actions";

/** Log out button styled for the dashboard header. Same behaviour as LogoutButton. */
export default function DashboardLogoutButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleLogout() {
    if (isSubmitting) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = await logout();
      if (result?.error) setFormError(result.error);
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isSubmitting}
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#E3E6EB] bg-white px-3 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#F5F6F8] hover:text-[#0E1726] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] disabled:opacity-60"
      >
        <LogOut aria-hidden="true" className="size-4" />
        <span>{isSubmitting ? "Logging out..." : "Log out"}</span>
      </button>
      {formError && (
        <p
          role="alert"
          className="absolute right-0 top-full mt-2 w-60 rounded-lg border border-[#FCD9D9] bg-white p-2 text-xs text-[#9B1C1C] shadow-sm"
        >
          {formError}
        </p>
      )}
    </div>
  );
}
