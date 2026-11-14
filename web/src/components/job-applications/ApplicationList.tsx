
"use client";

import { useState } from "react";
import { ApplicationCard } from "@/components/job-applications/ApplicationCard";
import Pagination from "@/components/pagination/pagination";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";

type ApplicationListProps = {
    applications: ApplicationCardData[];
    /** Application opened from a notification: start on the page that shows it. */
    highlightId?: string;
};

const applicationsPerPage = 6;

export function getPageForApplication(
    applications: ApplicationCardData[],
    applicationId: string | undefined,
): number {
    if (!applicationId) return 1;

    const index = applications.findIndex((application) => application.id === applicationId);

    return index < 0 ? 1 : Math.floor(index / applicationsPerPage) + 1;
}

export default function ApplicationList({
    applications,
    highlightId,
}: ApplicationListProps) {
    const [selectedPageNum, setSelectedPageNum] = useState(() =>
        getPageForApplication(applications, highlightId)
    );
    const totalPages = Math.ceil(
        applications.length / applicationsPerPage
    );

    const currentPage = Math.min(
        selectedPageNum,
        Math.max(1, totalPages)
    );

    const startIndex = (currentPage - 1) * applicationsPerPage;

    const currentApplications = applications.slice(
        startIndex,
        startIndex + applicationsPerPage
    );

    if (applications.length === 0) {
        return (
            <p className="rounded-2xl border border-[#E3E6EB] bg-white py-12 text-center text-[#4B5563]">
                No applications match your filters.
            </p>
        );
    }

    return (
        <div className="flex w-full flex-col items-center gap-4">
            <div className="flex w-full flex-col gap-3">
                {currentApplications.map((application) => (
                    <ApplicationCard
                        key={application.id}
                        application={application}
                    />
                ))}
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setSelectedPageNum}
            />
        </div>
    );
}
