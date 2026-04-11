"use client";

import React, { Suspense, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQueryBuilder, type QueryConfig } from "@/hooks/useQueryBuilder";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/button";
import { AccordionSection } from "@/components/ui/accordion-section";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { QueryBuilderPageSkeleton } from "@/components/query-builder/skeletons";
import { TableSelector } from "@/components/query-builder/TableSelector";
import { ColumnSelector } from "@/components/query-builder/ColumnSelector";
import { FilterBuilder } from "@/components/query-builder/FilterBuilder";
import { JoinBuilder } from "@/components/query-builder/JoinBuilder";
import { AggregationBuilder } from "@/components/query-builder/AggregationBuilder";
import { ResultsTable } from "@/components/query-builder/ResultsTable";
import { AdminSavedQueriesList } from "@/components/query-builder/AdminSavedQueriesList";
import { SaveQueryDialog } from "@/components/query-builder/SaveQueryDialog";
import { QueryPreviewSentence } from "@/components/query-builder/QueryPreviewSentence";
import { DATE_PRESETS } from "@/lib/date-presets";
import { escapeCsvField, downloadCsvFromString } from "@/lib/csv-utils";
import {
  Play,
  Save,
  Settings2,
  Database,
  Columns3,
  Filter,
  Link2,
  Sigma,
  Bookmark,
  RotateCcw,
  AlertCircle,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Calendar,
  X,
  Undo2,
  Redo2,
  Pin,
  PanelRight,
  ArrowLeft,
  TrendingUp,
  BarChart3,
  GitBranch,
  Wallet,
  PieChart,
  DollarSign,
  Users,
  Shield,
  Download,
  Loader2,
  Construction,
  Building2,
  FileText,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

// ─── View State ─────────────────────────────────────────────────
type ViewState = "landing" | "results" | "builder";

// ─── Query Health Score ───────────────────────────────────────────
type HealthStatus = "idle" | "ready" | "warning" | "error";

interface HealthCheck {
  status: HealthStatus;
  score: number;
  issues: Array<{ level: "error" | "warning"; message: string }>;
}

function computeHealth(config: QueryConfig): HealthCheck {
  const issues: HealthCheck["issues"] = [];
  let score = 100;

  if (config.tables.length === 0) {
    return { status: "idle", score: 0, issues: [] };
  }

  if (config.columns.length === 0) {
    issues.push({ level: "error", message: "Select at least one column" });
    score -= 40;
  }

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

  const aggKeys = new Set(config.aggregations.map((a) => `${a.function}_${a.column}`));
  if (aggKeys.size < config.aggregations.length) {
    issues.push({ level: "warning", message: "Duplicate aggregation" });
    score -= 5;
  }

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

// ─── Missing Join Warning ─────────────────────────────────────────
function MissingJoinWarningAlert({
  config,
  onApplyJoin,
}: {
  config: QueryConfig;
  onApplyJoin: (join: QueryConfig["joins"][0]) => void;
}) {
  const metadata = useQuery(api.admin.queryBuilder.getTableMetadata);
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
          {" "}but didn&apos;t define a join. Results from those tables will be empty.
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

// ─── Column Collision Warning ──────────────────────────────────────
function ColumnCollisionWarningAlert({ config }: { config: QueryConfig }) {
  const collisions = useMemo(() => {
    const seen = new Map<string, string[]>();
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
          {collisions.map(([col, tables], idx) => (
            <span key={col}>
              <span className="font-semibold">{col}</span> exists in both {tables.join(" and ")}
              {idx < collisions.length - 1 ? ". " : "."}
            </span>
          ))}
          {" "}Results may show ambiguous data. Consider using aliases to distinguish them.
        </p>
      </div>
    </div>
  );
}

// ─── Next Step Hints ────────────────────────────────────────────────
function getNextStepSection(config: QueryConfig): string | null {
  if (config.tables.length === 0) return "tablesAndColumns";
  if (config.columns.length === 0) return "tablesAndColumns";
  if (config.tables.length >= 2) {
    const secondaryTables = new Set(config.columns.filter((c) => c.table !== config.tables[0]).map((c) => c.table));
    const joinedTables = new Set(config.joins.flatMap((j) => [j.leftTable, j.rightTable]));
    const unjoined = [...secondaryTables].filter((t) => !joinedTables.has(t));
    if (unjoined.length > 0) return "joins";
  }
  if (config.aggregations.length > 0 && config.groupBy.length === 0) return "aggregations";
  return null;
}

// ─── Quick-Start Card Data ─────────────────────────────────────────
interface QuickStartCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  defaultPreset: string;
  config: QueryConfig;
  piiWarning?: boolean;
}

const QUICK_START_CARDS: QuickStartCard[] = [
  {
    id: "top-tenants-activity",
    title: "Top Tenants by Activity",
    description: "Top 10 tenants ranked by active affiliates and confirmed commissions",
    icon: <Building2 className="w-6 h-6" />,
    category: "Tenants",
    defaultPreset: "Last 30 days",
    config: {
      tables: ["tenantStats"],
      columns: [
        { table: "tenantStats", column: "tenantId" },
        { table: "tenantStats", column: "affiliatesActive", alias: "Active Affiliates" },
        { table: "tenantStats", column: "commissionsConfirmedThisMonth", alias: "Confirmed This Month" },
        { table: "tenantStats", column: "totalPaidOut", alias: "Total Paid Out" },
        { table: "tenantStats", column: "commissionsFlagged", alias: "Flagged" },
      ],
      filters: [],
      filterLogic: "and",
      joins: [
        { id: "j1", leftTable: "tenantStats", rightTable: "tenants", leftField: "tenantId", rightField: "_id", joinType: "left" },
      ],
      aggregations: [],
      groupBy: [],
      rowLimit: 10,
    },
  },
  {
    id: "fraud-rate-tenant",
    title: "Fraud Rate by Tenant",
    description: "Tenants with the highest fraud rates based on flagged commissions",
    icon: <Shield className="w-6 h-6" />,
    category: "Security",
    defaultPreset: "Last 30 days",
    config: {
      tables: ["tenantStats"],
      columns: [
        { table: "tenantStats", column: "tenantId" },
        { table: "tenantStats", column: "commissionsFlagged", alias: "Flagged" },
        { table: "tenantStats", column: "commissionsPendingCount", alias: "Pending" },
        { table: "tenantStats", column: "commissionsConfirmedThisMonth", alias: "Confirmed" },
        { table: "tenantStats", column: "totalPaidOut", alias: "Paid Out" },
      ],
      filters: [
        { id: "f1", table: "tenantStats", column: "commissionsFlagged", operator: "gt", value: 0 },
      ],
      filterLogic: "and",
      joins: [],
      aggregations: [],
      groupBy: [],
      rowLimit: 50,
    },
  },
  {
    id: "commission-volume",
    title: "Commission Volume (30 days)",
    description: "Commission breakdown by status over the last 30 days",
    icon: <TrendingUp className="w-6 h-6" />,
    category: "Commissions",
    defaultPreset: "Last 30 days",
    config: {
      tables: ["commissions"],
      columns: [
        { table: "commissions", column: "status", alias: "Status" },
        { table: "commissions", column: "amount", alias: "Total Amount" },
        { table: "commissions", column: "createdAt", alias: "Date" },
      ],
      filters: [],
      filterLogic: "and",
      joins: [],
      aggregations: [
        { id: "a1", table: "commissions", column: "amount", function: "SUM", alias: "Total Amount" },
        { id: "a2", table: "commissions", column: "amount", function: "COUNT", alias: "Count" },
      ],
      groupBy: [{ table: "commissions", column: "status" }],
      rowLimit: 500,
    },
  },
  {
    id: "affiliate-growth-plan",
    title: "Affiliate Growth by Plan",
    description: "Affiliate counts grouped by tenant",
    icon: <Users className="w-6 h-6" />,
    category: "Affiliates",
    defaultPreset: "Last 30 days",
    piiWarning: true,
    config: {
      tables: ["affiliates"],
      columns: [
        { table: "affiliates", column: "tenantId", alias: "Tenant ID" },
        { table: "affiliates", column: "status", alias: "Status" },
      ],
      filters: [
        { id: "f1", table: "affiliates", column: "status", operator: "equals", value: "active" },
      ],
      filterLogic: "and",
      joins: [],
      aggregations: [
        { id: "a1", table: "affiliates", column: "status", function: "COUNT", alias: "Count" },
      ],
      groupBy: [{ table: "affiliates", column: "tenantId" }],
      rowLimit: 500,
    },
  },
  {
    id: "audit-heatmap",
    title: "Audit Activity Heatmap",
    description: "Most common audit actions over the last 30 days",
    icon: <FileText className="w-6 h-6" />,
    category: "Audit",
    defaultPreset: "Last 30 days",
    config: {
      tables: ["auditLogs"],
      columns: [
        { table: "auditLogs", column: "action", alias: "Action" },
        { table: "auditLogs", column: "actorType", alias: "Actor Type" },
        { table: "auditLogs", column: "createdAt", alias: "Timestamp" },
      ],
      filters: [],
      filterLogic: "and",
      joins: [],
      aggregations: [
        { id: "a1", table: "auditLogs", column: "action", function: "COUNT", alias: "Count" },
      ],
      groupBy: [{ table: "auditLogs", column: "action" }],
      rowLimit: 500,
    },
  },
  {
    id: "billing-events",
    title: "Billing Events Overview",
    description: "Recent billing events across all tenants",
    icon: <DollarSign className="w-6 h-6" />,
    category: "Billing",
    defaultPreset: "Last 30 days",
    config: {
      tables: ["billingHistory"],
      columns: [
        { table: "billingHistory", column: "tenantId", alias: "Tenant" },
        { table: "billingHistory", column: "event", alias: "Event" },
        { table: "billingHistory", column: "plan", alias: "Plan" },
        { table: "billingHistory", column: "amount", alias: "Amount" },
        { table: "billingHistory", column: "timestamp", alias: "Date" },
      ],
      filters: [],
      filterLogic: "and",
      joins: [],
      aggregations: [
        { id: "a1", table: "billingHistory", column: "amount", function: "SUM", alias: "Total" },
        { id: "a2", table: "billingHistory", column: "amount", function: "COUNT", alias: "Count" },
      ],
      groupBy: [{ table: "billingHistory", column: "event" }],
      rowLimit: 500,
    },
  },
  {
    id: "payout-overview",
    title: "Payout Status Overview",
    description: "Payout counts and totals grouped by status",
    icon: <Wallet className="w-6 h-6" />,
    category: "Payouts",
    defaultPreset: "Last 30 days",
    config: {
      tables: ["payouts"],
      columns: [
        { table: "payouts", column: "status", alias: "Status" },
        { table: "payouts", column: "amount", alias: "Amount" },
      ],
      filters: [],
      filterLogic: "and",
      joins: [],
      aggregations: [
        { id: "a1", table: "payouts", column: "amount", function: "SUM", alias: "Total" },
        { id: "a2", table: "payouts", column: "amount", function: "COUNT", alias: "Count" },
      ],
      groupBy: [{ table: "payouts", column: "status" }],
      rowLimit: 500,
    },
  },
  {
    id: "campaign-conversion-funnel",
    title: "Conversion Funnel",
    description: "Track conversions grouped by status",
    icon: <GitBranch className="w-6 h-6" />,
    category: "Conversions",
    defaultPreset: "Last 30 days",
    config: {
      tables: ["conversions"],
      columns: [
        { table: "conversions", column: "status", alias: "Status" },
        { table: "conversions", column: "amount", alias: "Amount" },
      ],
      filters: [],
      filterLogic: "and",
      joins: [],
      aggregations: [
        { id: "a1", table: "conversions", column: "amount", function: "COUNT", alias: "count" },
        { id: "a2", table: "conversions", column: "amount", function: "SUM", alias: "total" },
      ],
      groupBy: [{ table: "conversions", column: "status" }],
      rowLimit: 500,
    },
  },
  {
    id: "commission-status-breakdown",
    title: "Commission Status Breakdown",
    description: "Commission counts and totals by status",
    icon: <PieChart className="w-6 h-6" />,
    category: "Commissions",
    defaultPreset: "Last 30 days",
    config: {
      tables: ["commissions"],
      columns: [
        { table: "commissions", column: "status", alias: "Status" },
        { table: "commissions", column: "amount", alias: "Amount" },
      ],
      filters: [],
      filterLogic: "and",
      joins: [],
      aggregations: [
        { id: "a1", table: "commissions", column: "amount", function: "COUNT", alias: "count" },
        { id: "a2", table: "commissions", column: "amount", function: "SUM", alias: "total" },
      ],
      groupBy: [{ table: "commissions", column: "status" }],
      rowLimit: 500,
    },
  },
];

// Admin-only table names for TableSelector
const ADMIN_TABLE_NAMES = [
  "tenants", "tenantStats", "billingHistory", "auditLogs",
  "tierConfigs", "tierOverrides", "adminNotes",
  "affiliates", "campaigns", "clicks", "conversions",
  "commissions", "payouts", "payoutBatches",
];

// ─── Main Page Component ─────────────────────────────────────────
function AdminQueryBuilderContent() {
  // ─── Query Builder Hook (admin mode) ──────────────────────────
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
    isDirty,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  } = useQueryBuilder({ isAdminMode: true, maxRowLimit: 500 });

  // ─── View State Machine ───────────────────────────────────────
  const [view, setView] = useState<ViewState>("landing");

  // ─── Other State ──────────────────────────────────────────────
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: number; end: number; preset?: string } | null>(null);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [isBuilderCollapsed, setIsBuilderCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileSlideOver, setIsMobileSlideOver] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [dirtyCheckDialogOpen, setDirtyCheckDialogOpen] = useState(false);
  const [pendingDirtyAction, setPendingDirtyAction] = useState<(() => void) | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const lastDatePresetRef = useRef<string>("");

  // ─── Split-pane matchMedia listener ────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const handler = (e: MediaQueryListEvent) => {
      if (!e.matches && !isBuilderCollapsed) {
        setIsBuilderCollapsed(true);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [isBuilderCollapsed]);

  // ─── Sidebar default-open logic ────────────────────────────────
  const savedQueriesCount = useQuery(api.admin.queryBuilder.listSavedQueries);
  const hasSavedQueries = !!(savedQueriesCount && savedQueriesCount.length > 0);

  useEffect(() => {
    if (view === "landing") {
      setSidebarOpen(hasSavedQueries);
    }
  }, [view, hasSavedQueries]);

  // ─── Shared Dirty-Check Dialog ─────────────────────────────────
  const confirmIfDirty = useCallback((action: () => void) => {
    if (isDirty) {
      setPendingDirtyAction(() => action);
      setDirtyCheckDialogOpen(true);
    } else {
      action();
    }
  }, [isDirty]);

  // ─── Query Execution (via Convex useQuery — reactive) ──────────
  const queryArgs = {
    tables: config.tables,
    columns: config.columns,
    filters: config.filters.length > 0 ? config.filters : undefined,
    filterLogic: config.filterLogic,
    joins: config.joins.length > 0 ? config.joins : undefined,
    aggregations: config.aggregations.length > 0 ? config.aggregations : undefined,
    groupBy: config.groupBy.length > 0 ? config.groupBy : undefined,
    dateRange: dateRange ? { start: dateRange.start, end: dateRange.end } : undefined,
    rowLimit: config.rowLimit,
  };

  const hasValidConfig =
    config.tables.length > 0 && config.columns.length > 0;

  const health = useMemo(() => computeHealth(config), [config]);

  const [hasRunQuery, setHasRunQuery] = useState(false);

  const results = useQuery(
    api.admin.queryBuilder.executeQuery,
    hasRunQuery && hasValidConfig
      ? queryArgs
      : "skip"
  );

  const handleRunQuery = useCallback(() => {
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
  }, [hasValidConfig, config]);

  // ─── Card Click / Auto-Execute ─────────────────────────────────
  const handleSelectTemplate = useCallback((card: QuickStartCard) => {
    confirmIfDirty(() => {
      loadConfig(card.config);
      clearHistory();

      const preset = DATE_PRESETS.find((p) => p.label === card.defaultPreset);
      if (preset) {
        setDateRange({ start: preset.start(), end: preset.end(), preset: card.defaultPreset });
      }

      setView("results");
      setHasRunQuery(true);
    });
  }, [confirmIfDirty, loadConfig, clearHistory]);

  // ─── Load Saved Query ──────────────────────────────────────────
  const handleLoadQuery = useCallback((loadedConfig: QueryConfig) => {
    confirmIfDirty(() => {
      loadConfig(loadedConfig);
      clearHistory();
      const preset = DATE_PRESETS.find((p) => p.label === "Last 30 days");
      if (preset) {
        setDateRange({ start: preset.start(), end: preset.end(), preset: preset.label });
      }
      setView("results");
      setHasRunQuery(true);
      setSidebarOpen(false);
    });
  }, [confirmIfDirty, loadConfig, clearHistory]);

  // ─── Navigate to Landing (with unsaved-changes check) ──────────
  const navigateToLanding = useCallback(() => {
    const doNavigate = () => {
      setView("landing");
      setIsBuilderCollapsed(false);
    };

    if (isDirty) {
      setPendingNavigation(() => {
        resetConfig();
        clearHistory();
        setHasRunQuery(false);
        setDateRange(null);
        doNavigate();
      });
      setUnsavedDialogOpen(true);
    } else {
      doNavigate();
    }
  }, [isDirty, resetConfig, clearHistory]);

  // ─── Handle Reset ──────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (!hasValidConfig) return;
    const confirmed = window.confirm("Reset your entire query? This cannot be undone.");
    if (!confirmed) return;
    resetConfig();
    clearHistory();
    setHasRunQuery(false);
    setDateRange(null);
    toast.success("Query reset");
  }, [hasValidConfig, resetConfig, clearHistory]);

  // ─── Handle Export ─────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!results || results.rows.length === 0) return;

    setIsExporting(true);
    try {
      const headers = config.columns.map((col) => col.alias || `${col.table}.${col.column}`);
      const csvRows = results.rows.map((row) =>
        config.columns.map((col) => {
          const key = col.alias || `${col.table}.${col.column}`;
          const value = row[key];
          if (value === null || value === undefined) return "";
          if (typeof value === "number") return value.toFixed(2);
          return escapeCsvField(String(value));
        })
      );

      const csvContent =
        "\uFEFF" +
        headers.join(",") +
        "\n" +
        csvRows.map((row) => row.join(",")).join("\n");

      const date = new Date().toISOString().split("T")[0];
      downloadCsvFromString(csvContent, `admin-query-export-${date}`);
      toast.success(`Exported ${results.rows.length} rows`);
    } catch {
      toast.error("Failed to export query results");
    } finally {
      setIsExporting(false);
    }
  }, [results, config.columns]);

  // ─── Keyboard Shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "b" && mod && view === "builder") {
        e.preventDefault();
        setIsBuilderCollapsed((prev) => !prev);
        return;
      }
      if (!mod) return;

      if (e.key === "Enter") {
        e.preventDefault();
        if (view !== "landing") {
          handleRunQuery();
        }
      }
      if (e.key === "s") {
        e.preventDefault();
        if (hasValidConfig && view !== "landing") {
          setSaveDialogOpen(true);
        }
      }
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      if (e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRunQuery, hasValidConfig, view, canUndo, canRedo, undo, redo]);

  // ─── Result Columns ────────────────────────────────────────────
  const resultColumns = (() => {
    if (results && results.rows.length > 0) {
      return Object.keys(results.rows[0]).filter((k) => !k.startsWith("_"));
    }
    return config.columns.map((c) => c.alias || `${c.table}.${c.column}`);
  })();

  const groupByColumn = useMemo((): string | undefined => {
    if (config.groupBy.length === 0) return undefined;
    if (!results || results.rows.length === 0) return config.groupBy[0].column;

    const target = config.groupBy[0].column.toLowerCase();
    const keys = Object.keys(results.rows[0]).filter((k) => !k.startsWith("_"));

    const exact = keys.find((k) => k.toLowerCase() === target);
    if (exact) return exact;

    const suffix = keys.find((k) => k.toLowerCase().endsWith(target));
    if (suffix) return suffix;

    const aliased = config.columns.find(
      (c) => c.column === config.groupBy[0].column && c.alias
    );
    if (aliased?.alias) return aliased.alias;

    const contains = keys.find((k) => k.toLowerCase().includes(target));
    if (contains) return contains;

    return keys[0];
  }, [config.groupBy, config.columns, results]);

  // ─── Accordion Section Management ──────────────────────────────
  const [openSection, setOpenSection] = useState<string | null>("tablesAndColumns");
  const [pinnedSections, setPinnedSections] = useState<Set<string>>(new Set());
  const sectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSectionToggle = useCallback((sectionId: string) => {
    if (pinnedSections.has(sectionId)) return;

    if (sectionTimeoutRef.current) {
      clearTimeout(sectionTimeoutRef.current);
    }

    if (openSection === sectionId) {
      setOpenSection(null);
    } else {
      setOpenSection(null);
      sectionTimeoutRef.current = setTimeout(() => {
        setOpenSection(sectionId);
      }, 300);
    }
  }, [openSection, pinnedSections]);

  const handlePinToggle = useCallback((sectionId: string) => {
    setPinnedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else if (next.size >= 2) {
        toast("You can pin up to 2 sections. Unpin one first.", {
          icon: <Pin className="w-4 h-4" />,
        });
        return prev;
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // ─── PII Detection ────────────────────────────────────────────
  const hasPiiColumns = config.columns.some((c) =>
    c.column.toLowerCase().includes("email") || c.column.toLowerCase().includes("name")
  );

  // ─── Smart Section Ordering ────────────────────────────────────
  const sectionOrder = useMemo(() => {
    const nextStep = getNextStepSection(config);
    const defaultOrder = ["tablesAndColumns", "filters", "joins", "aggregations"];

    const visible: string[] = [];
    for (const id of defaultOrder) {
      if (id === "tablesAndColumns") visible.push(id);
      else if (id === "filters" && config.tables.length > 0) visible.push(id);
      else if (id === "joins" && config.tables.length >= 2) visible.push(id);
      else if (id === "aggregations" && config.tables.length > 0) visible.push(id);
    }

    if (nextStep && visible.includes(nextStep) && visible[0] !== nextStep) {
      return [nextStep, ...visible.filter((id) => id !== nextStep)];
    }
    return visible;
  }, [config]);

  // ─── Card loading/error state ──────────────────────────────────
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);
  const [errorCardId, setErrorCardId] = useState<string | null>(null);

  const prevResultsRef = useRef<typeof results>(undefined);
  useEffect(() => {
    if (loadingCardId && results !== undefined) {
      if (results && results.rows && results.rows.length >= 0) {
        setLoadingCardId(null);
        setErrorCardId(null);
      } else {
        setLoadingCardId(null);
        setErrorCardId(loadingCardId);
      }
    }
    prevResultsRef.current = results;
  }, [results, loadingCardId]);

  // ─── Render ────────────────────────────────────────────────────
  const hasConfigContent =
    config.tables.length > 0 ||
    config.columns.length > 0 ||
    config.filters.length > 0;

  // Derive split-pane desktop state from matchMedia listener
  const [isDesktopBreakpoint, setIsDesktopBreakpoint] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    setIsDesktopBreakpoint(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktopBreakpoint(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <>
      <PageTopbar
        description="Cross-tenant ad-hoc query tool for platform admins"
        breadcrumbs={[
          { label: "Admin", href: "/tenants" },
          { label: "Query Builder" },
        ]}
        actions={
          view !== "landing" ? (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Undo/Redo */}
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={!canUndo}
                title="Undo (⌘Z)"
                className="gap-1.5 text-[var(--text-muted)]"
              >
                <Undo2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (⌘⇧Z)"
                className="gap-1.5 text-[var(--text-muted)]"
              >
                <Redo2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={!hasValidConfig}
                title="Reset query"
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
                title="⌘+S to save"
                className="gap-1.5"
              >
                <Save className="w-3 h-3" />
                Save
              </Button>

              {/* Export */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting || !results || results.rows.length === 0}
                className="gap-1.5"
              >
                {isExporting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                Export CSV
              </Button>

              <HealthIndicator health={health} />

              {/* PII Warning */}
              {hasPiiColumns && hasRunQuery && results && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
                  <AlertTriangle className="w-3 h-3" />
                  PII
                </div>
              )}

              {/* Sidebar toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className={cn(
                  "gap-1.5 text-[var(--text-muted)]",
                  sidebarOpen && "bg-[var(--muted)] text-[var(--text-heading)]"
                )}
                aria-label="Toggle saved queries"
              >
                <Bookmark className="w-3 h-3" />
              </Button>

              {/* Date range picker */}
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "gap-1.5",
                      dateRange && "border-[#1c2260] bg-[#1c2260]/5"
                    )}
                  >
                    <Calendar className="w-3 h-3" />
                    {dateRange?.preset || "Date range"}
                    {dateRange && (
                      <X
                        className="w-3 h-3 ml-1 hover:bg-[var(--hover)] rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDateRange(null);
                          lastDatePresetRef.current = "";
                        }}
                      />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="space-y-1">
                    {DATE_PRESETS.map((preset) => {
                      const isActive = dateRange?.preset === preset.label;
                      return (
                        <Button
                          key={preset.label}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full justify-start text-[12px]",
                            isActive && "bg-[#1c2260] text-white hover:bg-[#1c2260]"
                          )}
                          onClick={() => {
                            const newRange = {
                              start: preset.start(),
                              end: preset.end(),
                              preset: preset.label,
                            };
                            setDateRange(newRange);
                            lastDatePresetRef.current = preset.label;
                            setDatePopoverOpen(false);
                          }}
                        >
                          {preset.label}
                        </Button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Run Query */}
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

              {/* Row limit */}
              {hasValidConfig && (
                <div className="flex items-center gap-1.5 ml-1">
                  <label htmlFor="row-limit" className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">Limit</label>
                  <input
                    id="row-limit"
                    type="number"
                    min={1}
                    max={500}
                    value={config.rowLimit}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val > 0 && val <= 500) setRowLimit(val);
                    }}
                    className="w-16 h-7 text-[12px] text-center rounded-md border border-[var(--border)] bg-white px-1 focus:outline-none focus:ring-1 focus:ring-[#1c2260]/30"
                  />
                </div>
              )}
            </div>
          ) : (
            <HealthIndicator health={health} />
          )
        }
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* Admin badge (always visible) */}
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1">
            <Shield className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[12px] font-medium text-amber-800">
              All Tenant Data
            </span>
          </div>

          <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
            Query Builder
          </h1>

          {/* Back button */}
          {view !== "landing" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateToLanding}
              className="gap-1.5 text-[var(--text-muted)]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          )}
        </div>
      </PageTopbar>

      <div className="px-8 pt-6 pb-8">
        {/* ═══════════════════════════════════════════════════════ */}
        {/* LANDING VIEW                                            */}
        {/* ═══════════════════════════════════════════════════════ */}
        {view === "landing" && (
          <FadeIn>
            <div className="max-w-4xl mx-auto py-4">
              {/* Quick-start cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:overflow-x-auto md:flex md:gap-4 md:snap-x md:snap-mandatory md:[scrollbar-width:none]">
                {QUICK_START_CARDS.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setLoadingCardId(card.id);
                      setErrorCardId(null);
                      handleSelectTemplate(card);
                    }}
                    className="group relative text-left rounded-xl border border-[var(--border)] bg-white p-5 hover:border-[#1c2260]/30 hover:shadow-md transition-all duration-200 snap-start md:min-w-[260px] focus:outline-none focus:ring-2 focus:ring-[#1c2260]/30"
                  >
                    {/* Loading overlay */}
                    {loadingCardId === card.id && (
                      <div className="absolute inset-0 rounded-xl bg-white/80 flex items-center justify-center z-10">
                        <Loader2 className="w-6 h-6 text-[#1c2260] animate-spin" />
                      </div>
                    )}
                    {/* Error overlay */}
                    {errorCardId === card.id && (
                      <div className="absolute inset-0 rounded-xl bg-white/90 flex flex-col items-center justify-center z-10 gap-2 px-4">
                        <AlertCircle className="w-6 h-6 text-red-500" />
                        <span className="text-[12px] text-red-600 text-center">Failed to load</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setErrorCardId(null);
                            setLoadingCardId(card.id);
                            handleSelectTemplate(card);
                          }}
                          className="text-[11px] gap-1"
                        >
                          Retry
                        </Button>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1c2260]/10 flex items-center justify-center text-[#1c2260] shrink-0 group-hover:bg-[#1c2260]/15 transition-colors">
                        {card.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-heading)] leading-snug">
                          {card.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          — {card.defaultPreset}
                        </div>
                        <p className="text-[12px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
                          {card.description}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {card.category}
                      </Badge>
                      {card.piiWarning && (
                        <Badge variant="outline" className="text-[10px] font-medium border-red-200 text-red-600 bg-red-50">
                          PII
                        </Badge>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] ml-auto opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Build Your Own button */}
              <div className="mt-8 text-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setView("builder")}
                  className="gap-2"
                >
                  <Construction className="w-4 h-4" />
                  Build Your Own Query
                </Button>
              </div>
            </div>
          </FadeIn>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* RESULTS VIEW                                            */}
        {/* ═══════════════════════════════════════════════════════ */}
        {view === "results" && (
          <FadeIn>
            <div className="space-y-4">
              {/* PII Warning banner */}
              {hasPiiColumns && results && results.rows.length > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-red-900">
                      Results contain PII — export with caution
                    </div>
                    <p className="text-[12px] text-red-800 mt-0.5">
                      These results include personally identifiable information (email, name). Handle and export responsibly.
                    </p>
                  </div>
                </div>
              )}

              {/* Action bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setView("builder")}
                    className="gap-1.5"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Customize this query
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={navigateToLanding}
                  className="gap-1 text-[12px] text-[var(--text-muted)]"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back to quick reports
                </Button>
              </div>

              {/* Query preview */}
              {hasConfigContent && (
                <QueryPreviewSentence config={config} />
              )}

              {/* Results */}
              <div className="rounded-xl border border-[var(--border)] bg-white">
                <ResultsTable
                  results={results?.rows ?? null}
                  columns={resultColumns}
                  isLoading={hasRunQuery && !results}
                  totalRows={results?.totalRows}
                  groupByColumn={groupByColumn}
                />
              </div>
            </div>
          </FadeIn>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* BUILDER VIEW — Desktop                                   */}
        {/* ═══════════════════════════════════════════════════════ */}
        {view === "builder" && (
          <>
            {/* Desktop builder (≥1280px) — always split view */}
            <FadeIn className="hidden xl:block">
              <div className="space-y-4">
                {/* Query preview sentence */}
                <QueryPreviewSentence config={config} />

                {/* PII Warning banner */}
                {hasPiiColumns && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-red-900">
                        PII Warning
                      </div>
                      <p className="text-[12px] text-red-800 mt-0.5">
                        Selected columns contain personally identifiable information. Results will include sensitive data.
                      </p>
                    </div>
                  </div>
                )}

                <div
                  className="grid relative"
                  style={{
                    gridTemplateColumns: isBuilderCollapsed
                      ? "0px 1fr"
                      : "minmax(400px, 1fr) minmax(500px, 1.5fr)",
                    transition: "grid-template-columns 300ms ease",
                  }}
                >
                  {/* Builder panels — left column */}
                  <div
                    className="overflow-hidden"
                    style={{
                      opacity: isBuilderCollapsed ? 0 : 1,
                      transition: "opacity 200ms ease",
                    }}
                  >
                    <BuilderSections
                      config={config}
                      loadConfig={loadConfig}
                      setTables={setTables}
                      addColumn={addColumn}
                      removeColumn={removeColumn}
                      updateColumnAlias={updateColumnAlias}
                      addFilter={addFilter}
                      removeFilter={removeFilter}
                      updateFilter={updateFilter}
                      setFilterLogic={setFilterLogic}
                      addJoin={addJoin}
                      removeJoin={removeJoin}
                      addAggregation={addAggregation}
                      removeAggregation={removeAggregation}
                      setGroupBy={setGroupBy}
                      openSection={openSection}
                      pinnedSections={pinnedSections}
                      sectionOrder={sectionOrder}
                      onSectionToggle={handleSectionToggle}
                      onPinToggle={handlePinToggle}
                    />
                  </div>

                  {/* Results — right column */}
                  <div
                    className="sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-auto rounded-xl border border-[var(--border)] bg-white p-4"
                    aria-live="polite"
                    aria-atomic="false"
                  >
                    {hasRunQuery ? (
                      <ResultsTable
                        results={results?.rows ?? null}
                        columns={resultColumns}
                        isLoading={hasRunQuery && !results}
                        totalRows={results?.totalRows}
                        groupByColumn={groupByColumn}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
                        <Play className="w-10 h-10 mb-3 opacity-20" />
                        <p className="text-sm font-medium">Run your query to see results</p>
                        <p className="text-xs mt-1 opacity-60">Select columns and click Run Query</p>
                      </div>
                    )}
                  </div>

                  {/* Collapse/expand toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsBuilderCollapsed((prev) => !prev)}
                    className={cn(
                      "absolute top-3 z-10 w-6 h-12 rounded-r-md border border-l-0 border-[var(--border)] bg-white shadow-sm hover:bg-[var(--hover)]",
                      "col-start-1 row-start-1 justify-center",
                      isBuilderCollapsed && "left-0"
                    )}
                    style={{
                      justifySelf: isBuilderCollapsed ? "start" : "end",
                      transition: "justify-self 300ms ease",
                    }}
                    aria-label={isBuilderCollapsed ? "Expand builder" : "Collapse builder"}
                    title={isBuilderCollapsed ? "Show builder (⌘B)" : "Hide builder (⌘B)"}
                  >
                    <PanelRight className={cn(
                      "w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-300",
                      isBuilderCollapsed && "rotate-180"
                    )} />
                  </Button>
                </div>
              </div>
            </FadeIn>

            {/* Mobile/Tablet builder (<1280px) — results first + FAB */}
            <div className="xl:hidden">
              <FadeIn>
                <div className="space-y-4">
                  {hasConfigContent && (
                    <QueryPreviewSentence config={config} />
                  )}
                  <div className="rounded-xl border border-[var(--border)] bg-white p-4" aria-live="polite">
                    {hasRunQuery ? (
                      <ResultsTable
                        results={results?.rows ?? null}
                        columns={resultColumns}
                        isLoading={hasRunQuery && !results}
                        totalRows={results?.totalRows}
                        groupByColumn={groupByColumn}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
                        <Play className="w-10 h-10 mb-3 opacity-20" />
                        <p className="text-sm font-medium">Run your query to see results</p>
                        <p className="text-xs mt-1 opacity-60">Select columns and click Run Query</p>
                      </div>
                    )}
                  </div>
                </div>
              </FadeIn>

              {/* Customize FAB */}
              <Button
                onClick={() => setIsMobileSlideOver(true)}
                className="fixed bottom-6 right-6 z-40 shadow-lg gap-2"
                size="lg"
                aria-label="Customize query"
              >
                <Settings2 className="w-4 h-4" />
                Customize
              </Button>

              {/* Slide-over builder */}
              <Sheet open={isMobileSlideOver} onOpenChange={setIsMobileSlideOver}>
                <SheetContent
                  side="right"
                  className="!w-[min(400px,85vw)] !max-w-none overflow-y-auto p-0"
                >
                  <SheetHeader className="px-6 pt-6 pb-2">
                    <SheetTitle>Query Builder</SheetTitle>
                    <SheetDescription>Customize your query parameters</SheetDescription>
                  </SheetHeader>
                  <div className="px-6 pb-6 space-y-4">
                    <QueryPreviewSentence config={config} />
                    <BuilderSections
                      config={config}
                      loadConfig={loadConfig}
                      setTables={setTables}
                      addColumn={addColumn}
                      removeColumn={removeColumn}
                      updateColumnAlias={updateColumnAlias}
                      addFilter={addFilter}
                      removeFilter={removeFilter}
                      updateFilter={updateFilter}
                      setFilterLogic={setFilterLogic}
                      addJoin={addJoin}
                      removeJoin={removeJoin}
                      addAggregation={addAggregation}
                      removeAggregation={removeAggregation}
                      setGroupBy={setGroupBy}
                      openSection={openSection}
                      pinnedSections={pinnedSections}
                      sectionOrder={sectionOrder}
                      onSectionToggle={handleSectionToggle}
                      onPinToggle={handlePinToggle}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SAVED QUERIES SIDEBAR                                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 xl:bg-black/0"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className={cn(
              "fixed top-0 left-0 z-50 h-full w-[280px] bg-white border-r border-[var(--border)] shadow-xl xl:shadow-lg transition-transform duration-300",
              view === "builder"
                ? "shadow-2xl"
                : "xl:relative xl:shadow-none"
            )}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-heading)]">
                <Bookmark className="w-4 h-4 text-[#1c2260]" />
                Saved Queries
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
                className="text-[var(--text-muted)]"
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="overflow-y-auto h-[calc(100%-48px)]">
              <AdminSavedQueriesList
                onLoadQuery={handleLoadQuery}
              />
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* DIRTY-CHECK DIALOG                                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      <AlertDialog open={dirtyCheckDialogOpen} onOpenChange={setDirtyCheckDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your query. Discard them and proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDirtyCheckDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDirtyCheckDialogOpen(false);
                if (pendingDirtyAction) {
                  pendingDirtyAction();
                  setPendingDirtyAction(null);
                }
              }}
            >
              Discard & Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* UNSAVED CHANGES DIALOG                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <AlertDialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your query. Would you like to save them before going back?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUnsavedDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUnsavedDialogOpen(false);
                resetConfig();
                clearHistory();
                setHasRunQuery(false);
                setDateRange(null);
                if (pendingNavigation) {
                  pendingNavigation();
                  setPendingNavigation(null);
                }
              }}
              className="border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 bg-transparent"
            >
              Discard
            </AlertDialogAction>
            <AlertDialogAction onClick={() => {
              setUnsavedDialogOpen(false);
              setSaveDialogOpen(true);
            }}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SAVE DIALOG                                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <SaveQueryDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        config={config}
        isAdminMode
      />
    </>
  );
}

