"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

// =============================================================================
// FilterTabs — Reusable pill-style filter tabs
// =============================================================================
//
// Pill-shaped tab buttons inspired by the Payout Audit Log tab style.
// Supports icons, per-tab active colors, count badges, and multiple sizes.
//
// Usage (same-page filtering):
//   <FilterTabs
//     tabs={[
//       { key: "all", label: "All" },
//       { key: "processing", label: "Processing", icon: <Loader2 className="h-3 w-3" /> },
//       { key: "paid", label: "Payout Paid", icon: <CheckCircle2 className="h-3 w-3" />, activeColor: "bg-green-600" },
//     ]}
//     activeTab="all"
//     onTabChange={setTab}
//   />
//
// Usage (route navigation):
//   <FilterTabs
//     tabs={[
//       { key: "broadcast", label: "Broadcast", href: "/emails/broadcast", icon: <Send className="w-3.5 h-3.5" /> },
//       { key: "history", label: "History", href: "/emails/history", icon: <History className="w-3.5 h-3.5" /> },
//     ]}
//     activeTab="broadcast"
//     onTabChange={(key) => router.push(tabs.find(t => t.key === key)?.href ?? "")}
//   />
//
// With count badges:
//   <FilterTabs
//     tabs={[
//       { key: "all", label: "All", count: 42 },
//       { key: "pending", label: "Pending", count: 5 },
//     ]}
//     activeTab="all"
//     onTabChange={setTab}
//   />
//
// Sizes:
//   <FilterTabs size="sm" ... />  — compact (12px text, px-2.5 py-1)
//   <FilterTabs size="md" ... />  — default (13px text, px-3 py-1.5)
//   <FilterTabs size="lg" ... />  — larger (14px text, px-4 py-2)
// =============================================================================

export interface FilterTabItem {
  key: string;
  label: string;
  /** Optional icon element (typically a Lucide icon) */
  icon?: React.ReactNode;
  /** Spin the icon when active (e.g. loading indicator) */
  iconSpin?: boolean;
  /** Optional count badge shown next to the label */
  count?: number;
  /**
   * Override the active background color for this specific tab.
   * Defaults to `bg-[var(--brand-primary)]`.
   * Example: "bg-green-600", "bg-amber-500"
   */
  activeColor?: string;
  /** Optional active text color override. Defaults to "text-white" */
  activeTextColor?: string;
  /** Optional href for route navigation. When provided, renders a Link instead of a button */
  href?: string;
}

export type FilterTabsSize = "sm" | "md" | "lg";

export interface FilterTabsProps {
  tabs: FilterTabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
  /**
   * Button size.
   * "sm" — 12px text, compact padding (good for dense filter bars)
   * "md" — 13px text, standard padding (default)
   * "lg" — 14px text, larger padding (good for primary navigation tabs)
   */
  size?: FilterTabsSize;
  /** Additional class names for the outer wrapper */
  className?: string;
}

const sizeStyles: Record<FilterTabsSize, string> = {
  sm: "px-2.5 py-1 text-[12px]",
  md: "px-3 py-1.5 text-[13px]",
  lg: "px-4 py-2 text-[14px]",
};

const iconSizeStyles: Record<FilterTabsSize, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

const countSizeStyles: Record<FilterTabsSize, string> = {
  sm: "min-w-[16px] h-[16px] px-1 text-[9px]",
  md: "min-w-[18px] h-[18px] px-1.5 text-[10px]",
  lg: "min-w-[20px] h-[20px] px-1.5 text-[11px]",
};

export function FilterTabs({
  tabs,
  activeTab,
  onTabChange,
  size = "md",
  className,
}: FilterTabsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const showCount = tab.count !== undefined && tab.count > 0;

        const activeBg = tab.activeColor ?? "bg-[var(--brand-primary)]";
        const activeText = tab.activeTextColor ?? "text-white";

        const tabContent = (
          <>
            {tab.icon && (
              <span
                className={cn(
                  "shrink-0",
                  iconSizeStyles[size],
                  tab.iconSpin && isActive && "animate-spin",
                )}
              >
                {tab.icon}
              </span>
            )}
            {tab.label}
            {showCount && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full font-bold",
                  countSizeStyles[size],
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[var(--brand-light, #e8edfa)] text-[var(--brand-primary, #10409a)]",
                )}
              >
                {tab.count}
              </span>
            )}
          </>
        );

        const tabClasses = cn(
          "inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors whitespace-nowrap",
          sizeStyles[size],
          isActive
            ? cn(activeBg, activeText)
            : "text-[var(--text-muted)] hover:bg-[var(--bg-page)]",
        );

        if (tab.href) {
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={tabClasses}
            >
              {tabContent}
            </Link>
          );
        }

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={tabClasses}
          >
            {tabContent}
          </button>
        );
      })}
    </div>
  );
}
