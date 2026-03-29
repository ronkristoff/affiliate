"use client";

import { Suspense, useState, useCallback } from "react";
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
  X,
} from "lucide-react";
import { toast } from "sonner";

type Mode = "wizard" | "advanced";

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
        {/* Tables */}
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

        {/* Columns */}
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

        {/* Filters */}
        {config.filters.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Filters ({config.filters.length})
            </span>
            <div className="flex flex-wrap gap-1">
              {config.filters.map((f) => (
                <Badge key={f.id} variant="secondary" className="text-[11px] font-mono gap-0.5">
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

        {/* Joins */}
        {config.joins.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Joins ({config.joins.length}/3)
            </span>
            <div className="flex flex-wrap gap-1">
              {config.joins.map((j) => (
                <Badge key={j.id} variant="outline" className="text-[11px] font-mono gap-0.5">
                  <Link2 className="w-2.5 h-2.5 opacity-50" />
                  {j.leftTable}.{j.leftField}
                  <span className="text-[#1659d6] mx-0.5">=</span>
                  {j.rightTable}.{j.rightField}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Aggregations */}
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

        {/* Group By */}
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

      {/* Raw JSON toggle for debugging */}
      <details className="group">
        <summary className="text-[11px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-heading)] transition-colors select-none">
          Show raw JSON
        </summary>
        <pre className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-mono text-gray-600 overflow-x-auto max-h-[200px] overflow-y-auto">
          {configJson}
        </pre>
      </details>
    </div>
  );
}

function QueryBuilderContent() {
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;

  const [mode, setMode] = useState<Mode>("wizard");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [shareDialogQueryId, setShareDialogQueryId] = useState<string | null>(null);

  const {
    config,
    setTables,
    addColumn,
    removeColumn,
    addFilter,
    removeFilter,
    updateFilter,
    addJoin,
    removeJoin,
    addAggregation,
    removeAggregation,
    setGroupBy,
    resetConfig,
    loadConfig,
    configJson,
  } = useQueryBuilder();

  const queryArgs = {
    tables: config.tables,
    columns: config.columns,
    filters: config.filters.length > 0 ? config.filters : undefined,
    joins: config.joins.length > 0 ? config.joins : undefined,
    aggregations: config.aggregations.length > 0 ? config.aggregations : undefined,
    groupBy: config.groupBy.length > 0 ? config.groupBy : undefined,
  };

  const hasValidConfig =
    config.tables.length > 0 && config.columns.length > 0;

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
    setHasRunQuery(true);
  };

  const handleSelectTemplate = useCallback((templateConfig: QueryConfig) => {
    loadConfig(templateConfig);
    setMode("advanced");
    setHasRunQuery(false);
    toast.success("Template loaded");
  }, [loadConfig]);

  const handleLoadQuery = useCallback((loadedConfig: QueryConfig) => {
    loadConfig(loadedConfig);
    setHasRunQuery(false);
  }, [loadConfig]);

  const handleReset = () => {
    resetConfig();
    setHasRunQuery(false);
    toast.success("Query reset");
  };

  const resultColumns = (() => {
    if (results && results.rows.length > 0) {
      // Derive from actual data keys — always matches what's in the rows
      return Object.keys(results.rows[0]).filter((k) => !k.startsWith("_"));
    }
    // Fallback to config columns before query runs
    return config.columns.map((c) => c.alias || `${c.table}.${c.column}`);
  })();

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
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setMode("wizard")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                mode === "wizard"
                  ? "bg-white text-[#10409a] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-heading)]"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Wizard
            </button>
            <button
              type="button"
              onClick={() => setMode("advanced")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                mode === "advanced"
                  ? "bg-white text-[#10409a] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-heading)]"
              )}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Advanced
            </button>
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
            <Button
              size="sm"
              onClick={handleRunQuery}
              disabled={!hasValidConfig}
              className="gap-1.5"
            >
              <Play className="w-3 h-3" />
              Run Query
            </Button>
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
                    onAddFilter={addFilter}
                    onRemoveFilter={removeFilter}
                    onUpdateFilter={updateFilter}
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