// ─── Builder Sections (shared between desktop and mobile) ─────────
interface BuilderSectionsProps {
  config: QueryConfig;
  loadConfig: (config: QueryConfig) => void;
  setTables: (tables: string[]) => void;
  addColumn: (table: string, column: string, alias?: string) => void;
  removeColumn: (table: string, column: string) => void;
  updateColumnAlias: (table: string, column: string, alias: string | undefined) => void;
  addFilter: (filter: QueryConfig["filters"][0]) => void;
  removeFilter: (id: string) => void;
  updateFilter: (id: string, updates: Partial<QueryConfig["filters"][0]>) => void;
  setFilterLogic: (logic: "and" | "or") => void;
  addJoin: (join: QueryConfig["joins"][0]) => void;
  removeJoin: (id: string) => void;
  addAggregation: (agg: QueryConfig["aggregations"][0]) => void;
  removeAggregation: (id: string) => void;
  setGroupBy: (groupBy: QueryConfig["groupBy"]) => void;
  openSection: string | null;
  pinnedSections: Set<string>;
  sectionOrder: string[];
  onSectionToggle: (id: string) => void;
  onPinToggle: (id: string) => void;
}

function BuilderSections({
  config,
  loadConfig,
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
  openSection,
  pinnedSections,
  sectionOrder,
  onSectionToggle,
  onPinToggle,
}: BuilderSectionsProps) {
  const joinStatus = useMemo(() => {
    if (config.tables.length < 2) return undefined;
    const secondaryTables = new Set(
      config.columns.filter((c) => c.table !== config.tables[0]).map((c) => c.table)
    );
    const joinedTables = new Set(config.joins.flatMap((j) => [j.leftTable, j.rightTable]));
    const unjoinedTables = [...secondaryTables].filter((t) => !joinedTables.has(t));
    return secondaryTables.size === 0 || unjoinedTables.length === 0 ? "completed" as const : undefined;
  }, [config]);

  const renderSection = (sectionId: string) => {
    const isOpen = openSection === sectionId || pinnedSections.has(sectionId);
    const isPinned = pinnedSections.has(sectionId);

    const sectionConfig: Record<string, {
      title: string;
      description: string;
      icon: React.ReactNode;
      status?: "completed" | "pending";
      alert?: React.ReactNode;
      children: React.ReactNode;
    }> = {
      tablesAndColumns: {
        title: "Tables & Columns",
        description: config.tables.length > 0
          ? `${config.tables.length} table${config.tables.length > 1 ? "s" : ""} selected · ${config.columns.length} column${config.columns.length !== 1 ? "s" : ""}`
          : "Choose tables and columns to query",
        icon: <Database className="w-4 h-4" />,
        status: config.tables.length > 0 && config.columns.length > 0 ? "completed" : undefined,
        alert: <ColumnCollisionWarningAlert config={config} />,
        children: (
          <div className="space-y-5">
            <TableSelector
              selectedTables={config.tables}
              onSelectionChange={setTables}
              isAdminMode
              availableTables={ADMIN_TABLE_NAMES}
            />
            {config.tables.length > 0 && (
              <div className="border-t border-[var(--border)] pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Columns3 className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm font-semibold text-[var(--text-heading)]">Columns</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {config.columns.length} selected
                  </Badge>
                </div>
                <ColumnSelector
                  selectedTables={config.tables}
                  selectedColumns={config.columns}
                  onSelectionChange={(cols) => loadConfig({ ...config, columns: cols })}
                  onUpdateAlias={updateColumnAlias}
                />
              </div>
            )}
          </div>
        ),
      },
      filters: {
        title: "Filters",
        description: `Add conditions to narrow results (${config.filters.length})`,
        icon: <Filter className="w-4 h-4" />,
        status: config.filters.length > 0 && config.filters.every(f => f.value !== undefined && f.value !== "") ? "completed" : undefined,
        children: (
          <FilterBuilder
            selectedTables={config.tables}
            filters={config.filters}
            filterLogic={config.filterLogic}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
            onUpdateFilter={updateFilter}
            onSetFilterLogic={setFilterLogic}
          />
        ),
      },
      joins: {
        title: "Joins",
        description: `Connect tables together (${config.joins.length}/3)`,
        icon: <Link2 className="w-4 h-4" />,
        status: joinStatus,
        alert: <MissingJoinWarningAlert config={config} onApplyJoin={addJoin} />,
        children: (
          <JoinBuilder
            selectedTables={config.tables}
            joins={config.joins}
            onAddJoin={addJoin}
            onRemoveJoin={removeJoin}
          />
        ),
      },
      aggregations: {
        title: "Aggregations & Group By",
        description: `Aggregate and group your data (${config.aggregations.length} aggs)`,
        icon: <Sigma className="w-4 h-4" />,
        status: config.aggregations.length > 0 && config.groupBy.length > 0 ? "completed" : config.aggregations.length > 0 ? "pending" : undefined,
        children: (
          <AggregationBuilder
            selectedTables={config.tables}
            aggregations={config.aggregations}
            groupBy={config.groupBy}
            onAddAggregation={addAggregation}
            onRemoveAggregation={removeAggregation}
            onSetGroupBy={setGroupBy}
          />
        ),
      },
    };

    const section = sectionConfig[sectionId];
    if (!section) return null;

    return (
      <AccordionSection
        key={sectionId}
        title={section.title}
        description={section.description}
        icon={section.icon}
        status={section.status}
        open={isOpen}
        onOpenChange={() => onSectionToggle(sectionId)}
        pinned={isPinned}
        alert={section.alert}
      >
        <div className="flex justify-end mb-2 -mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPinToggle(sectionId)}
            className={cn(
              "h-6 gap-1 text-[11px] px-2 rounded-md transition-colors",
              isPinned
                ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                : "text-[var(--text-muted)] hover:bg-[var(--hover)]"
            )}
            aria-label={isPinned ? `Unpin ${section.title}` : `Pin ${section.title}`}
          >
            <Pin className={cn("w-3 h-3", isPinned && "fill-current")} />
            {isPinned ? "Unpin" : "Pin"}
          </Button>
        </div>
        {section.children}
      </AccordionSection>
    );
  };

  return (
    <div className="space-y-3">
      {sectionOrder.map(renderSection)}
    </div>
  );
}

export default function AdminQueryBuilderPage() {
  return (
    <Suspense fallback={<QueryBuilderPageSkeleton />}>
      <AdminQueryBuilderContent />
    </Suspense>
  );
}
