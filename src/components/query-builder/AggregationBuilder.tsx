"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AggregationBuilderSkeleton } from "./skeletons";
import { generateId } from "@/hooks/useQueryBuilder";
import type { QueryConfig } from "@/hooks/useQueryBuilder";
import { Plus, Trash2, Sigma, AlertCircle } from "lucide-react";

interface TableMeta {
  name: string;
  label: string;
  columns: Array<{ name: string; type: string; label?: string }>;
}

interface AggregationBuilderProps {
  selectedTables: string[];
  aggregations: QueryConfig["aggregations"];
  groupBy: QueryConfig["groupBy"];
  onAddAggregation: (agg: QueryConfig["aggregations"][0]) => void;
  onRemoveAggregation: (id: string) => void;
  onSetGroupBy: (groupBy: QueryConfig["groupBy"]) => void;
}

const AGG_FUNCTIONS = [
  { value: "COUNT", label: "COUNT" },
  { value: "SUM", label: "SUM" },
  { value: "AVG", label: "AVG" },
  { value: "MIN", label: "MIN" },
  { value: "MAX", label: "MAX" },
] as const;

export function AggregationBuilder({
  selectedTables,
  aggregations,
  groupBy,
  onAddAggregation,
  onRemoveAggregation,
  onSetGroupBy,
}: AggregationBuilderProps) {
  const metadata = useQuery(api.queryBuilder.getTableMetadata);
  const tables = (Array.isArray(metadata) ? metadata : metadata?.tables ?? []) as unknown as TableMeta[];

  const [aggTable, setAggTable] = useState("");
  const [aggColumn, setAggColumn] = useState("");
  const [aggFunction, setAggFunction] = useState<string>("COUNT");
  const [aggAlias, setAggAlias] = useState("");

  if (!metadata) {
    return <AggregationBuilderSkeleton />;
  }

  const relevantTables = tables.filter((t) => selectedTables.includes(t.name));
  const selectedAggTableMeta = tables.find((t) => t.name === aggTable);

  // Compute the auto-generated alias preview
  const autoAlias = useMemo(() => {
    if (!aggColumn || !aggFunction) return "";
    return `${aggFunction.toLowerCase()}_${aggColumn}`;
  }, [aggFunction, aggColumn]);

  const handleAdd = () => {
    if (!aggTable || !aggColumn) return;
    const alias = aggAlias || autoAlias;
    onAddAggregation({
      id: generateId(),
      table: aggTable,
      column: aggColumn,
      function: aggFunction as QueryConfig["aggregations"][0]["function"],
      alias,
    });
    setAggColumn("");
    setAggAlias("");
  };

  const availableGroupByColumns = relevantTables.flatMap((t) =>
    t.columns.map((col) => ({
      table: t.name,
      column: col.name,
      label: `${t.label}.${col.label ?? col.name}`,
    }))
  );

  const isGroupBySelected = (table: string, column: string) =>
    groupBy.some((g) => g.table === table && g.column === column);

  const handleToggleGroupBy = (table: string, column: string) => {
    if (isGroupBySelected(table, column)) {
      onSetGroupBy(groupBy.filter((g) => !(g.table === table && g.column === column)));
    } else {
      onSetGroupBy([...groupBy, { table, column }]);
    }
  };

  const showNoGroupByWarning = aggregations.length > 0 && groupBy.length === 0;

  return (
    <div className="space-y-6">
      {/* Warning when aggregations exist without GROUP BY */}
      {showNoGroupByWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">No GROUP BY selected</span>{" "}
            — your aggregation will return a single summary row. Add GROUP BY columns below to get per-category results.
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sigma className="w-4 h-4 text-[#10409a]" />
          <span className="text-sm font-semibold text-[var(--text-heading)]">Aggregations</span>
          {aggregations.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {aggregations.length}
            </Badge>
          )}
        </div>

        {aggregations.length > 0 && (
          <div className="space-y-2 mb-3">
            {aggregations.map((agg) => {
              const tableLabel = tables.find((t) => t.name === agg.table)?.label ?? agg.table;
              return (
                <div
                  key={agg.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                >
                  <Badge variant="brand" className="text-[10px] px-1.5 py-0">
                    {agg.function}
                  </Badge>
                  <span className="text-[13px] text-[var(--text-body)]">
                    {tableLabel}.{agg.column}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    as {agg.alias}
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-[var(--text-muted)] hover:text-red-500"
                    onClick={() => onRemoveAggregation(agg.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {relevantTables.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-[var(--border)] p-3 bg-[var(--muted)]/30">
            <div className="min-w-[110px]">
              <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1 block">
                Function
              </label>
              <Select value={aggFunction} onValueChange={setAggFunction}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGG_FUNCTIONS.map((fn) => (
                    <SelectItem key={fn.value} value={fn.value}>
                      {fn.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[130px]">
              <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1 block">
                Table
              </label>
              <Select value={aggTable} onValueChange={(v) => { setAggTable(v); setAggColumn(""); }}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Table" />
                </SelectTrigger>
                <SelectContent>
                  {relevantTables.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[130px]">
              <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1 block">
                Column
              </label>
              <Select value={aggColumn} onValueChange={setAggColumn}>
                <SelectTrigger size="sm" className="w-full" disabled={!aggTable}>
                  <SelectValue placeholder="Column" />
                </SelectTrigger>
                <SelectContent>
                  {selectedAggTableMeta?.columns.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.label ?? col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[130px]">
              <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1 block">
                Alias
              </label>
              <div className="relative">
                <Input
                  size={undefined}
                  placeholder="Auto-generated"
                  value={aggAlias}
                  onChange={(e) => setAggAlias(e.target.value)}
                  className="h-8 text-[13px] pr-[72px]"
                />
                {autoAlias && !aggAlias && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] pointer-events-none">
                    → {autoAlias}
                  </span>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={!aggTable || !aggColumn}
              className="h-8"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-[var(--text-heading)]">Group By</span>
          {groupBy.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {groupBy.length}
            </Badge>
          )}
        </div>

        {availableGroupByColumns.length > 0 ? (
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {availableGroupByColumns.map((col) => {
              const checked = isGroupBySelected(col.table, col.column);
              return (
                <label
                  key={`${col.table}.${col.column}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5 cursor-pointer transition-all duration-150",
                    checked ? "bg-[#eff6ff] border border-[#10409a]/20" : "hover:bg-[var(--hover)] border border-transparent"
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={() => handleToggleGroupBy(col.table, col.column)} />
                  <span className="text-[13px] text-[var(--text-body)]">{col.label}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 text-[var(--text-muted)] text-sm">
            Select tables to configure GROUP BY.
          </div>
        )}
      </div>
    </div>
  );
}
