"use client";

import React, { Suspense, useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQueryBuilder, type QueryConfig } from "@/hooks/useQueryBuilder";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSelector } from "@/components/query-builder/TableSelector";
import { ColumnSelector } from "@/components/query-builder/ColumnSelector";
import { FilterBuilder } from "@/components/query-builder/FilterBuilder";
import { JoinBuilder } from "@/components/query-builder/JoinBuilder";
import { AggregationBuilder } from "@/components/query-builder/AggregationBuilder";
import { ResultsTable } from "@/components/query-builder/ResultsTable";
import { SaveQueryDialog } from "@/components/query-builder/SaveQueryDialog";
import { DATE_PRESETS, type DateRange } from "@/lib/date-presets";
import {
  Play,
  Database,
  Columns3,
  Filter,
  Link2,
  Sigma,
  RotateCcw,
  AlertTriangle,
  Download,
  Shield,
  Trash2,
  Bookmark,
  Clock,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// =============================================================================
// Admin Query Templates
// =============================================================================

const ADMIN_TEMPLATES: Array<{
  name: string;
  description: string;
  config: QueryConfig;
  piiWarning?: boolean;
}> = [
  {
    name: "Top Tenants by Activity",
    description: "Top 10 tenants ranked by active affiliates and confirmed commissions",
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
    name: "Fraud Rate by Tenant",
    description: "Tenants with the highest fraud rates based on flagged commissions",
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
    piiWarning: false,
  },
  {
    name: "Commission Volume (30 days)",
    description: "Commission breakdown by status over the last 30 days",
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
    piiWarning: false,
  },
  {
    name: "Affiliate Growth by Plan",
    description: "Affiliate counts grouped by tenant",
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
    piiWarning: false,
  },
  {
    name: "Audit Activity Heatmap",
    description: "Most common audit actions over the last 30 days",
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
];

// Admin-only table names for TableSelector
const ADMIN_TABLE_NAMES = [
  "tenants", "tenantStats", "billingHistory", "auditLogs",
  "tierConfigs", "tierOverrides", "adminNotes",
  "affiliates", "campaigns", "clicks", "conversions",
  "commissions", "payouts", "payoutBatches",
];

// =============================================================================
// Skeleton
// =============================================================================

function AdminQueryBuilderSkeleton() {
  return (
    <div className="space-y-6">
      {/* Admin Badge */}
      <Skeleton className="h-8 w-64" />
      {/* Controls bar */}
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-32" />
        ))}
      </div>
      {/* Table selector */}
      <Skeleton className="h-40" />
      {/* Filters */}
      <Skeleton className="h-20" />
      {/* Results */}
      <Skeleton className="h-60" />
    </div>
  );
}

// =============================================================================
// Inline Saved Queries (admin-scoped)
// =============================================================================

