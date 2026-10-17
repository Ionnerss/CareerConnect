import Link from "next/link";
import { ApplicationCard } from "@/components/job-applications/ApplicationCard";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";
import { buttonVariants } from "@/components/ui/button";

type RecentApplicationsProps = {
    applications: ApplicationCardData[];
};

export default function RecentApplications({
    applications,
}: RecentApplicationsProps) {
    const recentApplications = applications.slice(0, 3);

    return (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 rounded-lg border p-5">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold">
                        Recent Applications
                    </h2>

                    <Link
                        href="/application-status"
                        className={buttonVariants({ size: "lg" })}
                    >
                        View All Applications →
                    </Link>
                </div>

                {recentApplications.length > 0 ? (
                    <div className="flex flex-col items-center gap-3">
                        {recentApplications.map((application) => (
                            <div
                                key={application.id}
                                className="flex w-full justify-center"
                            >
                                <ApplicationCard application={application} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-sm text-gray-500">
                        You haven&apos;t applied to any jobs yet.
                    </p>
                )}
            </div>
    );
}