"use client";

import { useState, useEffect } from "react";
import { ResumeCard } from "@/components/resume/resume_card";
import Pagination from "@/components/pagination/pagination";
import type { ResumeCardData } from "@/lib/resumes/resume_logic";

type ResumeListClientProps = {
    resumes: ResumeCardData[];
};

export default function ResumeListClient({ resumes }: ResumeListClientProps) {
    const [selectedTab, setSelectedTab] = useState<"active" | "archived">("active");
    const [selectedPageNum, setSelectedPageNum] = useState(1);

    const filteredResumes = resumes.filter((resume) =>
        selectedTab === "active"
            ? resume.archived_at === null
            : resume.archived_at !== null
    );

    const resumesPerPage = 6;
    const totalPages = Math.ceil(filteredResumes.length / resumesPerPage);

    const currentPage = Math.min(selectedPageNum, Math.max(1, totalPages));

    const startIndex = (currentPage - 1) * resumesPerPage;

    const currentResumes = filteredResumes.slice(
        startIndex,
        startIndex + resumesPerPage
    );

    useEffect(() => {
        setSelectedPageNum(1);
    }, [selectedTab]);

    return (
        <div className="flex w-full flex-col items-center gap-4">
            <div className="flex gap-2 self-start">
                <button
                    type="button"
                    onClick={() => setSelectedTab("active")}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                        selectedTab === "active"
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                >
                    Active
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedTab("archived")}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                        selectedTab === "archived"
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                >
                    Archived
                </button>
            </div>

            {filteredResumes.length === 0 ? (
                <p className="py-12 text-center text-gray-500">
                    No {selectedTab} resumes found.
                </p>
            ) : (
                <>
                    <div className="flex w-full flex-col gap-3">
                        {currentResumes.map((resume) => (
                            <ResumeCard key={resume.id} resume={resume} />
                        ))}
                    </div>

                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setSelectedPageNum}
                    />
                </>
            )}
        </div>
    );
}