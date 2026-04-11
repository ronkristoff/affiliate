"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterBuilderSkeleton } from "./skeletons";
import { generateId } from "@/hooks/useQueryBuilder";
import type { QueryConfig, FilterOperator } from "@/hooks/useQueryBuilder";
import { Plus, Trash2, Pencil, Check, X, Link2, Sparkles } from "lucide-react";
import { DATE_PRESETS } from "@/lib/date-presets";

interface ColumnMeta {
  name: string;
  type: string;
  label?: string;
}

interface TableMeta {
  name: string;
  label: string;
  columns: ColumnMeta[];
}

interface FilterBuilderProps {
  selectedTables: string[];
  filters: QueryConfig["filters"];
  filterLogic: "and" | "or";
  onAddFilter: (filter: QueryConfig["filters"][0]) => void;
  onRemoveFilter: (id: string) => void;
  onUpdateFilter: (id: string, updates: Partial<QueryConfig["filters"][0]>) => void;
  onSetFilterLogic: (logic: "and" | "or") => void;
}

const OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Not Contains" },
  { value: "gt", label: "Greater Than" },
  { value: "gte", label: "Greater Than or Equal" },
  { value: "lt", label: "Less Than" },
  { value: "lte", label: "Less Than or Equal" },
  { value: "between", label: "Between" },
  { value: "in_list", label: "In List" },
  { value: "is_null", label: "Is Null" },
  { value: "is_not_null", label: "Is Not Null" },
];

function getColumnType(tables: TableMeta[], tableName: string, columnName: string): string {
  const table = tables.find((t) => t.name === tableName);
  const col = table?.columns.find((c) => c.name === columnName);
  return col?.type ?? "string";
}

function needsValue(operator: string): boolean {
  return !["is_null", "is_not_null"].includes(operator);
}

