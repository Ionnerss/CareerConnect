
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

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

  const navigationButtonClass =
    "flex h-11 w-11 items-center justify-center rounded-xl " +
    "border border-[#E3E6EB] bg-white text-[#475569] " +
    "transition-all duration-200 hover:border-[#A6BAF5] " +
    "hover:bg-[#EEF2FF] hover:text-[#1D4ED8] " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 " +
    "disabled:cursor-not-allowed disabled:opacity-35 " +
    "disabled:hover:border-[#E3E6EB] disabled:hover:bg-white";

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-center gap-2"
    >
      {/* Previous page */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className={navigationButtonClass}
      >
        <ChevronLeft aria-hidden="true" className="h-5 w-5" />
      </button>

      {/* Page numbers */}
      {getPageNumbers().map((page, index) =>
        typeof page === "number" ? (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={currentPage === page ? "page" : undefined}
            className={`flex h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 ${
              currentPage === page
                ? "border-[#1D4ED8] bg-[#1D4ED8] text-white shadow-[0_4px_12px_-5px_rgba(29,78,216,0.55)]"
                : "border-[#E3E6EB] bg-white text-[#475569] hover:border-[#A6BAF5] hover:bg-[#EEF2FF] hover:text-[#1D4ED8]"
            }`}
          >
            {page}
          </button>
        ) : (
          <span
            key={`ellipsis-${index}`}
            aria-hidden="true"
            className="flex h-11 items-center justify-center px-1 text-sm font-semibold text-[#94A3B8]"
          >
            {page}
          </span>
        )
      )}

      {/* Next page */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className={navigationButtonClass}
      >
        <ChevronRight aria-hidden="true" className="h-5 w-5" />
      </button>
    </nav>
  );
}
