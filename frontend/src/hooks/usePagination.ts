import { useState, useCallback, useMemo } from 'react';

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface UsePaginationOptions<T> {
  fetchFn: (page: number) => Promise<PaginatedResponse<T>>;
  pageSize?: number;
  initialPage?: number;
}

export function usePagination<T>({
  fetchFn,
  pageSize = 20,
  initialPage = 1,
}: UsePaginationOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    return Math.ceil(totalCount / pageSize) || 1;
  }, [totalCount, pageSize]);

  const fetchPage = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFn(page);
      setData(response.results);
      setTotalCount(response.count);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  const changePage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchPage(page);
    }
  }, [fetchPage, totalPages]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      changePage(currentPage + 1);
    }
  }, [currentPage, totalPages, changePage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      changePage(currentPage - 1);
    }
  }, [currentPage, changePage]);

  return {
    data,
    setData,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    loading,
    error,
    changePage,
    nextPage,
    prevPage,
    fetchPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}
