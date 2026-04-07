"use client";

import { useState, useEffect, useRef } from "react";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
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

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  /** Available options */
  options: MultiSelectOption[];
  /** Currently selected values */
  selected: string[];
  /** Called when selection changes (receives the full array) */
  onChange: (values: string[]) => void;
  /** Placeholder text shown when nothing is selected */
  placeholder?: string;
  /** Optional additional CSS classes for the trigger button */
  className?: string;
  /** Width of the popover (default: "w-56") */
  popoverWidth?: string;
}

/**
 * A multi-select dropdown with search, checkboxes, and a trigger button
 * that shows a count badge when items are selected.
 *
 * Uses Popover + Command (cmdk) for the dropdown, matching the pattern
 * used in SelectFilter but as a standalone reusable component.
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  className,
  popoverWidth = "w-56",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Clear search when popover closes
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const handleToggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  };

  // Build a label for the trigger
  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? `${selected.length} selected`
        : `${selected.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-8 rounded-lg border border-[var(--border-light)]",
            "bg-white px-2.5 text-[12px] text-[var(--text-body)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]",
            "transition-colors hover:border-[var(--text-muted)]/40",
            className,
          )}
        >
          <span className={cn("truncate max-w-[140px]", selected.length === 0 && "text-[var(--text-muted)]")}>
            {triggerLabel}
          </span>
          <ChevronsUpDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", popoverWidth)} align="start" sideOffset={4}>
        <Command shouldFilter={true}>
          <CommandInput
            ref={inputRef}
            placeholder="Search..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[240px]">
            <CommandEmpty>No options found</CommandEmpty>
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
                    <span className="flex-1 truncate text-[13px]">{option.label}</span>
                    {isSelected && <CheckIcon className="h-3.5 w-3.5 text-[#1c2260] shrink-0" />}
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
