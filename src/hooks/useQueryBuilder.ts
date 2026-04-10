"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "in_list"
  | "is_null"
  | "is_not_null";

export type FilterLogic = "and" | "or";

export type JoinType = "inner" | "left";

export interface QueryConfig {
  tables: string[];
  columns: Array<{ table: string; column: string; alias?: string }>;
  filters: Array<{
    id: string;
    table: string;
    column: string;
    operator: FilterOperator;
    value?: string | number | boolean;
    valueTo?: string | number;
    values?: Array<string | number>;
  }>;
  filterLogic: FilterLogic;
  joins: Array<{
    id: string;
    leftTable: string;
    rightTable: string;
    leftField: string;
    rightField: string;
    joinType: JoinType;
  }>;
  aggregations: Array<{
    id: string;
    table: string;
    column: string;
    function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
    alias: string;
  }>;
  groupBy: Array<{ table: string; column: string }>;
  rowLimit: number;
}

export interface UseQueryBuilderOptions {
  /** Enable admin mode: defaults maxRowLimit to 500, disables URL sync */
  isAdminMode?: boolean;
  /** Optional tenantId for filtering (admin mode) */
  targetTenantId?: string;
  /** Fixed filters that persist across table changes */
  fixedFilters?: QueryConfig["filters"];
  /** Override the default row limit */
  maxRowLimit?: number;
}

export interface UseQueryBuilderReturn {
  config: QueryConfig;
  setConfig: (config: QueryConfig) => void;
  setTables: (tables: string[]) => void;
  addColumn: (table: string, column: string, alias?: string) => void;
  removeColumn: (table: string, column: string) => void;
  updateColumnAlias: (table: string, column: string, alias: string | undefined) => void;
  addFilter: (filter: QueryConfig["filters"][0]) => void;
  removeFilter: (id: string) => void;
  updateFilter: (id: string, updates: Partial<QueryConfig["filters"][0]>) => void;
  setFilterLogic: (logic: FilterLogic) => void;
  addJoin: (join: QueryConfig["joins"][0]) => void;
  removeJoin: (id: string) => void;
  addAggregation: (agg: QueryConfig["aggregations"][0]) => void;
  removeAggregation: (id: string) => void;
  setGroupBy: (groupBy: QueryConfig["groupBy"]) => void;
  setRowLimit: (limit: number) => void;
  resetConfig: () => void;
  loadConfig: (config: QueryConfig) => void;
  configJson: string;
  isDirty: boolean;
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

const EMPTY_CONFIG: QueryConfig = {
  tables: [],
  columns: [],
  filters: [],
  filterLogic: "and",
  joins: [],
  aggregations: [],
  groupBy: [],
  rowLimit: 100,
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function configToBase64(config: QueryConfig): string {
  try {
    const json = JSON.stringify(config);
    return btoa(encodeURIComponent(json));
  } catch {
    return "";
  }
}

function configFromBase64(encoded: string): QueryConfig | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const parsed = JSON.parse(json);
    // Backfill new fields for configs that don't have them yet
    return {
      filterLogic: parsed.filterLogic ?? "and",
      rowLimit: parsed.rowLimit ?? 100,
      ...parsed,
      joins: (parsed.joins ?? []).map((j: Record<string, unknown>) => ({
        joinType: j.joinType ?? "inner",
        ...j,
      })),
    } as QueryConfig;
  } catch {
    return null;
  }
}