function AdminSavedQueriesSection({
  onLoadQuery,
}: {
  onLoadQuery: (config: QueryConfig) => void;
}) {
  const savedQueries = useQuery(api.admin.queryBuilder.listSavedQueries);
  const deleteMutation = useMutation(api.admin.queryBuilder.deleteSavedQuery);

  if (!savedQueries || savedQueries.length === 0) return null;

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-[var(--border-light)] shadow-sm">
      <div className="px-5 py-4 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">Saved Queries</h3>
        </div>
      </div>
      <div className="divide-y divide-[var(--border-light)]">
        {savedQueries.map((q) => (
          <div
            key={q._id}
            className="flex items-center justify-between px-5 py-3 hover:bg-[var(--brand-light)]/20 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Clock className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(q.queryConfig) as QueryConfig;
                    onLoadQuery(parsed);
                    toast.success("Query loaded");
                  } catch {
                    toast.error("Failed to parse saved query");
                  }
                }}
                className="text-sm font-medium text-[var(--text-heading)] hover:text-[var(--brand-secondary)] truncate text-left"
              >
                {q.name}
              </button>
              {q.description && (
                <span className="text-[12px] text-[var(--text-muted)] truncate hidden sm:inline">
                  — {q.description}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {q.canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                  onClick={async () => {
                    try {
                      await deleteMutation({ queryId: q._id });
                      toast.success("Query deleted");
                    } catch {
                      toast.error("Failed to delete query");
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Need useMutation import
import { useMutation } from "convex/react";

// =============================================================================
// Page Content (hooks inside, wrapped with Suspense)
// =============================================================================

function AdminQueryBuilderContent() {
  const {
    config, setConfig, setTables, addColumn, removeColumn,
    addFilter, removeFilter, setFilterLogic, addJoin, removeJoin,
    addAggregation, removeAggregation, setGroupBy, setRowLimit,
    resetConfig, loadConfig,
    isDirty, undo, redo, canUndo, canRedo,
  } = useQueryBuilder({ isAdminMode: true, maxRowLimit: 500 });

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryResults, setQueryResults] = useState<{
    rows: Record<string, unknown>[];
    totalRows: number;
    page: Record<string, unknown>[];
    isDone: boolean;
    continueCursor: string | null;
    columns: Array<{ table: string; column: string; alias?: string }>;
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  // Fetch admin table metadata
  const metadata = useQuery(api.admin.queryBuilder.getTableMetadata);

  const executeQuery = useCallback(async () => {
    if (config.tables.length === 0) {
      toast.error("Select at least one table");
      return;
    }
    if (config.columns.length === 0) {
      toast.error("Select at least one column");
      return;
    }

    setIsExecuting(true);
    try {
      const result = await fetch("/api/admin-query-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, dateRange }),
      });
      const data = await result.json();
      if (!result.ok) {
        toast.error(data.error || "Query execution failed");
        return;
      }
      setQueryResults(data);
      setActiveStep(4);
      toast.success(`Query returned ${data.totalRows} rows`);
    } catch {
      toast.error("Failed to execute query");
    } finally {
      setIsExecuting(false);
    }
  }, [config, dateRange]);

  const handleLoadTemplate = useCallback((templateConfig: QueryConfig) => {
    loadConfig(templateConfig);
    setActiveStep(0);
    toast.success("Template loaded");
  }, [loadConfig]);

  const handleExport = useCallback(async () => {
    if (!queryResults) return;

    try {
      const response = await fetch("/api/admin-query-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: queryResults.columns,
          rows: queryResults.rows,
          queryInfo: { tables: config.tables, totalRows: queryResults.totalRows },
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Export failed");
        return;
      }

      if (data.csvBase64) {
        const blob = new Blob([atob(data.csvBase64)], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `admin-query-export-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Export downloaded");
      } else {
        toast.error("Export file too large for inline download");
      }
    } catch {
      toast.error("Export failed");
    }
  }, [queryResults, config]);

  // Check for PII columns in selected columns
  const hasPiiColumns = config.columns.some((c) =>
    c.column.toLowerCase().includes("email") || c.column.toLowerCase().includes("name")
  );

  // Build string[] column names for ResultsTable
  const resultColumnNames = queryResults?.columns.map((c) => c.alias || `${c.table}.${c.column}`) ?? [];

  const steps = [
    { label: "Tables", icon: Database },
    { label: "Columns", icon: Columns3 },
    { label: "Filters", icon: Filter },
    { label: "Results", icon: Sigma },
  ];

  return (
    <div className="space-y-6">
      {/* Admin Badge */}
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5">
            <Shield className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              Platform Admin — All Tenant Data
            </span>
          </div>
          {hasPiiColumns && queryResults && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                Results contain PII — export with caution
              </span>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Step indicators */}
      <FadeIn delay={80}>
        <div className="flex items-center gap-2">
          {steps.map((step, i) => (
            <React.Fragment key={step.label}>
              {i > 0 && <div className="h-px w-6 bg-border" />}
              <button
                onClick={() => setActiveStep(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors",
                  activeStep === i
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <step.icon className="h-3.5 w-3.5" />
                {step.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      </FadeIn>

      {/* Controls Bar */}
      <FadeIn delay={160}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={executeQuery}
            disabled={isExecuting || config.tables.length === 0}
          >
            {isExecuting ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Running...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5" />
                Execute
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveDialog(true)}
            disabled={config.tables.length === 0}
          >
            Save
          </Button>

          <Button variant="outline" size="sm" onClick={() => resetConfig()}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>

          <div className="flex gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
            >
              Undo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redo}
              disabled={!canRedo}
            >
              Redo
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Template Gallery */}
      <FadeIn delay={100}>
        <div className="bg-white rounded-xl border border-[var(--border-light)] p-4">
          <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-3">Quick Templates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ADMIN_TEMPLATES.map((template) => (
              <button
                key={template.name}
                onClick={() => handleLoadTemplate(template.config)}
                className="flex items-start gap-2.5 rounded-lg border border-[var(--border-light)] p-3 text-left hover:bg-[var(--brand-light)]/20 transition-colors group"
              >
                <Link2 className="w-4 h-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-heading)] group-hover:text-[var(--brand-secondary)] truncate">
                    {template.name}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] line-clamp-1">
                    {template.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Step 0: Table Selection */}
      <FadeIn delay={200}>
        <TableSelector
          selectedTables={config.tables}
          onSelectionChange={setTables}
          isAdminMode
          availableTables={ADMIN_TABLE_NAMES}
        />
      </FadeIn>

      {/* Step 1: Column Selection */}
      {config.tables.length > 0 && (
        <FadeIn delay={240}>
          <ColumnSelector
            selectedTables={config.tables}
            selectedColumns={config.columns}
            onSelectionChange={(cols) => {
              setConfig({ ...config, columns: cols });
            }}
          />
        </FadeIn>
      )}

      {/* Step 1b: Joins */}
      {config.tables.length > 0 && metadata && metadata.suggestedJoins.length > 0 && (
        <FadeIn delay={260}>
          <JoinBuilder
            selectedTables={config.tables}
            joins={config.joins}
            onAddJoin={addJoin}
            onRemoveJoin={removeJoin}
          />
        </FadeIn>
      )}

      {/* Step 2: Filters */}
      {config.tables.length > 0 && config.columns.length > 0 && (
        <FadeIn delay={280}>
          <FilterBuilder
            selectedTables={config.tables}
            filters={config.filters}
            filterLogic={config.filterLogic}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
            onUpdateFilter={(id, updates) => {
              setConfig({
                ...config,
                filters: config.filters.map((f) => (f.id === id ? { ...f, ...updates } : f)),
              });
            }}
            onSetFilterLogic={setFilterLogic}
          />
        </FadeIn>
      )}

      {/* Aggregations + GroupBy */}
      {config.columns.length > 0 && (
        <FadeIn delay={320}>
          <AggregationBuilder
            selectedTables={config.tables}
            aggregations={config.aggregations}
            groupBy={config.groupBy}
            onAddAggregation={addAggregation}
            onRemoveAggregation={removeAggregation}
            onSetGroupBy={setGroupBy}
          />
        </FadeIn>
      )}

      {/* Step 3: Results */}
      {queryResults && (
        <FadeIn delay={360}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {queryResults.totalRows === queryResults.rows.length ? (
                  `${queryResults.totalRows} results`
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Showing {queryResults.page.length} of ~{queryResults.totalRows} results
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
            <ResultsTable
              results={queryResults.rows}
              columns={resultColumnNames}
              isLoading={false}
              totalRows={queryResults.totalRows}
            />
          </div>
        </FadeIn>
      )}

      {/* Saved Queries */}
      <FadeIn delay={400}>
        <AdminSavedQueriesSection onLoadQuery={handleLoadTemplate} />
      </FadeIn>

      {/* Save Dialog */}
      <SaveQueryDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        config={config}
      />
    </div>
  );
}

// =============================================================================
// Page Export (with Suspense wrapper)
// =============================================================================

export default function AdminQueryBuilderPage() {
  return (
    <div>
      <PageTopbar description="Cross-tenant ad-hoc query tool for platform admins">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          Query Builder
        </h1>
      </PageTopbar>

      {/* Breadcrumb */}
      <div className="px-8 pt-4">
        <nav className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
          <Link href="/tenants" className="hover:text-[var(--text-heading)]">Admin</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[var(--text-heading)]">Query Builder</span>
        </nav>
      </div>

      <div className="px-8 pt-4 pb-8">
        <Suspense fallback={<AdminQueryBuilderSkeleton />}>
          <AdminQueryBuilderContent />
        </Suspense>
      </div>
    </div>
  );
}
