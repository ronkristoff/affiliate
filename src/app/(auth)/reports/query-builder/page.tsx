"use client";

import { Suspense, useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQueryBuilder, type QueryConfig } from "@/hooks/useQueryBuilder";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/button";
import { AccordionSection } from "@/components/ui/accordion-section";
import { Badge } from "@/components/ui/badge";
import { QueryBuilderPageSkeleton } from "@/components/query-builder/skeletons";
import { TableSelector } from "@/components/query-builder/TableSelector";
import { ColumnSelector } from "@/components/query-builder/ColumnSelector";
import { FilterBuilder } from "@/components/query-builder/FilterBuilder";
import { JoinBuilder } from "@/components/query-builder/JoinBuilder";
import { AggregationBuilder } from "@/components/query-builder/AggregationBuilder";
import { ResultsTable } from "@/components/query-builder/ResultsTable";
import { SavedQueriesList } from "@/components/query-builder/SavedQueriesList";
import { TemplateGallery } from "@/components/query-builder/TemplateGallery";
import { WizardFlow } from "@/components/query-builder/WizardFlow";
import { SaveQueryDialog } from "@/components/query-builder/SaveQueryDialog";
import { ShareQueryDialog } from "@/components/query-builder/ShareQueryDialog";
import { QueryExportButton } from "@/components/query-builder/QueryExportButton";
import {
  Play,
  Save,
  Sparkles,
  Settings2,
  Database,
  Columns3,
  Filter,
  Link2,
  Sigma,
  Bookmark,
  LayoutTemplate,
  RotateCcw,
  ClipboardList,
  AlertCircle,
  Zap,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

type Mode = "wizard" | "advanced";

// ─── Query Health Score ───────────────────────────────────────────
type HealthStatus = "idle" | "ready" | "warning" | "error";

interface HealthCheck {
  status: HealthStatus;
  score: number; // 0-100
  issues: Array<{ level: "error" | "warning"; message: string }>;
}

function computeHealth(config: QueryConfig): HealthCheck {
  const issues: HealthCheck["issues"] = [];
  let score = 100;

  if (config.tables.length === 0) {
    return { status: "idle", score: 0, issues: [] };
  }

  // Must have columns
  if (config.columns.length === 0) {
    issues.push({ level: "error", message: "Select at least one column" });
    score -= 40;
  }

  // Aggregation + no GROUP BY + non-agg columns
  if (config.aggregations.length > 0 && config.groupBy.length === 0) {
    const aggAliases = new Set(config.aggregations.map((a) => a.alias));
    const nonAggCols = config.columns.filter((c) => !aggAliases.has(c.alias || c.column));
    if (nonAggCols.length > 0) {
      issues.push({ level: "error", message: "Add GROUP BY for per-category results" });
      score -= 30;
    } else {
      issues.push({ level: "warning", message: "No GROUP BY — returns 1 summary row" });
      score -= 5;
    }
  }

  // Multi-table without join
  if (config.tables.length >= 2) {
    const secondaryTables = new Set(
      config.columns.filter((c) => c.table !== config.tables[0]).map((c) => c.table)
    );
    const joinedTables = new Set(config.joins.flatMap((j) => [j.leftTable, j.rightTable]));
    const unjoined = [...secondaryTables].filter((t) => !joinedTables.has(t));
    if (unjoined.length > 0) {
      issues.push({ level: "error", message: `${unjoined.join(", ")} not joined` });
      score -= 25;
    }
  }

  // Duplicate aggregations
  const aggKeys = new Set(config.aggregations.map((a) => `${a.function}_${a.column}`));
  if (aggKeys.size < config.aggregations.length) {
    issues.push({ level: "warning", message: "Duplicate aggregation" });
    score -= 5;
  }

  // Column name collisions across tables
  const columnNames = config.columns.map((c) => c.column);
  const collisions = columnNames.filter((name, i) => columnNames.indexOf(name) !== i);
  const uniqueCollisions = [...new Set(collisions)];
  if (uniqueCollisions.length > 0) {
    issues.push({ level: "warning", message: `Column "${uniqueCollisions[0]}" exists in multiple tables` });
    score -= 10;
  }

  score = Math.max(0, score);
  const status: HealthStatus =
    issues.some((i) => i.level === "error") ? "error" :
    issues.some((i) => i.level === "warning") ? "warning" : "ready";

  return { status, score, issues };
}

function HealthIndicator({ health }: { health: HealthCheck }) {
  if (health.status === "idle") return null;

  const colors = {
    idle: "bg-gray-200 text-gray-500",
    ready: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    error: "bg-red-100 text-red-700",
  };
  const labels = {
    idle: "",
    ready: "Ready",
    warning: "Fix issues",
    error: "Issues found",
  };
  const icons = {
    idle: null,
    ready: <CheckCircle2 className="w-3 h-3" />,
    warning: <AlertTriangle className="w-3 h-3" />,
    error: <AlertCircle className="w-3 h-3" />,
  };

  const tooltipText = [
    `Health: ${health.score}/100`,
    ...health.issues.map((i) => `${i.level === "error" ? "•" : "◦"} ${i.message}`),
  ].join("\n");

  return (
    <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-help", colors[health.status])} title={tooltipText}>
      {icons[health.status]}
      {labels[health.status]}
    </div>
  );
}

// ─── Next Step Hints ──────────────────────────────────────────────
function NextStepHint({ config }: { config: QueryConfig }) {
  const hint = useMemo(() => {
    if (config.tables.length === 0) {
      return { text: "Start by selecting a table to query", icon: <Database className="w-4 h-4" /> };
    }
    if (config.columns.length === 0) {
      return { text: "Now pick the columns you want to see in your results", icon: <Columns3 className="w-4 h-4" /> };
    }
    if (config.tables.length >= 2) {
      const secondaryTables = new Set(config.columns.filter((c) => c.table !== config.tables[0]).map((c) => c.table));
      const joinedTables = new Set(config.joins.flatMap((j) => [j.leftTable, j.rightTable]));
      const unjoined = [...secondaryTables].filter((t) => !joinedTables.has(t));
      if (unjoined.length > 0) {
        return { text: `Add a join to connect ${unjoined.join(" and ")} to your data`, icon: <Link2 className="w-4 h-4" /> };
      }
    }
    if (config.aggregations.length > 0 && config.groupBy.length === 0) {
      return { text: "Add a GROUP BY column to see per-category results instead of a single total", icon: <Sigma className="w-4 h-4" /> };
    }
    return null;
  }, [config]);

  if (!hint) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#10409a]/5 border border-[#10409a]/10">
      <span className="text-[#10409a] shrink-0">{hint.icon}</span>
      <span className="text-[12px] text-[#10409a] flex-1">{hint.text}</span>
      <ArrowRight className="w-3.5 h-3.5 text-[#10409a]/50 shrink-0" />
    </div>
  );
}

