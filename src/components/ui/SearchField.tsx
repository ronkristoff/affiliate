"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchFieldSize = "sm" | "md" | "lg";

interface SearchFieldProps {
  /** Current search value (controlled) */
  value: string;
  /** Callback when search value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Size variant — default "md" */
  size?: SearchFieldSize;
  /** Show a clear (X) button when the field has a value — default false */
  clearable?: boolean;
  /** Additional class names for the outer wrapper */
  className?: string;
}

const sizeStyles: Record<
  SearchFieldSize,
  {
    wrapper: string;
    input: string;
    icon: string;
  }
> = {
  sm: {
    wrapper: "w-full max-w-[240px]",
    input: "h-8 pl-8 pr-2 text-xs",
    icon: "h-3.5 w-3.5 left-2.5",
  },
  md: {
    wrapper: "w-full max-w-sm",
    input: "h-9 pl-9 pr-3 text-[13px]",
    icon: "h-4 w-4 left-3",
  },
  lg: {
    wrapper: "w-full max-w-sm",
    input: "h-10 pl-10 pr-4 text-sm",
    icon: "h-4 w-4 left-3",
  },
};

/**
 * Canonical search field component.
 *
 * Renders a left-aligned search icon, a text input, and an optional clear button.
 * All pages that need a search field should use this component for visual consistency.
 *
 * @example
 * ```tsx
 * <SearchField
 *   value={search}
 *   onChange={setSearch}
 *   placeholder="Search by name..."
 *   size="md"
 *   clearable
 * />
 * ```
 */
export function SearchField({
  value,
  onChange,
  placeholder = "Search...",
  size = "md",
  clearable = false,
  className,
}: SearchFieldProps) {
  const styles = sizeStyles[size];

  return (
    <div className={cn("relative", styles.wrapper, className)}>
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-[#9ca3af]",
          styles.icon,
        )}
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("border-0 bg-[var(--bg-surface)] shadow-none", styles.input)}
      />
      {clearable && value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#333333] transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
