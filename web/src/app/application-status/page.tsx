import { getUserApplications } from "@/lib/application_status/application_status_logic";
import ApplicationStatusClient from "./ApplicationStatusClient";
import { requireMfaForPage } from "@/lib/auth/require-mfa";

export default async function ApplicationStatusPage() {
    await requireMfaForPage();
    const applications = await getUserApplications();
    
    return <ApplicationStatusClient applications={applications} />;
}
