"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterPillProps {
  /** Display label shown inside the pill */
  label: string;
  /** Called when the user clicks the × button to remove this filter */
  onRemove: () => void;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * A single removable filter pill.
 *
 * Renders a small rounded-full badge with a label and × close button.
 * Used across the app to indicate active filters that can be cleared.
 *
 * Canonical component — replaces all inline filter pill patterns.
 */
export function FilterPill({ label, onRemove, className }: FilterPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
        "bg-[#eff6ff] text-[11px] font-medium text-[#1c2260]",
        className,
      )}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="hover:text-[#1e40af] transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

interface FilterPillBarProps {
  /** The pills to render */
  pills: Array<{ key: string; label: string }>;
  /** Called when a specific pill's × is clicked */
  onRemove: (key: string) => void;
  /** Called when "Clear all" is clicked */
  onClearAll: () => void;
  /** Optional additional CSS classes for the wrapper */
  className?: string;
}

/**
 * A horizontal row of removable filter pills with a "Clear all" link.
 *
 * Renders nothing when `pills` is empty.
 */
export function FilterPillBar({ pills, onRemove, onClearAll, className }: FilterPillBarProps) {
  if (pills.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {pills.map((pill) => (
        <FilterPill
          key={pill.key}
          label={pill.label}
          onRemove={() => onRemove(pill.key)}
        />
      ))}
      {pills.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11px] font-medium text-[#6b7280] hover:text-[#ef4444] cursor-pointer transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
