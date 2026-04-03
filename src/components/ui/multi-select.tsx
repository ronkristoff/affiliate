"use client";

import * as React from "react";
import { CheckIcon, ChevronDown, XIcon } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  /** Render inside a disabled skeleton-like container */
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MultiSelectCombobox({
  options,
  selected,
  onSelectedChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No options found.",
  className,
  isLoading,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus the search input when popover opens
  React.useEffect(() => {
    if (open) {
      // cmdk auto-focuses; just ensure it works after a tick
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleToggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onSelectedChange(next);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectedChange([]);
  };

  // Trigger label
  const triggerLabel = React.useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const opt = options.find((o) => o.value === selected[0]);
      return opt?.label ?? placeholder;
    }
    return `${selected.length} selected`;
  }, [selected, options, placeholder]);

  if (isLoading) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-[12px] font-medium bg-[#f9fafb] text-[#9ca3af] select-none",
          className
        )}
      >
        <span className="h-3 w-3 animate-pulse rounded-full bg-[#d1d5db]" />
        Loading...
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-[12px] font-medium transition-all",
            selected.length > 0
              ? "border-[#1c2260] bg-[#eff6ff] text-[#1c2260]"
              : "border-[#e5e7eb] bg-white text-[#474747] hover:border-[#1fb5a5] hover:text-[#1fb5a5]",
            className
          )}
        >
          {selected.length > 1 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#1c2260] text-white text-[10px] font-bold px-1">
              {selected.length}
            </span>
          )}
          <span className="truncate max-w-[120px]">{triggerLabel}</span>
          {selected.length > 0 ? (
            <XIcon
              className="h-3 w-3 shrink-0 opacity-70 hover:opacity-100"
              onMouseDown={handleClear}
              onClick={handleClear}
            />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] md:w-56 min-w-[200px] p-0"
        align="start"
      >
        <Command shouldFilter={true}>
          <CommandInput
            ref={inputRef}
            placeholder={searchPlaceholder}
          />
          <CommandList className="max-h-[300px] md:max-h-[400px]">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleToggle(option.value)}
                    className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                  >
                    <Checkbox checked={isSelected} />
                    <span className="flex-1 truncate text-[13px]">
                      {option.label}
                    </span>
                    {isSelected && <CheckIcon className="h-3.5 w-3.5 text-[#1c2260]" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