// ─── Column Collision Warning ─────────────────────────────────────
function ColumnCollisionWarning({ config }: { config: QueryConfig }) {
  const collisions = useMemo(() => {
    const seen = new Map<string, string[]>(); // columnName -> [tableNames]
    for (const col of config.columns) {
      const existing = seen.get(col.column) ?? [];
      if (!existing.includes(col.table)) {
        seen.set(col.column, [...existing, col.table]);
      }
    }
    return [...seen.entries()].filter(([, tables]) => tables.length > 1);
  }, [config.columns]);

  if (collisions.length === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-amber-900">
          Column name collision detected
        </div>
        <p className="text-[12px] text-amber-800 mt-0.5">
          {collisions.map(([col, tables]) => (
            <span key={col}>
              <span className="font-semibold">{col}</span> exists in both {tables.join(" and ")}
              {collisions.indexOf([col, tables] as unknown as [string, string[]]) < collisions.length - 1 ? ". " : "."}
            </span>
          ))}
          {" "}Results may show ambiguous data. Consider using aliases to distinguish them.
        </p>
      </div>
    </div>
  );
}

// ─── Query Summary ───────────────────────────────────────────────────
function QuerySummary({ config, configJson }: { config: QueryConfig; configJson: string }) {
  const hasAnything =
    config.tables.length > 0 ||
    config.columns.length > 0 ||
    config.filters.length > 0 ||
    config.joins.length > 0 ||
    config.aggregations.length > 0 ||
    config.groupBy.length > 0;

  if (!hasAnything) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)]">
        <ClipboardList className="w-4 h-4 text-[#10409a]" />
        Query Summary
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {config.tables.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Tables
            </span>
            <div className="flex flex-wrap gap-1">
              {config.tables.map((t) => (
                <Badge key={t} variant="outline" className="text-[11px] font-mono">
                  <Database className="w-2.5 h-2.5 mr-1 opacity-50" />
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {config.columns.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Columns ({config.columns.length})
            </span>
            <div className="flex flex-wrap gap-1">
              {config.columns.map((c, i) => (
                <Badge key={`${c.table}.${c.column}-${i}`} variant="outline" className="text-[11px] font-mono">
                  <Columns3 className="w-2.5 h-2.5 mr-1 opacity-50" />
                  {c.alias || c.column}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {config.filters.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Filters ({config.filters.length} — {config.filterLogic === "and" ? "match all" : "match any"})
            </span>
            <div className="flex flex-wrap gap-1">
              {config.filters.map((f, i) => (
                <Badge key={f.id} variant="secondary" className="text-[11px] font-mono gap-0.5">
                  {i > 0 && (
                    <span className="text-[#1659d6] font-bold uppercase mr-0.5">{config.filterLogic}</span>
                  )}
                  <Filter className="w-2.5 h-2.5 opacity-50" />
                  {f.column}
                  <span className="text-[var(--text-muted)] mx-0.5">{f.operator}</span>
                  {f.value !== undefined && f.value !== "" && (
                    <span className="font-semibold">{String(f.value)}</span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {config.joins.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Joins ({config.joins.length}/3)
            </span>
            <div className="flex flex-wrap gap-1">
              {config.joins.map((j) => (
                <Badge key={j.id} variant="outline" className="text-[11px] font-mono gap-0.5">
                  <span className="text-[#1659d6] font-bold uppercase">{j.joinType || "inner"}</span>
                  <Link2 className="w-2.5 h-2.5 opacity-50" />
                  {j.leftTable}.{j.leftField}
                  <span className="text-[#1659d6] mx-0.5">=</span>
                  {j.rightTable}.{j.rightField}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {config.aggregations.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Aggregations ({config.aggregations.length})
            </span>
            <div className="flex flex-wrap gap-1">
              {config.aggregations.map((a) => (
                <Badge key={a.id} variant="brand" className="text-[11px] font-mono gap-0.5">
                  <Sigma className="w-2.5 h-2.5 opacity-50" />
                  {a.function}({a.column})
                  <span className="text-[var(--text-muted)] ml-0.5">as {a.alias}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {config.groupBy.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Group By ({config.groupBy.length})
            </span>
            <div className="flex flex-wrap gap-1">
              {config.groupBy.map((g, i) => (
                <Badge key={`${g.table}.${g.column}-${i}`} variant="outline" className="text-[11px] font-mono">
                  {g.column}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <details className="group">
        <summary className="text-[11px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-heading)] transition-colors select-none">
          Show raw JSON
        </summary>
        <pre className="mt-2 p-3 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-muted)] overflow-x-auto max-h-[200px] overflow-y-auto">
          {configJson}
        </pre>
      </details>
    </div>
  );
}

// ─── Missing Join Warning ─────────────────────────────────────────
function MissingJoinWarning({
  config,
  onApplyJoin,
}: {
  config: QueryConfig;
  onApplyJoin: (join: QueryConfig["joins"][0]) => void;
}) {
  const metadata = useQuery(api.queryBuilder.getTableMetadata);
  const suggestedJoins = metadata && !Array.isArray(metadata) ? metadata.suggestedJoins ?? [] : [];

  const primaryTable = config.tables[0];
  if (!primaryTable) return null;

  const secondaryTables = new Set(
    config.columns
      .filter((c) => c.table !== primaryTable)
      .map((c) => c.table)
  );

  for (const agg of config.aggregations) {
    if (agg.table !== primaryTable) secondaryTables.add(agg.table);
  }
  for (const g of config.groupBy) {
    if (g.table !== primaryTable) secondaryTables.add(g.table);
  }

  if (secondaryTables.size === 0) return null;

  const joinedTables = new Set(
    config.joins.flatMap((j) => [j.leftTable, j.rightTable])
  );
  const unjoinedTables = [...secondaryTables].filter((t) => !joinedTables.has(t));
  if (unjoinedTables.length === 0) return null;

  const relevantSuggestions = suggestedJoins.filter(
    (sj) =>
      secondaryTables.has(sj.leftTable) ||
      secondaryTables.has(sj.rightTable)
  );

  if (relevantSuggestions.length === 0) return null;

  const existingJoinKeys = new Set(
    config.joins.map((j) => `${j.leftTable}.${j.leftField}.${j.rightTable}.${j.rightField}`)
  );
  const actionableSuggestions = relevantSuggestions.filter(
    (sj) => !existingJoinKeys.has(`${sj.leftTable}.${sj.leftField}.${sj.rightTable}.${sj.rightField}`)
  );
  if (actionableSuggestions.length === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-amber-900">
          Tables selected but not joined
        </div>
        <p className="text-[12px] text-amber-800 mt-0.5">
          You selected columns from{" "}
          <span className="font-semibold">{unjoinedTables.join(", ")}</span>
          {" "}but didn't define a join. Results from those tables will be empty.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {actionableSuggestions.map((sj, i) => (
            <Button
              key={`${sj.leftTable}-${sj.rightTable}-${i}`}
              variant="outline"
              size="sm"
              onClick={() =>
                onApplyJoin({
                  id: `auto-${Date.now()}-${i}`,
                  leftTable: sj.leftTable,
                  rightTable: sj.rightTable,
                  leftField: sj.leftField,
                  rightField: sj.rightField,
                  joinType: "inner",
                })
              }
              className="h-7 text-[12px] gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100 hover:border-amber-400"
            >
              <Zap className="w-3 h-3" />
              {sj.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────
function QueryBuilderContent() {
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;

  const [mode, setMode] = useState<Mode>("wizard");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [shareDialogQueryId, setShareDialogQueryId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: number; end: number; preset?: string } | null>(null);

  const {
    config,
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
  } = useQueryBuilder();

  const queryArgs = {
    tables: config.tables,
    columns: config.columns,
    filters: config.filters.length > 0 ? config.filters : undefined,
    joins: config.joins.length > 0 ? config.joins : undefined,
    aggregations: config.aggregations.length > 0 ? config.aggregations : undefined,
    groupBy: config.groupBy.length > 0 ? config.groupBy : undefined,
    dateRange: dateRange ? { start: dateRange.start, end: dateRange.end } : undefined,
  };

  const hasValidConfig =
    config.tables.length > 0 && config.columns.length > 0;

  const health = useMemo(() => computeHealth(config), [config]);

  const [hasRunQuery, setHasRunQuery] = useState(false);

  const results = useQuery(
    api.queryBuilder.executeQuery,
    hasRunQuery && hasValidConfig
      ? queryArgs
      : "skip"
  );

  const handleRunQuery = () => {
    if (!hasValidConfig) {
      toast.error("Select at least one table and column");
      return;
    }
    if (config.aggregations.length > 0 && config.groupBy.length === 0) {
      const aggAliases = new Set(config.aggregations.map((a) => a.alias));
      const nonAggColumns = config.columns.filter(
        (c) => !aggAliases.has(c.alias || c.column)
      );
      if (nonAggColumns.length > 0) {
        toast.error("Add a GROUP BY column to see per-category results", {
          description:
            "You have aggregations (SUM, COUNT…) but no GROUP BY. Without it, only 1 summary row is returned and other columns will be empty.",
          duration: 7000,
        });
        return;
      }
      toast.warning("No GROUP BY — aggregations will return a single summary row", {
        description: "Add GROUP BY columns for per-category results.",
        duration: 5000,
      });
    }
    if (config.joins.length > 0) {
      const joinTables = new Set(config.joins.flatMap((j) => [j.leftTable, j.rightTable]));
      const missingTables = joinTables.difference(new Set(config.tables));
      if (missingTables.size > 0) {
        toast.error(`Join references table(s) not selected: ${[...missingTables].join(", ")}`);
        return;
      }
    }
    setHasRunQuery(true);
  };

  const handleSelectTemplate = useCallback((templateConfig: QueryConfig) => {
    if (isDirty) {
      const confirmed = window.confirm("You have unsaved changes. Load template anyway?");
      if (!confirmed) return;
    }
    loadConfig(templateConfig);
    setMode("advanced");
    setHasRunQuery(false);
    setDateRange(null);
    toast.success("Template loaded");
  }, [loadConfig, isDirty]);

  const handleLoadQuery = useCallback((loadedConfig: QueryConfig) => {
    if (isDirty) {
      const confirmed = window.confirm("You have unsaved changes. Load this query anyway?");
      if (!confirmed) return;
    }
    loadConfig(loadedConfig);
    setHasRunQuery(false);
    setDateRange(null);
  }, [loadConfig, isDirty]);

  const handleReset = useCallback(() => {
    if (!hasValidConfig) return;
    const confirmed = window.confirm("Reset your entire query? This cannot be undone.");
    if (!confirmed) return;
    resetConfig();
    setHasRunQuery(false);
    setDateRange(null);
    toast.success("Query reset");
  }, [hasValidConfig, resetConfig]);

  // Keyboard shortcuts: Ctrl/Cmd+Enter → Run, Ctrl/Cmd+S → Save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Ctrl/Cmd+Enter → Run query
      if (e.key === "Enter") {
        e.preventDefault();
        handleRunQuery();
      }
      // Ctrl/Cmd+S → Save query
      if (e.key === "s") {
        e.preventDefault();
        if (hasValidConfig && mode === "advanced") {
          setSaveDialogOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRunQuery, hasValidConfig, mode]);

  const resultColumns = (() => {
    if (results && results.rows.length > 0) {
      return Object.keys(results.rows[0]).filter((k) => !k.startsWith("_"));
    }
    return config.columns.map((c) => c.alias || `${c.table}.${c.column}`);
  })();

// Resolve the actual result key for the GROUP BY column.
  // The backend's projectToColumns may use alias or raw column name as the key,
  // so we match case-insensitively against the actual result row keys.
  const groupByColumn = useMemo((): string | undefined => {
    if (config.groupBy.length === 0) return undefined;
    if (!results || results.rows.length === 0) return config.groupBy[0].column;
    
    const target = config.groupBy[0].column.toLowerCase();
    const keys = Object.keys(results.rows[0]).filter((k) => !k.startsWith("_"));
    
    // 1. Exact match
    const exact = keys.find((k) => k.toLowerCase() === target);
    if (exact) return exact;
    
    // 2. Suffix match (e.g., key "affiliateStatus" matches column "status")
    const suffix = keys.find((k) => k.toLowerCase().endsWith(target));
    if (suffix) return suffix;
    
    // 3. The column may have been projected under its alias — check config
    const aliased = config.columns.find(
      (c) => c.column === config.groupBy[0].column && c.alias
    );
    if (aliased?.alias) return aliased.alias;
    
    // 4. Fallback: try to find any key that contains the target (e.g., "affiliate" in "affiliate_id")
    const contains = keys.find((k) => k.toLowerCase().includes(target));
    if (contains) return contains;
    
    // 5. Last resort: use the first column (most likely to be the grouping key)
    return keys[0];
  }, [config.groupBy, config.columns, results]);

  // Debug: log what we're grouping by
  useEffect(() => {
    if (groupByColumn) {
      console.log("Grouping by column:", groupByColumn);
      if (results && results.rows.length > 0) {
        console.log("First row keys:", Object.keys(results.rows[0]).filter(k => !k.startsWith("_")));
      }
    }
  }, [groupByColumn, results]);

  return (
    <>
      <PageTopbar
        description="Build custom queries across your affiliate data"
        breadcrumbs={[
          { label: "Reports", href: "/reports" },
          { label: "Query Builder" },
        ]}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
            Query Builder
          </h1>
          <div className="flex items-center gap-1 bg-[var(--muted)] rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode("wizard")}
              className={cn(
                "gap-1.5 h-7 text-[12px] font-medium rounded-md",
                mode === "wizard"
                  ? "bg-white text-[#10409a] shadow-sm hover:bg-white hover:text-[#10409a]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-heading)]"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Wizard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode("advanced")}
              className={cn(
                "gap-1.5 h-7 text-[12px] font-medium rounded-md",
                mode === "advanced"
                  ? "bg-white text-[#10409a] shadow-sm hover:bg-white hover:text-[#10409a]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-heading)]"
              )}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Advanced
            </Button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {mode === "advanced" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={!hasValidConfig}
                  className="gap-1.5 text-[var(--text-muted)]"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={!hasValidConfig}
                  className="gap-1.5"
                >
                  <Save className="w-3 h-3" />
                  Save
                </Button>
                <QueryExportButton
                  hasResults={!!results && results.rows.length > 0}
                  columns={config.columns}
                  rows={results?.rows ?? []}
                  totalRows={results?.totalRows ?? 0}
                  tenantId={tenantId ?? ""}
                />
              </>
            )}
            <HealthIndicator health={health} />
            <Button
              size="sm"
              onClick={handleRunQuery}
              disabled={!hasValidConfig || health.status === "error"}
              className="gap-1.5"
              title="⌘ Enter"
            >
              <Play className="w-3 h-3" />
              Run Query
            </Button>
            {mode === "advanced" && hasValidConfig && (
              <div className="flex items-center gap-1.5 ml-1">
                <label className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">Limit</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={config.rowLimit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val > 0 && val <= 1000) setRowLimit(val);
                  }}
                  className="w-16 h-7 text-[12px] text-center rounded-md border border-[var(--border)] bg-white px-1 focus:outline-none focus:ring-1 focus:ring-[#10409a]/30"
                />
              </div>
            )}
          </div>
        </div>
      </PageTopbar>

      <div className="px-8 pt-6 pb-8">
        {mode === "wizard" ? (
          <FadeIn>
            <div className="max-w-3xl mx-auto py-8">
              <WizardFlow
                onSelectQuestion={handleSelectTemplate}
                onSwitchToAdvanced={() => setMode("advanced")}
              />
            </div>
          </FadeIn>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <FadeIn delay={0} className="space-y-4">
              <AccordionSection
                title="Saved Queries"
                icon={<Bookmark className="w-4 h-4" />}
                defaultOpen={false}
              >
                <SavedQueriesList
                  onLoadQuery={handleLoadQuery}
                  onShareQuery={(id) => setShareDialogQueryId(id)}
                />
              </AccordionSection>

              <AccordionSection
                title="Templates"
                icon={<LayoutTemplate className="w-4 h-4" />}
                defaultOpen={false}
              >
                <TemplateGallery onSelectTemplate={handleSelectTemplate} />
              </AccordionSection>
            </FadeIn>

            <FadeIn delay={100} className="space-y-5">
              <QuerySummary config={config} configJson={configJson} />

              <NextStepHint config={config} />

              <MissingJoinWarning config={config} onApplyJoin={addJoin} />

              <ColumnCollisionWarning config={config} />

              <AccordionSection
                title="Tables"
                description="Choose which tables to query"
                icon={<Database className="w-4 h-4" />}
                defaultOpen={true}
              >
                <TableSelector
                  selectedTables={config.tables}
                  onSelectionChange={setTables}
                />
              </AccordionSection>

              {config.tables.length > 0 && (
                <AccordionSection
                  title="Columns"
                  description="Select columns to include in results"
                  icon={<Columns3 className="w-4 h-4" />}
                  defaultOpen={true}
                >
                  <ColumnSelector
                    selectedTables={config.tables}
                    selectedColumns={config.columns}
                    onSelectionChange={(cols) => {
                      loadConfig({ ...config, columns: cols });
                    }}
                    onUpdateAlias={updateColumnAlias}
                  />
                </AccordionSection>
              )}

              {config.tables.length > 0 && (
                <AccordionSection
                  title="Filters"
                  description={`Add conditions to narrow results (${config.filters.length})`}
                  icon={<Filter className="w-4 h-4" />}
                  defaultOpen={true}
                >
                  <FilterBuilder
                    selectedTables={config.tables}
                    filters={config.filters}
                    filterLogic={config.filterLogic}
                    onAddFilter={addFilter}
                    onRemoveFilter={removeFilter}
                    onUpdateFilter={updateFilter}
                    onSetFilterLogic={setFilterLogic}
                    dateRange={dateRange}
                    onSetDateRange={setDateRange}
                  />
                </AccordionSection>
              )}

              {config.tables.length >= 2 && (
                <AccordionSection
                  title="Joins"
                  description={`Connect tables together (${config.joins.length}/3)`}
                  icon={<Link2 className="w-4 h-4" />}
                  defaultOpen={true}
                >
                  <JoinBuilder
                    selectedTables={config.tables}
                    joins={config.joins}
                    onAddJoin={addJoin}
                    onRemoveJoin={removeJoin}
                  />
                </AccordionSection>
              )}

              {config.tables.length > 0 && (
                <AccordionSection
                  title="Aggregations & Group By"
                  description={`Aggregate and group your data (${config.aggregations.length} aggs)`}
                  icon={<Sigma className="w-4 h-4" />}
                  defaultOpen={config.aggregations.length > 0 || config.groupBy.length > 0}
                >
                  <AggregationBuilder
                    selectedTables={config.tables}
                    aggregations={config.aggregations}
                    groupBy={config.groupBy}
                    onAddAggregation={addAggregation}
                    onRemoveAggregation={removeAggregation}
                    onSetGroupBy={setGroupBy}
                  />
                </AccordionSection>
              )}

              <AccordionSection
                title="Results"
                description={results ? `${results.totalRows.toLocaleString()} rows` : "Run a query to see results"}
                icon={<Play className="w-4 h-4" />}
                defaultOpen={!!results && results.rows.length > 0}
              >
                <ResultsTable
                  results={results?.rows ?? null}
                  columns={resultColumns}
                  isLoading={hasRunQuery && !results}
                  totalRows={results?.totalRows}
                  groupByColumn={groupByColumn}
                />
              </AccordionSection>
            </FadeIn>
          </div>
        )}
      </div>

      <SaveQueryDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        config={config}
      />

      <ShareQueryDialog
        open={!!shareDialogQueryId}
        onOpenChange={(open) => !open && setShareDialogQueryId(null)}
        queryId={shareDialogQueryId}
      />
    </>
  );
}

export default function QueryBuilderPage() {
  return (
    <Suspense fallback={<QueryBuilderPageSkeleton />}>
      <QueryBuilderContent />
    </Suspense>
  );
}
