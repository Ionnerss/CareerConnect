
"use client";

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
        <div className="flex items-center justify-between gap-4">
            <div className="flex flex-row flex-wrap gap-2 rounded-lg border p-2">
                {filters.map((filter) => (
                    <button
                        key={filter}
                        onClick={() => onStatusChange(filter)}
                        className={`rounded-lg border px-4 py-2 ${selectedStatus === filter
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                            }`}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            <div className="rounded-lg border p-2">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search by job title or company..."
                    className="w-64 text-sm outline-none"
                />
            </div>
        </div>
    );
}
