"use client";

import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FilterIcon } from "./FilterIcon";
import type { ColumnFilter } from "./types";

interface TextFilterProps {
  columnKey: string;
  isActive: boolean;
  activeFilter: ColumnFilter | null;
  onFilterChange: (filter: ColumnFilter | null) => void;
}

export function TextFilter({ columnKey, isActive, activeFilter, onFilterChange }: TextFilterProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // Pre-populate from active filter when popover opens
  useEffect(() => {
    if (open && activeFilter?.value) {
      setInputValue(activeFilter.value);
    } else if (open) {
      setInputValue("");
    }
  }, [open, activeFilter]);

  const handleApply = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      onFilterChange(null);
    } else {
      onFilterChange({ columnKey, type: "text", value: trimmed });
    }
    setOpen(false);
  };

  const handleClear = () => {
    setInputValue("");
    onFilterChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex" onClick={(e) => e.stopPropagation()}>
        <FilterIcon isActive={isActive} />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start" sideOffset={4}>
        <div className="space-y-3">
          <div>
            <Label className="text-[12px] text-[#6b7280]">Contains...</Label>
            <Input
              type="text"
              placeholder="Search..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
              className="h-8 mt-1 text-[13px]"
              autoFocus
            />
          </div>
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
