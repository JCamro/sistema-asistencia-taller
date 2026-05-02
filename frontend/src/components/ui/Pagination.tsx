import { memo } from 'react';
import { useWindowWidth } from '../../hooks/useWindowWidth';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount?: number;
  pageSize?: number;
}

export const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalCount,
  pageSize = 20,
}: PaginationProps) {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 768;

  if (totalPages <= 1) return null;

  const pages = generatePages(currentPage, totalPages);

  const startItem = totalCount ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = totalCount ? Math.min(currentPage * pageSize, totalCount) : 0;

  const btnBaseStyle: React.CSSProperties = {
    minWidth: '40px',
    height: '40px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    fontFamily: 'inherit',
    color: '#374151',
    transition: 'background 0.15s ease',
    outline: 'none',
  };

  const btnActiveStyle: React.CSSProperties = {
    ...btnBaseStyle,
    background: '#40E0D0',
    border: '1px solid #40E0D0',
    color: '#fff',
    fontWeight: '600',
    boxShadow: '0 1px 3px rgba(64,224,208,0.3)',
  };

  const btnDisabledStyle: React.CSSProperties = {
    ...btnBaseStyle,
    color: '#d1d5db',
    cursor: 'not-allowed',
    border: '1px solid #f3f4f6',
    background: '#f9fafb',
  };

  const arrowBtnStyle = (disabled: boolean): React.CSSProperties => ({
    ...btnBaseStyle,
    padding: '0 0.5rem',
    minWidth: '36px',
    ...(disabled ? btnDisabledStyle : {}),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
      {/* Summary text */}
      {totalCount !== undefined && (
        <div style={{ fontSize: '0.8125rem', color: '#6b7280', textAlign: 'center' }}>
          {isMobile
            ? `${startItem}-${endItem}/${totalCount}`
            : `Mostrando ${startItem}-${endItem} de ${totalCount}`}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={arrowBtnStyle(currentPage === 1)}
          aria-label="Página anterior"
          className="touch-target"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Page numbers */}
        {!isMobile && pages.map((page, index) =>
          page === '...' ? (
            <span
              key={`ellipsis-${index}`}
              style={{ padding: '0 0.25rem', color: '#9ca3af', fontSize: '0.875rem' }}
            >
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              style={currentPage === page ? btnActiveStyle : btnBaseStyle}
              className="touch-target"
            >
              {page}
            </button>
          )
        )}

        {/* Mobile: compact page indicator */}
        {isMobile && (
          <span style={{ padding: '0 0.5rem', fontSize: '0.8125rem', color: '#6b7280', fontWeight: '500' }}>
            {currentPage} / {totalPages}
          </span>
        )}

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={arrowBtnStyle(currentPage === totalPages)}
          aria-label="Página siguiente"
          className="touch-target"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
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