export function FilterBuilder({
  selectedTables,
  filters,
  filterLogic,
  onAddFilter,
  onRemoveFilter,
  onUpdateFilter,
  onSetFilterLogic,
}: FilterBuilderProps) {
  const metadata = useQuery(api.queryBuilder.getTableMetadata);
  const tables = (Array.isArray(metadata) ? metadata : metadata?.tables ?? []) as unknown as TableMeta[];

  const [newFilterTable, setNewFilterTable] = useState("");
  const [newFilterColumn, setNewFilterColumn] = useState("");
  const [newFilterOperator, setNewFilterOperator] = useState<FilterOperator>("equals");
  const [newFilterValue, setNewFilterValue] = useState("");
  const [newFilterValueTo, setNewFilterValueTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // All hooks before conditional return
  const relevantTables = metadata
    ? tables.filter((t) => selectedTables.includes(t.name))
    : [];

  const selectedTableMeta = tables.find((t) => t.name === newFilterTable);
  const selectedColType = newFilterColumn
    ? getColumnType(tables, newFilterTable, newFilterColumn)
    : "string";

  // Fetch distinct values for the selected column (for suggestions)
  const showSuggestions = !!newFilterTable && !!newFilterColumn &&
    selectedColType === "string" && newFilterOperator !== "between" &&
    needsValue(newFilterOperator);

  const distinctValues = useQuery(
    api.queryBuilder.getDistinctColumnValues,
    showSuggestions
      ? { tableName: newFilterTable, columnName: newFilterColumn }
      : "skip"
  ) as Array<{ value: string | number | boolean; count: number }>;

  useEffect(() => {
    if (selectedTables.length > 0 && !newFilterTable) {
      setNewFilterTable(selectedTables[0]);
    }
  }, [selectedTables, newFilterTable]);

  const handleAdd = useCallback(() => {
    if (!newFilterTable || !newFilterColumn) return;
    const operator = newFilterOperator;
    const colType = getColumnType(tables, newFilterTable, newFilterColumn);

    const filter: QueryConfig["filters"][0] = {
      id: generateId(),
      table: newFilterTable,
      column: newFilterColumn,
      operator,
    };

    if (operator === "between") {
      if (colType === "number") {
        filter.value = parseFloat(newFilterValue) || 0;
        filter.valueTo = parseFloat(newFilterValueTo) || 0;
      } else {
        filter.value = newFilterValue;
        filter.valueTo = newFilterValueTo;
      }
    } else if (operator === "in_list") {
      filter.values = newFilterValue.split(",").map((v) => v.trim());
    } else if (needsValue(operator)) {
      if (colType === "number") {
        filter.value = parseFloat(newFilterValue) || 0;
      } else if (colType === "boolean") {
        filter.value = newFilterValue.toLowerCase() === "true";
      } else {
        filter.value = newFilterValue;
      }
    }

    onAddFilter(filter);
    setNewFilterColumn("");
    setNewFilterValue("");
    setNewFilterValueTo("");
  }, [newFilterTable, newFilterColumn, newFilterOperator, newFilterValue, newFilterValueTo, tables, onAddFilter]);

  if (!metadata) {
    return <FilterBuilderSkeleton />;
  }

  const startEditing = (filterId: string) => setEditingId(filterId);
  const cancelEditing = () => setEditingId(null);

  const handleEditSave = (filter: QueryConfig["filters"][0], updates: Record<string, unknown>) => {
    onUpdateFilter(filter.id, updates);
    setEditingId(null);
  };

  const handleSuggestionClick = (value: string | number | boolean) => {
    if (newFilterOperator === "in_list") {
      const existing = newFilterValue ? newFilterValue.split(",").map((v) => v.trim()) : [];
      if (!existing.includes(String(value))) {
        setNewFilterValue(existing.length > 0 ? `${newFilterValue}, ${value}` : String(value));
      }
    } else {
      setNewFilterValue(String(value));
    }
  };

  // Check if a value is already selected (for in_list)
  const isValueSelected = (value: string | number | boolean) => {
    if (newFilterOperator !== "in_list" || !newFilterValue) return false;
    return newFilterValue.split(",").map((v) => v.trim()).includes(String(value));
  };

  return (
    <div className="space-y-4">
      {/* AND/OR Logic Toggle */}
      {filters.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Match
          </span>
          <div className="flex items-center gap-1 bg-[var(--muted)] rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetFilterLogic("and")}
              className={cn(
                "h-6 text-[11px] font-medium rounded-md px-2.5",
                filterLogic === "and"
                  ? "bg-white text-[#1c2260] shadow-sm hover:bg-white hover:text-[#1c2260]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-heading)]"
              )}
            >
              <Link2 className="w-3 h-3 mr-1" />
              All conditions
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetFilterLogic("or")}
              className={cn(
                "h-6 text-[11px] font-medium rounded-md px-2.5",
                filterLogic === "or"
                  ? "bg-white text-[#1c2260] shadow-sm hover:bg-white hover:text-[#1c2260]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-heading)]"
              )}
            >
              Any condition
            </Button>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            ({filters.length} filter{filters.length !== 1 ? "s" : ""})
          </span>
        </div>
      )}

      {/* Filter List */}
      {filters.length > 0 && (
        <div className="space-y-2">
          {filters.map((filter, index) => {
            const op = OPERATORS.find((o) => o.value === filter.operator);
            const isEditing = editingId === filter.id;

            if (isEditing) {
              return (
                <EditableFilterRow
                  key={filter.id}
                  filter={filter}
                  tables={tables}
                  index={index}
                  filterLogic={filterLogic}
                  onSave={handleEditSave}
                  onCancel={cancelEditing}
                  onRemove={onRemoveFilter}
                />
              );
            }

            return (
              <div
                key={filter.id}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 group shadow-sm"
              >
                {index > 0 && (
                  <span className="text-[10px] font-bold text-[#1fb5a5] uppercase shrink-0 w-6">
                    {filterLogic}
                  </span>
                )}
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {filter.table}
                </Badge>
                <span className="text-[13px] text-[var(--text-heading)] font-medium truncate">
                  {filter.column}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {op?.label ?? filter.operator}
                </span>
                <div className="flex-1 min-w-0">
                  <FilterValueDisplay filter={filter} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-[var(--text-muted)] hover:text-[#1c2260] opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => startEditing(filter.id)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-[var(--text-muted)] hover:text-red-500"
                  onClick={() => onRemoveFilter(filter.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Filter Form */}
      {relevantTables.length > 0 && (
        <div className="space-y-3 rounded-xl p-3 bg-[var(--muted)]/30 shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[130px]">
              <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1 block">
                Table
              </label>
              <Select value={newFilterTable} onValueChange={(v) => { setNewFilterTable(v); setNewFilterColumn(""); }}>
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
              <Select value={newFilterColumn} onValueChange={setNewFilterColumn}>
                <SelectTrigger size="sm" className="w-full" disabled={!newFilterTable}>
                  <SelectValue placeholder="Column" />
                </SelectTrigger>
                <SelectContent>
                  {selectedTableMeta?.columns
                    .filter((c) => c.type !== "id")
                    .map((col) => (
                      <SelectItem key={col.name} value={col.name}>
                        {col.label ?? col.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[150px]">
              <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1 block">
                Operator
              </label>
              <Select value={newFilterOperator} onValueChange={(v) => setNewFilterOperator(v as FilterOperator)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsValue(newFilterOperator) && (
              <div className="min-w-[130px]">
                <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1 block">
                  Value
                </label>
                {newFilterOperator === "in_list" ? (
                  <div>
                    <Input
                      size={undefined}
                      placeholder="val1, val2, ..."
                      value={newFilterValue}
                      onChange={(e) => setNewFilterValue(e.target.value)}
                      className="h-8 text-[13px]"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      Separate values with commas
                    </p>
                  </div>
                ) : (
                  <Input
                    size={undefined}
                    type={selectedColType === "number" ? "number" : selectedColType === "date" ? "date" : "text"}
                    placeholder={selectedColType === "boolean" ? "true / false" : "Value"}
                    value={newFilterValue}
                    onChange={(e) => setNewFilterValue(e.target.value)}
                    className="h-8 text-[13px]"
                  />
                )}
              </div>
            )}

            {newFilterOperator === "between" && needsValue(newFilterOperator) && (
              <div className="min-w-[130px]">
                <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1 block">
                  To
                </label>
                <Input
                  size={undefined}
                  type={selectedColType === "number" ? "number" : selectedColType === "date" ? "date" : "text"}
                  placeholder="To value"
                  value={newFilterValueTo}
                  onChange={(e) => setNewFilterValueTo(e.target.value)}
                  className="h-8 text-[13px]"
                />
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={!newFilterTable || !newFilterColumn || (!needsValue(newFilterOperator) ? false : !newFilterValue)}
              className="h-8"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>

          {/* Value Suggestions */}
          {showSuggestions && distinctValues && distinctValues.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Suggested values
              </span>
              <div className="flex flex-wrap gap-1.5">
                {distinctValues && distinctValues.slice(0, 15).map((dv: { value: string | number | boolean; count: number }) => (
                  <button
                    key={String(dv.value)}
                    type="button"
                    onClick={() => handleSuggestionClick(dv.value)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-medium transition-all",
                      isValueSelected(dv.value)
                        ? "bg-[#1c2260] text-white"
                        : "bg-white border border-[var(--border)] text-[var(--text-body)] hover:border-[#1fb5a5]/40 hover:bg-[#eff6ff]"
                    )}
                  >
                    {String(dv.value)}
                    <span className="ml-1 text-[var(--text-muted)]">({dv.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton for suggestions */}
          {showSuggestions && !distinctValues && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Loading values...
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-6 w-16 rounded-md" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {relevantTables.length === 0 && filters.length === 0 && (
        <div className="text-center py-6 text-[var(--text-muted)] text-sm">
          Select tables first to add filters.
        </div>
      )}
    </div>
  );
}

// ─── Read-only filter value display ─────────────────────────────
function FilterValueDisplay({ filter }: { filter: QueryConfig["filters"][0] }) {
  if (filter.operator === "is_null" || filter.operator === "is_not_null") {
    return null;
  }
  if (filter.operator === "in_list") {
    return (
      <div className="flex flex-wrap gap-1">
        {filter.values?.map((v, i) => (
          <Badge key={i} variant="secondary" className="text-[11px]">
            {String(v)}
          </Badge>
        ))}
      </div>
    );
  }
  if (filter.operator === "between") {
    return (
      <span className="text-[13px] text-[var(--text-body)]">
        {String(filter.value)} — {String(filter.valueTo)}
      </span>
    );
  }
  return (
    <span className="text-[13px] text-[var(--text-body)] font-medium">
      {String(filter.value)}
    </span>
  );
}

// ─── Inline editable filter row ─────────────────────────────────
function EditableFilterRow({
  filter,
  tables,
  index,
  filterLogic,
  onSave,
  onCancel,
  onRemove,
}: {
  filter: QueryConfig["filters"][0];
  tables: TableMeta[];
  index: number;
  filterLogic: "and" | "or";
  onSave: (filter: QueryConfig["filters"][0], updates: Record<string, unknown>) => void;
  onCancel: () => void;
  onRemove: (id: string) => void;
}) {
  const [editOperator, setEditOperator] = useState<FilterOperator>(filter.operator);
  const [editValue, setEditValue] = useState(
    filter.operator === "in_list" ? (filter.values ?? []).join(", ") : String(filter.value ?? "")
  );
  const [editValueTo, setEditValueTo] = useState(String(filter.valueTo ?? ""));

  const colType = getColumnType(tables, filter.table, filter.column);

  const handleSave = () => {
    const updates: Record<string, unknown> = { operator: editOperator };

    if (editOperator === "between") {
      if (colType === "number") {
        updates.value = parseFloat(editValue) || 0;
        updates.valueTo = parseFloat(editValueTo) || 0;
      } else {
        updates.value = editValue;
        updates.valueTo = editValueTo;
      }
    } else if (editOperator === "in_list") {
      updates.values = editValue.split(",").map((v) => v.trim());
    } else if (needsValue(editOperator)) {
      if (colType === "number") {
        updates.value = parseFloat(editValue) || 0;
      } else if (colType === "boolean") {
        updates.value = editValue.toLowerCase() === "true";
      } else {
        updates.value = editValue;
      }
    } else {
      updates.value = undefined;
      updates.valueTo = undefined;
      updates.values = undefined;
    }

    onSave(filter, updates);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div
      key={filter.id}
      className="rounded-lg bg-[#eff6ff] px-3 py-2"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2 mb-2">
        {index > 0 && (
          <span className="text-[10px] font-bold text-[#1fb5a5] uppercase shrink-0 w-6">
            {filterLogic}
          </span>
        )}
        <Badge variant="outline" className="text-[10px] shrink-0">
          {filter.table}
        </Badge>
        <span className="text-[13px] text-[var(--text-heading)] font-medium">
          {filter.column}
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[150px]">
          <label className="text-[10px] font-medium text-[var(--text-muted)] mb-1 block">
            Operator
          </label>
          <Select value={editOperator} onValueChange={(v) => setEditOperator(v as FilterOperator)}>
            <SelectTrigger size="sm" className="w-full h-7 text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {needsValue(editOperator) && (
          <div className="min-w-[130px]">
            <label className="text-[10px] font-medium text-[var(--text-muted)] mb-1 block">
              Value
            </label>
            <Input
              size={undefined}
              type={colType === "number" ? "number" : "text"}
              placeholder="Value"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 text-[12px]"
              autoFocus
            />
          </div>
        )}

        {editOperator === "between" && (
          <div className="min-w-[130px]">
            <label className="text-[10px] font-medium text-[var(--text-muted)] mb-1 block">
              To
            </label>
            <Input
              size={undefined}
              type={colType === "number" ? "number" : "text"}
              placeholder="To value"
              value={editValueTo}
              onChange={(e) => setEditValueTo(e.target.value)}
              className="h-7 text-[12px]"
            />
          </div>
        )}

        {editOperator === "in_list" && (
          <p className="text-[10px] text-[var(--text-muted)] self-center">
            Separate with commas
          </p>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            onClick={handleSave}
          >
            <Check className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 text-[var(--text-muted)]"
            onClick={onCancel}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--text-muted)] hover:text-red-500"
            onClick={() => onRemove(filter.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
