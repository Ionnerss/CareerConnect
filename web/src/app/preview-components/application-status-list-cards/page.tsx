
import ApplicationList from "@/components/job-applications/ApplicationList";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";

export default function PreviewApplicationListPage() {
    // const applications: ApplicationCardData[] = []; // Just testing to see condition about having no job application....

    const applications: ApplicationCardData[] = Array.from( //Just manual testing... Not linked to database
        { length: 43 },
        (_, index) => ({
            id: String(index + 1),
            status: ["In Progress", "Accepted", "Rejected", "Interview"][index % 4],
            created_at: `October ${((index % 28) + 1)}, 2026`,
            job: {
                title: [
                    "Software Developer",
                    "Software QA Analyst",
                    "Frontend Developer",
                    "Backend Developer",
                    "Full Stack Developer",
                    "Data Analyst",
                    "DevOps Engineer",
                ][index % 7],
                firm_name: [
                    "Concordia",
                    "Google",
                    "Microsoft",
                    "Shopify",
                    "Ubisoft",
                    "Amazon",
                    "Desjardins",
                ][index % 7],
                location: index % 2 === 0 ? "Montreal" : "Laval",
                recruiter_name: [
                    "Jake",
                    "Alex",
                    "Sarah",
                    "Michael",
                    "Emily",
                    "Daniel",
                    "Olivia",
                ][index % 7],
            },
        })
    );


    return (
        <main className="flex min-h-screen items-center justify-center p-8">
            <div className="w-full max-w-5xl">
                <ApplicationList applications={applications} />
            </div>
        </main>
    );

}
