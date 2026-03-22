"use client";

import { Search, X } from "lucide-react";
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
    container: string;
    input: string;
    icon: string;
    clearIcon: string;
  }
> = {
  sm: {
    wrapper: "min-w-[180px] max-w-[240px]",
    container: "gap-1.5 px-2.5 py-1.5",
    input: "text-[12px]",
    icon: "h-3 w-3",
    clearIcon: "h-3 w-3 right-2",
  },
  md: {
    wrapper: "min-w-[200px] max-w-md",
    container: "gap-2 px-3.5 py-2",
    input: "text-[13px]",
    icon: "h-3.5 w-3.5",
    clearIcon: "h-3.5 w-3.5 right-3",
  },
  lg: {
    wrapper: "min-w-[240px] max-w-md",
    container: "gap-2 px-4 py-2.5",
    input: "text-sm",
    icon: "h-4 w-4",
    clearIcon: "h-4 w-4 right-3",
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
    <div className={cn(styles.wrapper, className)}>
      <div className="flex items-center bg-white border border-[#e5e7eb] rounded-lg focus-within:border-[#10409a]/40 transition-colors">
        <div className={cn("flex items-center flex-1", styles.container)}>
          <Search className={cn("shrink-0 text-[#6b7280]", styles.icon)} />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "flex-1 border-none outline-none bg-transparent text-[#474747] placeholder:text-[#6b7280]",
              styles.input,
            )}
          />
        </div>
        {clearable && value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#474747] transition-colors",
              styles.clearIcon,
            )}
            aria-label="Clear search"
          >
            <X />
          </button>
        )}
      </div>
    </div>
  );
}
