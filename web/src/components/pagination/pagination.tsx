
"use client";

type PaginationProps = {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
};

export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
}: PaginationProps) {
    if (totalPages <= 1) {
        return null;
    }

    const getPageNumbers = (): (number | string)[] => {
        const pages: (number | string)[] = [1];

        if (currentPage > 3) {
            pages.push("...");
        }

        const startPage = Math.max(2, currentPage - 1);
        const endPage = Math.min(totalPages - 1, currentPage + 1);

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
        <nav
            aria-label="Pagination"
            className="mt-4 flex flex-wrap items-center justify-center gap-2"
        >
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="min-h-10 min-w-10 rounded-xl border border-[#E3E6EB] bg-white px-3 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#F1F2F4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-40"
            >
                &lt;
            </button>

            {getPageNumbers().map((page, index) =>
                typeof page === "number" ? (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        aria-current={
                            currentPage === page ? "page" : undefined
                        }
                        className={`min-h-10 min-w-10 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                            currentPage === page
                                ? "border-[#0E1726] bg-[#0E1726] text-white"
                                : "border-[#E3E6EB] bg-white text-[#374151] hover:bg-[#F1F2F4]"
                        }`}
                    >
                        {page}
                    </button>
                ) : (
                    <span
                        key={`ellipsis-${index}`}
                        className="px-1"
                        aria-hidden="true"
                    >
                        {page}
                    </span>
                )
            )}

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="min-h-10 min-w-10 rounded-xl border border-[#E3E6EB] bg-white px-3 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#F1F2F4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-40"
            >
                &gt;
            </button>
        </nav>
    );
}
