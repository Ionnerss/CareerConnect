
"use client";

import { useState } from "react";
import { ResumeCard } from "@/components/resume/resume_card";
import Pagination from "@/components/pagination/pagination";
import type { ResumeCardData } from "@/lib/resumes/resume_logic";

type ResumeListClientProps = {
    resumes: ResumeCardData[];
};

export default function ResumeListClient({resumes}: ResumeListClientProps) {
    const [selectedPageNum, setSelectedPageNum] = useState(1);

    const resumesPerPage = 6;
    const totalPages = Math.ceil(resumes.length / resumesPerPage);

    const currentPage = Math.min(
        selectedPageNum,
        Math.max(1, totalPages)
    );

    const startIndex = (currentPage - 1) * resumesPerPage;

    const currentResumes = resumes.slice(
        startIndex,
        startIndex + resumesPerPage
    );

    if (resumes.length === 0) {
        return (
            <p className="py-12 text-center text-gray-500">
                No resumes found.
            </p>
        );
    }

    return (
        <div className="flex w-full flex-col items-center gap-4">
            <div className="flex w-full flex-col gap-3">
                {currentResumes.map((resume) => (
                    <ResumeCard
                        key={resume.id}
                        resume={resume}
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
