"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { JoinBuilderSkeleton } from "./skeletons";
import { generateId } from "@/hooks/useQueryBuilder";
import type { QueryConfig } from "@/hooks/useQueryBuilder";
import { Plus, Trash2, AlertTriangle, Zap } from "lucide-react";

interface TableMeta {
  name: string;
  label: string;
  columns: Array<{ name: string; type: string; label?: string }>;
}

interface SuggestedJoin {
  leftTable: string;
  leftField: string;
  rightTable: string;
  rightField: string;
  label: string;
}

interface JoinBuilderProps {
  selectedTables: string[];
  joins: QueryConfig["joins"];
  onAddJoin: (join: QueryConfig["joins"][0]) => void;
  onRemoveJoin: (id: string) => void;
}

const MAX_JOINS = 3;

export function JoinBuilder({
  selectedTables,
  joins,
  onAddJoin,
  onRemoveJoin,
}: JoinBuilderProps) {
  const metadata = useQuery(api.queryBuilder.getTableMetadata);

  const [leftTable, setLeftTable] = useState("");
  const [rightTable, setRightTable] = useState("");
  const [leftField, setLeftField] = useState("");
  const [rightField, setRightField] = useState("");

  // Auto-select first two tables when selectedTables change and locals are empty
  useEffect(() => {
    if (selectedTables.length >= 2 && !leftTable && !rightTable) {
      setLeftTable(selectedTables[0]);
      setRightTable(selectedTables[1]);
    }
  }, [selectedTables, leftTable, rightTable]);

  if (!metadata) {
    return <JoinBuilderSkeleton />;
  }

  // Handle both old (flat array) and new ({ tables, suggestedJoins }) return shape
  const tables = (Array.isArray(metadata) ? metadata : metadata.tables ?? []) as unknown as TableMeta[];
  const suggestedJoins = (Array.isArray(metadata) ? [] : metadata.suggestedJoins ?? []) as SuggestedJoin[];

  const relevantTables = tables.filter((t) => selectedTables.includes(t.name));
  const isAtLimit = joins.length >= MAX_JOINS;

  // Filter suggested joins to only those where both tables are selected
  // and the join hasn't already been added
  const existingJoinKeys = new Set(
    joins.map((j) => `${j.leftTable}.${j.leftField}.${j.rightTable}.${j.rightField}`)
  );
  const availableSuggestions = suggestedJoins.filter(
    (sj) =>
      selectedTables.includes(sj.leftTable) &&
      selectedTables.includes(sj.rightTable) &&
      !existingJoinKeys.has(`${sj.leftTable}.${sj.leftField}.${sj.rightTable}.${sj.rightField}`)
  );

  const handleAddSuggested = (sj: SuggestedJoin) => {
    if (isAtLimit) return;
    onAddJoin({
      id: generateId(),
      leftTable: sj.leftTable,
      rightTable: sj.rightTable,
      leftField: sj.leftField,
      rightField: sj.rightField,
    });
  };

  const handleAdd = () => {
    if (!leftTable || !rightTable || !leftField || !rightField) return;
    if (isAtLimit) return;
    onAddJoin({
      id: generateId(),
      leftTable,
      rightTable,
      leftField,
      rightField,
    });
    setLeftField("");
    setRightField("");
  };

  const leftTableMeta = tables.find((t) => t.name === leftTable);
  const rightTableMeta = tables.find((t) => t.name === rightTable);

  return (
    <div className="space-y-4">
      {joins.length > 0 && (
        <div className="space-y-2">
          {joins.map((join) => {
            const leftLabel = tables.find((t) => t.name === join.leftTable)?.label ?? join.leftTable;
            const rightLabel = tables.find((t) => t.name === join.rightTable)?.label ?? join.rightTable;
            const leftColLabel = leftTableMeta?.columns.find((c) => c.name === join.leftField)?.label ?? join.leftField;
            const rightColLabel = tables.find((t) => t.name === join.rightTable)?.columns.find((c) => c.name === join.rightField)?.label ?? join.rightField;
            return (
              <div
                key={join.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2"
              >
                <span className="text-[13px] font-medium text-[var(--text-heading)]">
                  {leftLabel}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">.{leftColLabel}</span>
                <span className="text-[11px] font-semibold text-[#1659d6] mx-1">=</span>
                <span className="text-[13px] font-medium text-[var(--text-heading)]">
                  {rightLabel}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">.{rightColLabel}</span>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-[var(--text-muted)] hover:text-red-500"
                  onClick={() => onRemoveJoin(join.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {isAtLimit && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Maximum of {MAX_JOINS} joins reached for performance.
        </div>
      )}

      {/* Suggested joins — one-click to add */}
      {!isAtLimit && availableSuggestions.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            <Zap className="w-3 h-3 inline mr-1 opacity-60" />
            Suggested joins
          </span>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.map((sj, i) => (
              <button
                key={`${sj.leftTable}-${sj.rightTable}-${i}`}
                type="button"
                onClick={() => handleAddSuggested(sj)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#1659d6]/30 bg-[#eff6ff] px-3 py-1.5 text-[12px] font-medium text-[#10409a] hover:bg-[#1659d6]/10 hover:border-[#1659d6]/50 transition-all"
              >
                <Plus className="w-3 h-3" />
                {sj.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isAtLimit && relevantTables.length >= 2 && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-[var(--border)] p-3 bg-gray-50/50">
          <div className="min-w-[130px]">
            <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1 block">
              Left Table
            </label>
            <Select value={leftTable} onValueChange={(v) => { setLeftTable(v); setLeftField(""); }}>
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
              Left Field
            </label>
            <Select value={leftField} onValueChange={setLeftField}>
              <SelectTrigger size="sm" className="w-full" disabled={!leftTable}>
                <SelectValue placeholder="Field" />
              </SelectTrigger>
              <SelectContent>
                {leftTableMeta?.columns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.label ?? col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[130px]">
            <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1 block">
              Right Table
            </label>
            <Select value={rightTable} onValueChange={(v) => { setRightTable(v); setRightField(""); }}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Table" />
              </SelectTrigger>
              <SelectContent>
                {relevantTables
                  .filter((t) => t.name !== leftTable)
                  .map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[130px]">
            <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1 block">
              Right Field
            </label>
            <Select value={rightField} onValueChange={setRightField}>
              <SelectTrigger size="sm" className="w-full" disabled={!rightTable}>
                <SelectValue placeholder="Field" />
              </SelectTrigger>
              <SelectContent>
                {rightTableMeta?.columns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.label ?? col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!leftTable || !rightTable || !leftField || !rightField}
            className="h-8"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Join
          </Button>
        </div>
      )}

      {relevantTables.length < 2 && joins.length === 0 && (
        <div className="text-center py-6 text-[var(--text-muted)] text-sm">
          Select at least 2 tables to create a join.
        </div>
      )}
    </div>
  );
}
