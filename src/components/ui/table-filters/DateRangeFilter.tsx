"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FilterIcon } from "./FilterIcon";
import { DATE_PRESETS } from "@/lib/date-utils";
import type { ColumnFilter } from "./types";

interface DateRangeFilterProps {
  columnKey: string;
  isActive: boolean;
  activeFilter: ColumnFilter | null;
  onFilterChange: (filter: ColumnFilter | null) => void;
}

export function DateRangeFilter({
  columnKey,
  isActive,
  activeFilter,
  onFilterChange,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");
  const [error, setError] = useState("");

  // Pre-populate from active filter when popover opens
  useEffect(() => {
    if (open) {
      if (activeFilter?.after) {
        setFromStr(new Date(activeFilter.after).toISOString().split("T")[0]);
      } else {
        setFromStr("");
      }
      if (activeFilter?.before) {
        setToStr(new Date(activeFilter.before).toISOString().split("T")[0]);
      } else {
        setToStr("");
      }
      setSelectedPreset(null);
      setError("");
    }
  }, [open, activeFilter]);

  const handlePresetClick = (presetValue: string) => {
    const preset = DATE_PRESETS.find((p) => p.value === presetValue);
    if (!preset?.getRange) return;

    const range = preset.getRange();
    if (!range) return;

    setSelectedPreset(presetValue);
    setError("");

    onFilterChange({
      columnKey,
      type: "date-range",
      after: range.start,
      before: range.end,
    });
    setOpen(false);
  };

  const dateToTimestamp = (dateStr: string): number => {
    const date = new Date(dateStr);
    return date.getTime();
  };

  const handleCustomApply = () => {
    if (!fromStr || !toStr) {
      setError("Please select both dates");
      return;
    }

    const after = dateToTimestamp(fromStr);
    const before = dateToTimestamp(toStr);

    if (after > before) {
      setError("Start must be before end");
      return;
    }

    // No future dates
    const now = Date.now();
    if (after > now || before > now) {
      setError("Cannot select future dates");
      return;
    }

    setSelectedPreset(null);
    setError("");
    onFilterChange({ columnKey, type: "date-range", after, before });
    setOpen(false);
  };

  const handleClear = () => {
    setFromStr("");
    setToStr("");
    setSelectedPreset(null);
    setError("");
    onFilterChange(null);
    setOpen(false);
  };

  // Presets without "Custom"
  const presets = DATE_PRESETS.filter((p) => p.value !== "custom");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex" onClick={(e) => e.stopPropagation()}>
        <FilterIcon isActive={isActive} />
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[280px] p-3" align="start" sideOffset={4}>
        <div className="space-y-3">
          {/* Preset chips */}
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePresetClick(preset.value)}
                className={cn(
                  "text-[11px] px-2 py-1 rounded-full border transition-colors",
                  selectedPreset === preset.value
                    ? "border-[#1c2260] bg-[#eff6ff] text-[#1c2260]"
                    : "border-[#e5e7eb] text-[#6b7280] hover:border-[#1fb5a5]"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="border-b border-[#f3f4f6]" />

          {/* Custom date inputs */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-[#6b7280] block mb-1">From</label>
                <input
                  type="date"
                  value={fromStr}
                  onChange={(e) => {
                    setFromStr(e.target.value);
                    setError("");
                    setSelectedPreset(null);
                  }}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full h-8 px-2 text-[12px] border border-[#e5e7eb] rounded-md focus:outline-none focus:border-[#1c2260]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] text-[#6b7280] block mb-1">To</label>
                <input
                  type="date"
                  value={toStr}
                  onChange={(e) => {
                    setToStr(e.target.value);
                    setError("");
                    setSelectedPreset(null);
                  }}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full h-8 px-2 text-[12px] border border-[#e5e7eb] rounded-md focus:outline-none focus:border-[#1c2260]"
                />
              </div>
            </div>
            {error && <p className="text-[11px] text-[#ef4444]">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" className="h-7 text-[12px]" onClick={handleClear}>
              Clear
            </Button>
            <Button
              size="sm"
              className="h-7 text-[12px] bg-[#1c2260] hover:bg-[#1fb5a5]"
              onClick={handleCustomApply}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
