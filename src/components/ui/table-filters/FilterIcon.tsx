"use client";

import { Funnel } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterIconProps {
  isActive: boolean;
}

/**
 * Filter trigger icon — rendered as a pill-shaped button with a visible hit area.
 * The parent (PopoverTrigger) provides the button behavior.
 * Active state shows brand-colored background for ambient awareness.
 */
export function FilterIcon({ isActive }: FilterIconProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center h-6 px-1.5 rounded-md transition-all duration-150 ml-1",
        isActive
          ? "bg-[#eff6ff] text-[#1c2260] ring-1 ring-[#1c2260]/20"
          : "text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#6b7280]"
      )}
    >
      <Funnel className="w-3.5 h-3.5" />
    </span>
  );
}
