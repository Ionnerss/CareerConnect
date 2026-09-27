"use client";
import { useState } from "react";
import { logout } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
    const[isSubmitting, setIsSubmitting] = useState(false);
    const[formError, setFormError] = useState<string | null>(null);

    async function handleLogout() {
        if (isSubmitting) { return; }
        setFormError(null);
        setIsSubmitting(true);
        try {
            const result = await logout();
            if (result?.error) {
                setFormError(result.error);
            }
        } catch {
            setFormError("An unexpected error occurred. Please try again.");
        }
        finally {
            setIsSubmitting(false);
        }
    }
    return (
        <div>
            <Button type="button" onClick={handleLogout} disabled={isSubmitting}>
                {isSubmitting ? "Logging out..." : "Log out"}
            </Button>
            {formError && (
                <p role="alert">{formError}</p>
            )}
        </div>
    );
}