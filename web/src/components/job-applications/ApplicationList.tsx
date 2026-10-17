"use client";

import { useState } from "react";
import { ApplicationCard } from "@/components/job-applications/ApplicationCard";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";

type ApplicationListProps = {
    applications: ApplicationCardData[];
};

export default function ApplicationList({
    applications,
}: ApplicationListProps) {
    const [selectedPageNum, setSelectedPageNum] = useState(1);

    const applicationsPerPage = 6;
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

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];

        if (totalPages === 0) {
            return pages;
        }

        pages.push(1);

        if (currentPage > 3) {
            pages.push("...");
        }

        const startPage = Math.max(2, currentPage - 1);
        const endPage = Math.min(
            totalPages - 1,
            currentPage + 1
        );

        for (let page = startPage; page <= endPage; page++) {
            pages.push(page);
        }

        if (currentPage < totalPages - 2) {
            pages.push("...");
        }

        if (totalPages > 1) {
            pages.push(totalPages);
        }

        return pages;
    };

    return (
        <div className="flex flex-col items-center gap-4">
            {applications.length === 0 ? (
                <p className="py-12 text-center text-gray-500">
                    No applications match your filters.
                </p>
            ) : (
                <>
                    <div className="flex w-full flex-col gap-3">
                        {currentApplications.map((application) => (
                            <ApplicationCard
                                key={application.id}
                                application={application}
                            />
                        ))}
                    </div>

                    {totalPages >= 1 && (
                        <div className="mt-4 flex items-center justify-center gap-2">
                            <button
                                onClick={() =>
                                    setSelectedPageNum(currentPage - 1)
                                }
                                disabled={currentPage === 1}
                                className="rounded-md border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                &lt;
                            </button>

                            {getPageNumbers().map((page, index) =>
                                typeof page === "number" ? (
                                    <button
                                        key={page}
                                        onClick={() => setSelectedPageNum(page)}
                                        aria-current={
                                            currentPage === page
                                                ? "page"
                                                : undefined
                                        }
                                        className={`rounded-md border px-3 py-2 ${currentPage === page
                                                ? "border-blue-600 bg-blue-600 text-white"
                                                : "border-gray-300 hover:bg-gray-100"
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ) : (
                                    <span
                                        key={`ellipsis-${index}`}
                                        className="px-1"
                                    >
                                        {page}
                                    </span>
                                )
                            )}

                            <button
                                onClick={() =>
                                    setSelectedPageNum(currentPage + 1)
                                }
                                disabled={currentPage === totalPages}
                                className="rounded-md border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                &gt;
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}