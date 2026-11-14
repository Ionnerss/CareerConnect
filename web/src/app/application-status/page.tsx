import { getUserApplications } from "@/lib/application_status/application_status_logic";
import ApplicationStatusClient from "./ApplicationStatusClient";
import { requireMfaForPage } from "@/lib/auth/require-mfa";

type ApplicationStatusPageProps = {
    searchParams: Promise<{ application?: string | string[] }>;
};

export default async function ApplicationStatusPage({ searchParams }: ApplicationStatusPageProps) {
    await requireMfaForPage();
    const applications = await getUserApplications();
    const { application } = await searchParams;
    const highlightId = typeof application === "string" ? application : undefined;

    return <ApplicationStatusClient applications={applications} highlightId={highlightId} />;
}