export function useQueryBuilder(options?: UseQueryBuilderOptions): UseQueryBuilderReturn {
  const isAdminMode = options?.isAdminMode ?? false;
  const fixedFilters = options?.fixedFilters ?? [];
  const maxRowLimit = options?.maxRowLimit ?? (isAdminMode ? 500 : 100);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isInitialized = useRef(false);

  const [config, setConfigState] = useState<QueryConfig>(() => {
    if (isAdminMode) {
      // Admin mode: no URL sync, use defaults
      return { ...EMPTY_CONFIG, rowLimit: maxRowLimit, filters: [...fixedFilters] };
    }
    const q = searchParams.get("q");
    if (q) {
      const parsed = configFromBase64(q);
      if (parsed) return { ...parsed, rowLimit: maxRowLimit };
    }
    return { ...EMPTY_CONFIG, rowLimit: maxRowLimit };
  });

  // History state for undo/redo
  const [history, setHistory] = useState<{ past: QueryConfig[]; future: QueryConfig[] }>({
    past: [],
    future: [],
  });

  const initialConfigRef = useRef<QueryConfig>(config);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    const q = searchParams.get("q");
    if (q) {
      const parsed = configFromBase64(q);
      if (parsed) {
        setConfigState(parsed);
        initialConfigRef.current = parsed;
      }
    }
  }, [searchParams]);

  const syncToUrl = useCallback(
    (newConfig: QueryConfig) => {
      if (isAdminMode) return; // Admin queries are ephemeral — no URL sync
      const encoded = configToBase64(newConfig);
      const params = new URLSearchParams(searchParams.toString());
      if (encoded) {
        params.set("q", encoded);
      } else {
        params.delete("q");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname, isAdminMode]
  );

  const setConfig = useCallback(
    (newConfig: QueryConfig, { pushToHistory = true } = {}) => {
      if (pushToHistory) {
        setHistory((prev) => ({
          past: [...prev.past.slice(-19), config], // Keep last 20 states
          future: [], // Clear future on new action
        }));
      }
      setConfigState(newConfig);
      syncToUrl(newConfig);
    },
    [config, syncToUrl]
  );

  const setTables = useCallback(
    (tables: string[]) => {
      const filteredColumns = config.columns.filter((c) => tables.includes(c.table));
      const filteredFilters = [
        ...fixedFilters, // Preserve admin fixed filters
        ...config.filters.filter((f) => tables.includes(f.table) && !fixedFilters.some(ff => ff.id === f.id)),
      ];
      const filteredAggregations = config.aggregations.filter((a) => tables.includes(a.table));
      const filteredGroupBy = config.groupBy.filter((g) => tables.includes(g.table));
      setConfig({
        ...config,
        tables,
        columns: filteredColumns,
        filters: filteredFilters,
        aggregations: filteredAggregations,
        groupBy: filteredGroupBy,
      });
    },
    [config, setConfig, fixedFilters]
  );

  const addColumn = useCallback(
    (table: string, column: string, alias?: string) => {
      const exists = config.columns.some(
        (c) => c.table === table && c.column === column
      );
      if (exists) return;
      setConfig({
        ...config,
        columns: [...config.columns, { table, column, alias }],
      });
    },
    [config, setConfig]
  );

  const removeColumn = useCallback(
    (table: string, column: string) => {
      setConfig({
        ...config,
        columns: config.columns.filter(
          (c) => !(c.table === table && c.column === column)
        ),
      });
    },
    [config, setConfig]
  );

  const updateColumnAlias = useCallback(
    (table: string, column: string, alias: string | undefined) => {
      setConfig({
        ...config,
        columns: config.columns.map((c) =>
          c.table === table && c.column === column ? { ...c, alias } : c
        ),
      });
    },
    [config, setConfig]
  );

  const addFilter = useCallback(
    (filter: QueryConfig["filters"][0]) => {
      setConfig({ ...config, filters: [...config.filters, filter] });
    },
    [config, setConfig]
  );

  const removeFilter = useCallback(
    (id: string) => {
      setConfig({
        ...config,
        filters: config.filters.filter((f) => f.id !== id),
      });
    },
    [config, setConfig]
  );

  const updateFilter = useCallback(
    (id: string, updates: Partial<QueryConfig["filters"][0]>) => {
      setConfig({
        ...config,
        filters: config.filters.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      });
    },
    [config, setConfig]
  );

  const setFilterLogic = useCallback(
    (logic: FilterLogic) => {
      setConfig({ ...config, filterLogic: logic });
    },
    [config, setConfig]
  );

  const addJoin = useCallback(
    (join: QueryConfig["joins"][0]) => {
      setConfig({ ...config, joins: [...config.joins, join] });
    },
    [config, setConfig]
  );

  const removeJoin = useCallback(
    (id: string) => {
      setConfig({
        ...config,
        joins: config.joins.filter((j) => j.id !== id),
      });
    },
    [config, setConfig]
  );

  const addAggregation = useCallback(
    (agg: QueryConfig["aggregations"][0]) => {
      setConfig({
        ...config,
        aggregations: [...config.aggregations, agg],
      });
    },
    [config, setConfig]
  );

  const removeAggregation = useCallback(
    (id: string) => {
      setConfig({
        ...config,
        aggregations: config.aggregations.filter((a) => a.id !== id),
      });
    },
    [config, setConfig]
  );

  const setGroupBy = useCallback(
    (groupBy: QueryConfig["groupBy"]) => {
      setConfig({ ...config, groupBy });
    },
    [config, setConfig]
  );

  const setRowLimit = useCallback(
    (rowLimit: number) => {
      setConfig({ ...config, rowLimit });
    },
    [config, setConfig]
  );

  const resetConfig = useCallback(() => {
    const reset = { ...EMPTY_CONFIG, rowLimit: maxRowLimit, filters: [...fixedFilters] };
    initialConfigRef.current = reset;
    setConfig(reset);
  }, [setConfig, fixedFilters, maxRowLimit]);

  const loadConfig = useCallback(
    (newConfig: QueryConfig) => {
      // Backfill new fields for loaded configs (e.g., from saved queries or templates)
      const backfilled: QueryConfig = {
        ...newConfig,
        filterLogic: newConfig.filterLogic ?? "and",
        rowLimit: newConfig.rowLimit ?? 100,
        joins: (newConfig.joins ?? []).map((j) => ({
          ...j,
          joinType: j.joinType ?? "inner",
        })),
      };
      initialConfigRef.current = { ...backfilled };
      setConfig({ ...backfilled });
    },
    [setConfig]
  );

  const configJson = useMemo(() => JSON.stringify(config, null, 2), [config]);

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(initialConfigRef.current),
    [config]
  );

  // Undo/Redo functions
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;
    const previous = history.past[history.past.length - 1];
    setHistory((prev) => ({
      past: prev.past.slice(0, -1),
      future: [config, ...prev.future],
    }));
    setConfigState(previous);
    syncToUrl(previous);
  }, [canUndo, history.past, config, syncToUrl]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const next = history.future[0];
    setHistory((prev) => ({
      past: [...prev.past, config],
      future: prev.future.slice(1),
    }));
    setConfigState(next);
    syncToUrl(next);
  }, [canRedo, history.future, config, syncToUrl]);

  const clearHistory = useCallback(() => {
    setHistory({ past: [], future: [] });
  }, []);

  return {
    config,
    setConfig,
    setTables,
    addColumn,
    removeColumn,
    updateColumnAlias,
    addFilter,
    removeFilter,
    updateFilter,
    setFilterLogic,
    addJoin,
    removeJoin,
    addAggregation,
    removeAggregation,
    setGroupBy,
    setRowLimit,
    resetConfig,
    loadConfig,
    configJson,
    isDirty,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}

export { generateId, EMPTY_CONFIG };
