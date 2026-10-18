import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export default function BackToDashboardButton() {
    return (
        <Link
            href="/dashboard"
            className={buttonVariants({ size: "lg" })}
        >
            Back to Dashboard
        </Link>
    );
}
