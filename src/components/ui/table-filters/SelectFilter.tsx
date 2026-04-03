"use client";

import { useState, useEffect, useRef } from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FilterIcon } from "./FilterIcon";
import type { ColumnFilter, FilterOption } from "./types";

interface SelectFilterProps {
  columnKey: string;
  isActive: boolean;
  activeFilter: ColumnFilter | null;
  onFilterChange: (filter: ColumnFilter | null) => void;
  filterOptions: FilterOption[];
}

export function SelectFilter({
  columnKey,
  isActive,
  activeFilter,
  onFilterChange,
  filterOptions,
}: SelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-populate from active filter when popover opens
  useEffect(() => {
    if (open && activeFilter?.values) {
      setSelected(activeFilter.values);
    } else if (open) {
      setSelected([]);
    }
  }, [open, activeFilter]);

  // Auto-focus search input when popover opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleToggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    setSelected(next);

    // Immediately apply on toggle (no Apply button needed)
    if (next.length === 0) {
      onFilterChange(null);
    } else {
      onFilterChange({ columnKey, type: "select", values: next });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex" onClick={(e) => e.stopPropagation()}>
        <FilterIcon isActive={isActive} />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start" sideOffset={4}>
        <Command shouldFilter={true}>
          <CommandInput ref={inputRef} placeholder="Search..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No options available</CommandEmpty>
            <CommandGroup>
              {filterOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-[#9ca3af]">
                  Loading options...
                </div>
              ) : (
                filterOptions.map((option) => {
                  const isSelected = selected.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => handleToggle(option.value)}
                      className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                    >
                      <Checkbox checked={isSelected} />
                      <span className="flex-1 truncate text-[13px]">{option.label}</span>
                      {isSelected && <CheckIcon className="h-3.5 w-3.5 text-[#1c2260]" />}
                    </CommandItem>
                  );
                })
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
