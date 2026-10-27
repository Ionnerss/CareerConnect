import { getUserApplications } from "@/lib/application_status/application_status_logic";
import ApplicationStatusClient from "./ApplicationStatusClient";

export default async function ApplicationStatusPage() {
    const applications = await getUserApplications();
    
    return <ApplicationStatusClient applications={applications} />;
}
