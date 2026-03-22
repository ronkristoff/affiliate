"use client";

import { useCallback, useMemo } from "react";
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import type { ColumnFilter } from "@/components/ui/table-filters/types";
import type { PaginationState } from "@/components/ui/DataTablePagination";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/DataTablePagination";

/**
 * Options for useDataTableUrlState hook
 */
export interface UseDataTableUrlStateOptions {
  /** Default page size (default: 20) */
  defaultPageSize?: number;
  /** Default sort field (optional) */
  defaultSortBy?: string;
  /** Default sort order (default: "desc") */
  defaultSortOrder?: "asc" | "desc";
  /** Initial column filters (optional) */
  initialFilters?: ColumnFilter[];
  /** Custom serialization for filter values */
  serializeFilter?: (filter: ColumnFilter) => string | null;
  /** Custom deserialization for filter values */
  deserializeFilter?: (key: string, value: string) => ColumnFilter | null;
}

/**
 * Return type for useDataTableUrlState hook
 */
export interface UseDataTableUrlStateReturn {
  // Pagination
  pagination: PaginationState;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setPagination: (pagination: PaginationState) => void;
  
  // Sorting
  sortBy: string | undefined;
  sortOrder: "asc" | "desc" | undefined;
  setSortBy: (sortBy: string | undefined) => void;
  setSortOrder: (sortOrder: "asc" | "desc" | undefined) => void;
  setSorting: (sortBy: string | undefined, sortOrder: "asc" | "desc" | undefined) => void;
  toggleSort: (field: string) => void;
  
  // Filtering
  filters: ColumnFilter[];
  setFilters: (filters: ColumnFilter[]) => void;
  setFilter: (filter: ColumnFilter) => void;
  removeFilter: (columnKey: string) => void;
  clearFilters: () => void;
  
  // Reset
  reset: () => void;
}

/**
 * Hook for managing data table state in URL via nuqs.
 * Provides URL-based persistence for pagination, sorting, and filtering.
 * 
 * @example
 * ```tsx
 * function MyTablePage() {
 *   const {
 *     pagination,
 *     sortBy,
 *     sortOrder,
 *     filters,
 *     setPage,
 *     toggleSort,
 *     setFilter,
 *   } = useDataTableUrlState({ defaultPageSize: 20 });
 * 
 *   // Use with DataTable
 *   return (
 *     <DataTable
 *       data={data}
 *       pagination={pagination}
 *       total={total}
 *       onPaginationChange={setPagination}
 *       sortBy={sortBy}
 *       sortOrder={sortOrder}
 *       onSortChange={toggleSort}
 *       activeFilters={filters}
 *       onFilterChange={setFilters}
 *     />
 *   );
 * }
 * ```
 */
