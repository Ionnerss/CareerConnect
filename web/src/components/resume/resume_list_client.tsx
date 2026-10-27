"use client";

import { useState } from "react";
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


    return (
        <div className="flex w-full flex-col items-center gap-4">
            <div className="flex gap-2 self-start">
                <button
                    type="button"
                    onClick={() => {
                        setSelectedTab("active");
                        setSelectedPageNum(1);
                    }}
                    className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${selectedTab === "active"
                        ? "bg-[#0E1726] text-white"
                        : "bg-[#F1F2F4] text-[#374151] hover:bg-[#E3E6EB]"
                        }`}
                >
                    Active
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSelectedTab("archived");
                        setSelectedPageNum(1);
                    }}
                    className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${selectedTab === "archived"
                        ? "bg-[#0E1726] text-white"
                        : "bg-[#F1F2F4] text-[#374151] hover:bg-[#E3E6EB]"
                        }`}
                >
                    Archived
                </button>
            </div>

            {filteredResumes.length === 0 ? (
                <p className="w-full rounded-2xl border border-[#E3E6EB] bg-white py-12 text-center text-[#4B5563]">
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