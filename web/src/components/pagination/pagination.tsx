
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
                className="rounded-md border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
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
                        className={`rounded-md border px-3 py-2 ${
                            currentPage === page
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
                className="rounded-md border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
                &gt;
            </button>
        </nav>
    );
}
