"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { ApplicationStatusCountUI } from "@/components/job-applications/ApplicationStatusCountUI";
import { ApplicationFilters } from "@/components/job-applications/ApplicationFilters";
import ApplicationList from "@/components/job-applications/ApplicationList";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";
import { PageBody, PageHero } from "@/components/app/page-hero";
import ApplicationStatusRealtime from "@/lib/application_status/change-status-real-time";

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
        <main>
            <ApplicationStatusRealtime />
            <PageHero
                label="Applications"
                title="Your applications"
                description="Every application and its latest status, in one place."
                action={
                    <Link
                        href="/application-status/analytics"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-[#A9C1FF] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B93FF]"
                    >
                        <BarChart3 aria-hidden="true" className="size-4" />
                        View analytics
                    </Link>
                }
            />

            <PageBody>
                <div className="flex w-full flex-col gap-4">
                    <ApplicationStatusCountUI status_count={counts} />

                    <ApplicationFilters
                        selectedStatus={selectedStatus}
                        onStatusChange={setSelectedStatus}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                    />

                    <ApplicationList applications={filteredApplications} />
                </div>
            </PageBody>
        </main>
    );
}
