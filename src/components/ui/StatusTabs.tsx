"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// =============================================================================
// StatusTabs — Reusable underline-style tab bar
// =============================================================================
//
// A single reusable component that replaces AffiliateTabs, TenantTabs,
// and inline tab markup in PayoutHistoryClient, PromoLibrary, etc.
//
// Design:
//   - Underline active indicator (brand primary color)
//   - Optional count badges (pill or amber dot)
//   - Optional icon per tab
//   - Supports variant="pill" for Radix-style pill tabs
//
// Usage:
//   <StatusTabs
//     tabs={[
//       { key: "all", label: "All" },
//       { key: "processing", label: "Processing", icon: Loader2, iconSpin: true },
//       { key: "completed", label: "Completed", count: 12 },
//     ]}
//     activeTab="all"
//     onTabChange={setTab}
//   />
// =============================================================================

export interface StatusTabItem {
  key: string;
  label: string;
  count?: number;
  /** Show an amber notification dot instead of a count pill */
  notifyDot?: boolean;
  /** Optional icon element */
  icon?: React.ReactNode;
  /** Spin the icon when active (e.g. loading indicator) */
  iconSpin?: boolean;
  /** Optional badge color override — defaults to brand-primary */
  badgeVariant?: "primary" | "amber" | "muted";
}

export interface StatusTabsProps {
  tabs: StatusTabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
  /**
   * Visual style.
   * "underline" — bottom-border indicator, brand-colored (default — matches AffiliateTabs / TenantTabs).
   * "pill" — rounded pill background, matches Radix Tabs look.
   */
  variant?: "underline" | "pill";
  className?: string;
}

export function StatusTabs({
  tabs,
  activeTab,
  onTabChange,
  variant = "underline",
  className,
}: StatusTabsProps) {
  if (variant === "pill") {
    return (
      <div
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-md bg-[var(--bg-muted, #f4f4f5)] p-1 text-[var(--text-muted, #6b7280)]",
          className,
        )}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-[13px] font-medium transition-all",
                isActive
                  ? "bg-[var(--bg-surface, #fff)] text-[var(--text-heading, #111)] shadow-sm"
                  : "text-[var(--text-muted, #6b7280)] hover:text-[var(--text-heading, #111)]",
              )}
            >
              {tab.icon && (
                <span
                  className={cn(
                    "shrink-0",
                    tab.iconSpin && isActive && "animate-spin",
                    isActive ? "text-[var(--brand-primary, #10409a)]" : "",
                  )}
                >
                  {tab.icon}
                </span>
              )}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1.5 text-[10px] font-bold",
                    tab.badgeVariant === "amber"
                      ? "bg-amber-100 text-amber-700"
                      : tab.badgeVariant === "muted"
                        ? "bg-gray-100 text-gray-500"
                        : "bg-[var(--brand-light, #e8edfa)] text-[var(--brand-primary, #10409a)]",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // ── Underline variant (default) ──────────────────────────────────────────
  return (
    <div
      className={cn(
        "border-b-2 border-[var(--border, #e5e7eb)]",
        className,
      )}
    >
      <div className="flex gap-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const showCount = tab.count !== undefined && tab.count > 0;
          const showDot = tab.notifyDot && !isActive && tab.count !== undefined && tab.count > 0;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "px-4 py-2.5 text-[13.5px] font-medium transition-all border-b-2 -mb-[2px] flex items-center gap-1.5",
                isActive
                  ? "text-[var(--brand-primary, #10409a)] font-bold border-b-[var(--brand-primary, #10409a)]"
                  : "text-[var(--text-muted, #6b7280)] border-b-transparent hover:text-[var(--text-heading, #333)]",
              )}
            >
              {tab.icon && (
                <span
                  className={cn(
                    "shrink-0",
                    tab.iconSpin && isActive && "animate-spin",
                    isActive ? "text-[var(--brand-primary, #10409a)]" : "",
                  )}
                >
                  {tab.icon}
                </span>
              )}
              {tab.label}
              {showDot ? (
                <span className="inline-flex items-center justify-center w-[8px] h-[8px] rounded-full bg-[var(--brand-primary, #10409a)]" />
              ) : showCount ? (
                <span
                  className={cn(
                    "ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1.5 text-[10px] font-bold",
                    tab.badgeVariant === "amber"
                      ? "bg-amber-100 text-amber-700"
                      : tab.badgeVariant === "muted"
                        ? "bg-gray-100 text-gray-500"
                        : "bg-[var(--brand-light, #e8edfa)] text-[var(--brand-primary, #10409a)]",
                  )}
                >
                  {tab.count}
                </span>
              ) : tab.count === 0 ? (
                <span className="ml-0.5 text-[var(--text-muted, #6b7280)]">(0)</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
