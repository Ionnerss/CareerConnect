"use client";

import { useMemo, useState } from "react";
import { ApplicationStatusCountUI } from "@/components/job-applications/ApplicationStatusCountUI";
import { ApplicationFilters } from "@/components/job-applications/ApplicationFilters";
import ApplicationList from "@/components/job-applications/ApplicationList";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";


type applicationProps = {
    applications: ApplicationCardData[];
};

export default function ApplicationStatusClient({ applications }: applicationProps) {
    const [selectedStatus, setSelectedStatus] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredApplications = useMemo(() => {
        return applications.filter((application) => {
            const status = application.status ?? "";

            const matchesStatus =
                selectedStatus === "All" ||
                (selectedStatus === "Interviews" && status === "Interview") ||
                (selectedStatus === "Offers" && status === "Accepted") ||
                status === selectedStatus;

            const query = searchQuery.trim().toLowerCase();
            const title = application.job?.title ?? "";
            const company = application.job?.firm_name ?? "";

            const matchesSearch =
                title.toLowerCase().includes(query) ||
                company.toLowerCase().includes(query);

            return matchesStatus && matchesSearch;
        });
    }, [applications, selectedStatus, searchQuery]);

    const counts = useMemo(() => ({
        total: applications.length,
        inProgress: applications.filter(
            (application) => application.status === "In Progress"
        ).length,
        interview: applications.filter(
            (application) => application.status === "Interview"
        ).length,
        offer: applications.filter(
            (application) => application.status === "Accepted"
        ).length,
        rejected: applications.filter(
            (application) => application.status === "Rejected"
        ).length,
    }), [applications]);

    return (
        <main className="min-h-screen px-8 pt-4 pb-8">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                   <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
                    Back to Dashboard
                    </Link>
                <ApplicationStatusCountUI status_count={counts} />

                <ApplicationFilters
                    selectedStatus={selectedStatus}
                    onStatusChange={setSelectedStatus}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />

                <ApplicationList applications={filteredApplications} />
            </div>
        </main>
    );
}
