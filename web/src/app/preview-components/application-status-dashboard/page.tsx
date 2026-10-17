import { getUserApplications } from "@/lib/application_status/application_status_logic";
import RecentApplications from "@/components/job-applications/RecentApplication";

export default async function PreviewApplicationStatusDashboard() {
    const applications = await getUserApplications();

    return (
    <RecentApplications applications={applications} />
    );
}
