"use client";

import { useState, useEffect } from "react";
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
import { FilterBuilderSkeleton } from "./skeletons";
import { generateId } from "@/hooks/useQueryBuilder";
import type { QueryConfig, FilterOperator } from "@/hooks/useQueryBuilder";
import { Plus, Trash2 } from "lucide-react";

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
  onAddFilter: (filter: QueryConfig["filters"][0]) => void;
  onRemoveFilter: (id: string) => void;
  onUpdateFilter: (id: string, updates: Partial<QueryConfig["filters"][0]>) => void;
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

function getColumnType(
  tables: TableMeta[],
  tableName: string,
  columnName: string
): string {
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
  onAddFilter,
  onRemoveFilter,
  onUpdateFilter,
}: FilterBuilderProps) {
  const metadata = useQuery(api.queryBuilder.getTableMetadata);
  // Handle both old (flat array) and new ({ tables, suggestedJoins }) return shape
  const tables = (Array.isArray(metadata) ? metadata : metadata?.tables ?? []) as unknown as TableMeta[];

  const [newFilterTable, setNewFilterTable] = useState("");
  const [newFilterColumn, setNewFilterColumn] = useState("");
  const [newFilterOperator, setNewFilterOperator] = useState<FilterOperator>("equals");
  const [newFilterValue, setNewFilterValue] = useState("");
  const [newFilterValueTo, setNewFilterValueTo] = useState("");

  // Auto-select first table when selectedTables change and local state is empty
  useEffect(() => {
    if (selectedTables.length > 0 && !newFilterTable) {
      setNewFilterTable(selectedTables[0]);
    }
  }, [selectedTables, newFilterTable]);

  if (!metadata) {
    return <FilterBuilderSkeleton />;
  }

  const relevantTables = tables.filter((t) => selectedTables.includes(t.name));

  const handleAdd = () => {
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
  };

  const renderFilterValue = (filter: QueryConfig["filters"][0]) => {
    if (filter.operator === "is_null" || filter.operator === "is_not_null") {
      return null;
    }
    if (filter.operator === "in_list") {
      return (
        <Badge variant="outline" className="text-[11px] max-w-[200px]">
          {filter.values?.join(", ")}
        </Badge>
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
      <span className="text-[13px] text-[var(--text-body)]">
        {String(filter.value)}
      </span>
    );
  };

  const selectedTableMeta = tables.find((t) => t.name === newFilterTable);
  const selectedColType = newFilterColumn
    ? getColumnType(tables, newFilterTable, newFilterColumn)
    : "string";

  return (
    <div className="space-y-4">
      {filters.length > 0 && (
        <div className="space-y-2">
          {filters.map((filter) => {
            const op = OPERATORS.find((o) => o.value === filter.operator);
            return (
              <div
                key={filter.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              >
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
                  {renderFilterValue(filter)}
                </div>
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

      {relevantTables.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-[var(--border)] p-3 bg-gray-50/50">
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
                {selectedTableMeta?.columns.map((col) => (
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
                <Input
                  size={undefined}
                  placeholder="val1, val2, ..."
                  value={newFilterValue}
                  onChange={(e) => setNewFilterValue(e.target.value)}
                  className="h-8 text-[13px]"
                />
              ) : (
                <Input
                  size={undefined}
                  type={selectedColType === "number" ? "number" : selectedColType === "date" ? "date" : "text"}
                  placeholder={
                    selectedColType === "boolean" ? "true / false" : "Value"
                  }
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
          {!newFilterTable && (
            <span className="text-[11px] text-[var(--text-muted)] self-center ml-1">Pick a table above</span>
          )}
          {newFilterTable && !newFilterColumn && (
            <span className="text-[11px] text-[var(--text-muted)] self-center ml-1">Now pick a column</span>
          )}
          {newFilterTable && newFilterColumn && needsValue(newFilterOperator) && !newFilterValue && (
            <span className="text-[11px] text-[var(--text-muted)] self-center ml-1">Enter a value to enable</span>
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
