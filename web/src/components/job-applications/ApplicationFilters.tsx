
"use client";

import { Search } from "lucide-react";

type ApplicationFiltersProps = {
    selectedStatus: string;
    onStatusChange: (status: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
};

export function ApplicationFilters({
    selectedStatus,
    onStatusChange,
    searchQuery,
    onSearchChange,
}: ApplicationFiltersProps) {
    const filters = [
        "All",
        "In Progress",
        "Interviews",
        "Offers",
        "Rejected",
    ];

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E3E6EB] bg-white p-3">
            <div role="group" aria-label="Filter by status" className="flex flex-row flex-wrap gap-2">
                {filters.map((filter) => (
                    <button
                        key={filter}
                        type="button"
                        onClick={() => onStatusChange(filter)}
                        aria-pressed={selectedStatus === filter}
                        className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${selectedStatus === filter
                            ? "bg-[#0E1726] text-white"
                            : "bg-[#F1F2F4] text-[#374151] hover:bg-[#E3E6EB]"
                            }`}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            <label className="flex min-h-10 w-full items-center gap-2 rounded-xl bg-[#F5F6F8] px-3 sm:w-72">
                <Search aria-hidden="true" className="size-4 shrink-0 text-[#4B5563]" />
                <span className="sr-only">Search applications</span>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search by job title or company..."
                    className="w-full bg-transparent text-sm text-[#0E1726] outline-none placeholder:text-[#6B7280]"
                />
            </label>
        </div>
    );
}
