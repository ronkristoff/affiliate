"use client";

import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FilterIcon } from "./FilterIcon";
import type { ColumnFilter } from "./types";

interface NumberRangeFilterProps {
  columnKey: string;
  isActive: boolean;
  activeFilter: ColumnFilter | null;
  onFilterChange: (filter: ColumnFilter | null) => void;
  filterStep?: number;
}

export function NumberRangeFilter({
  columnKey,
  isActive,
  activeFilter,
  onFilterChange,
  filterStep,
}: NumberRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [minStr, setMinStr] = useState("");
  const [maxStr, setMaxStr] = useState("");
  const [error, setError] = useState("");

  // Pre-populate from active filter when popover opens
  useEffect(() => {
    if (open) {
      setMinStr(activeFilter?.min != null ? String(activeFilter.min) : "");
      setMaxStr(activeFilter?.max != null ? String(activeFilter.max) : "");
      setError("");
    }
  }, [open, activeFilter]);

  const parseValue = (str: string): number | null => {
    if (str.trim() === "") return null;
    const parsed = parseFloat(str);
    return isNaN(parsed) ? null : parsed;
  };

  const handleApply = () => {
    const parsedMin = parseValue(minStr);
    const parsedMax = parseValue(maxStr);

    // Validation: both provided and min > max
    if (parsedMin != null && parsedMax != null && parsedMin > parsedMax) {
      setError("Min must be less than Max");
      return;
    }

    // Both empty = no filter
    if (parsedMin == null && parsedMax == null) {
      onFilterChange(null);
      setOpen(false);
      return;
    }

    setError("");
    onFilterChange({
      columnKey,
      type: "number-range",
      min: parsedMin,
      max: parsedMax,
    });
    setOpen(false);
  };

  const handleClear = () => {
    setMinStr("");
    setMaxStr("");
    setError("");
    onFilterChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex" onClick={(e) => e.stopPropagation()}>
        <FilterIcon isActive={isActive} />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start" sideOffset={4}>
        <div className="space-y-3">
          <div>
            <Label className="text-[12px] text-[#6b7280]">{"\u2265"} Min</Label>
            <Input
              type="number"
              placeholder="Min"
              value={minStr}
              onChange={(e) => {
                setMinStr(e.target.value);
                setError("");
              }}
              step={filterStep}
              className="h-8 mt-1 text-[13px]"
            />
          </div>
          <div>
            <Label className="text-[12px] text-[#6b7280]">{"\u2264"} Max</Label>
            <Input
              type="number"
              placeholder="Max"
              value={maxStr}
              onChange={(e) => {
                setMaxStr(e.target.value);
                setError("");
              }}
              step={filterStep}
              className="h-8 mt-1 text-[13px]"
            />
          </div>
          {error && (
            <p className="text-[11px] text-[#ef4444]">{error}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" className="h-7 text-[12px]" onClick={handleClear}>
              Clear
            </Button>
            <Button size="sm" className="h-7 text-[12px] bg-[#10409a] hover:bg-[#1659d6]" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
