import { memo } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = generatePages(currentPage, totalPages);

  return (
    <div className={`flex items-center justify-center gap-1 mt-6 ${className}`}>
      {/* Previous button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`p-2 rounded-lg transition-colors ${
          currentPage === 1
            ? 'text-gray-300 cursor-not-allowed'
            : 'hover:bg-gray-100 text-gray-600'
        }`}
        aria-label="Página anterior"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Page numbers */}
      {pages.map((page, index) =>
        page === '...' ? (
          <span
            key={`ellipsis-${index}`}
            className="px-2 py-1 text-gray-400"
          >
            …
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page as number)}
            className={`min-w-[40px] h-10 rounded-lg font-medium text-sm transition-colors ${
              currentPage === page
                ? 'bg-gold text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {page}
          </button>
        )
      )}

      {/* Next button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`p-2 rounded-lg transition-colors ${
          currentPage === totalPages
            ? 'text-gray-300 cursor-not-allowed'
            : 'hover:bg-gray-100 text-gray-600'
        }`}
        aria-label="Página siguiente"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
});

/**
 * Generate page numbers with ellipsis for large page counts
 * Shows: 1, [...near current..., current-1, current, current+1, ...near current..., total]
 */
function generatePages(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];

  // Always show first page
  pages.push(1);

  if (current <= 4) {
    // Near start: 1, 2, 3, 4, 5, ..., total
    pages.push(2, 3, 4, 5);
    pages.push('...');
    pages.push(total);
  } else if (current >= total - 3) {
    // Near end: 1, ..., total-4, total-3, total-2, total-1, total
    pages.push('...');
    pages.push(total - 4, total - 3, total - 2, total - 1, total);
  } else {
    // Middle: 1, ..., current-1, current, current+1, ..., total
    pages.push('...');
    pages.push(current - 1, current, current + 1);
    pages.push('...');
    pages.push(total);
  }

  return pages;
}