export function useDataTableUrlState(
  options: UseDataTableUrlStateOptions = {}
): UseDataTableUrlStateReturn {
  const {
    defaultPageSize = DEFAULT_PAGE_SIZE,
    defaultSortBy,
    defaultSortOrder = "desc",
    initialFilters = [],
  } = options;

  // URL state parsers
  const parsers = useMemo(() => ({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(defaultPageSize),
    sortBy: parseAsString.withDefault(defaultSortBy ?? ""),
    sortOrder: parseAsStringLiteral(["asc", "desc"]).withDefault(defaultSortOrder),
    // Store filters as JSON string in URL
    filters: parseAsString.withDefault(""),
  }), [defaultPageSize, defaultSortBy, defaultSortOrder]);

  // Query states from URL
  const [urlState, setUrlState] = useQueryStates(parsers);

  // Pagination
  const pagination = useMemo<PaginationState>(() => ({
    page: urlState.page ?? 1,
    pageSize: urlState.pageSize ?? defaultPageSize,
  }), [urlState.page, urlState.pageSize, defaultPageSize]);

  const setPage = useCallback((page: number) => {
    setUrlState({ page });
  }, [setUrlState]);

  const setPageSize = useCallback((pageSize: number) => {
    // Reset to page 1 when changing page size
    setUrlState({ pageSize, page: 1 });
  }, [setUrlState]);

  const setPagination = useCallback((newPagination: PaginationState) => {
    setUrlState({
      page: newPagination.page,
      pageSize: newPagination.pageSize,
    });
  }, [setUrlState]);

  // Sorting
  const sortBy = urlState.sortBy || undefined;
  const sortOrder = urlState.sortOrder || undefined;

  const setSortBy = useCallback((newSortBy: string | undefined) => {
    setUrlState({ sortBy: newSortBy ?? "" });
  }, [setUrlState]);

  const setSortOrder = useCallback((newSortOrder: "asc" | "desc" | undefined) => {
    setUrlState({ sortOrder: newSortOrder ?? defaultSortOrder });
  }, [setUrlState, defaultSortOrder]);

  const setSorting = useCallback((
    newSortBy: string | undefined,
    newSortOrder: "asc" | "desc" | undefined
  ) => {
    setUrlState({
      sortBy: newSortBy ?? "",
      sortOrder: newSortOrder ?? defaultSortOrder,
    });
  }, [setUrlState, defaultSortOrder]);

  const toggleSort = useCallback((field: string) => {
    if (sortBy === field) {
      // Toggle direction or clear if already sorted by this field
      const newOrder = sortOrder === "asc" ? "desc" : "asc";
      setUrlState({ sortOrder: newOrder });
    } else {
      // New field - default to desc
      setUrlState({ sortBy: field, sortOrder: defaultSortOrder });
    }
  }, [sortBy, sortOrder, defaultSortOrder, setUrlState]);

  // Filtering
  const filters = useMemo<ColumnFilter[]>(() => {
    try {
      if (!urlState.filters) return initialFilters;
      const parsed = JSON.parse(urlState.filters);
      return Array.isArray(parsed) ? parsed : initialFilters;
    } catch {
      return initialFilters;
    }
  }, [urlState.filters, initialFilters]);

  const setFilters = useCallback((newFilters: ColumnFilter[]) => {
    setUrlState({ filters: JSON.stringify(newFilters) });
  }, [setUrlState]);

  const setFilter = useCallback((filter: ColumnFilter) => {
    const newFilters = filters.filter(f => f.columnKey !== filter.columnKey);
    if (filter.value || (filter.values && filter.values.length > 0) || 
        filter.min !== null || filter.max !== null ||
        filter.after !== null || filter.before !== null) {
      newFilters.push(filter);
    }
    setUrlState({ filters: JSON.stringify(newFilters), page: 1 });
  }, [filters, setUrlState]);

  const removeFilter = useCallback((columnKey: string) => {
    const newFilters = filters.filter(f => f.columnKey !== columnKey);
    setUrlState({ filters: JSON.stringify(newFilters), page: 1 });
  }, [filters, setUrlState]);

  const clearFilters = useCallback(() => {
    setUrlState({ filters: "", page: 1 });
  }, [setUrlState]);

  // Reset all state to defaults
  const reset = useCallback(() => {
    setUrlState({
      page: 1,
      pageSize: defaultPageSize,
      sortBy: defaultSortBy ?? "",
      sortOrder: defaultSortOrder,
      filters: "",
    });
  }, [setUrlState, defaultPageSize, defaultSortBy, defaultSortOrder]);

  return {
    // Pagination
    pagination,
    setPage,
    setPageSize,
    setPagination,
    
    // Sorting
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    setSorting,
    toggleSort,
    
    // Filtering
    filters,
    setFilters,
    setFilter,
    removeFilter,
    clearFilters,
    
    // Reset
    reset,
  };
}

/**
 * Hook for extracting only pagination state from URL.
 * Use when sorting/filtering is handled differently.
 */
export function usePaginationUrlState(defaultPageSize: number = DEFAULT_PAGE_SIZE) {
  const [state, setState] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(defaultPageSize),
  });

  const pagination = useMemo<PaginationState>(() => ({
    page: state.page ?? 1,
    pageSize: state.pageSize ?? defaultPageSize,
  }), [state.page, state.pageSize, defaultPageSize]);

  const setPage = useCallback((page: number) => {
    setState({ page });
  }, [setState]);

  const setPageSize = useCallback((pageSize: number) => {
    setState({ pageSize, page: 1 });
  }, [setState]);

  const setPagination = useCallback((newPagination: PaginationState) => {
    setState({
      page: newPagination.page,
      pageSize: newPagination.pageSize,
    });
  }, [setState]);

  return {
    pagination,
    setPage,
    setPageSize,
    setPagination,
  };
}
