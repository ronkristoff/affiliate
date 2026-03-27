"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, ChevronDown, Check, ArrowLeft } from "lucide-react";
import {
  DATE_PRESETS,
  dateToTimestamp,
  timestampToDateInput,
  inferPeriodFromRange,
} from "@/lib/date-utils";
import type { DatePreset } from "@/lib/date-utils";

// ─── Preset groups for section separators ─────────────────────────────────

const QUICK_VALUES = new Set(["today", "thisWeek", "thisMonth"]);
const ROLLING_VALUES = new Set(["7d", "30d", "90d"]);

// ─── Types ─────────────────────────────────────────────────────────────────

type Period = "daily" | "weekly" | "monthly";

export interface DateRangeChange {
  start: number;
  end: number;
  label: string;
  isCustom: boolean;
  preset?: string;
  period?: Period;
}

interface DateRangeSelectorProps {
  /** Current active preset value (e.g. "30d", "thisMonth", "custom") */
  value: string;
  onChange: (change: DateRangeChange) => void;
  className?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDateRange(start: number, end: number): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${new Date(start).toLocaleDateString("en-US", opts)} - ${new Date(end).toLocaleDateString("en-US", opts)}`;
}

function getMaxDateInput(): string {
  return timestampToDateInput(Date.now());
}

function needsSeparatorAfter(val: string): boolean {
  return QUICK_VALUES.has(val) || ROLLING_VALUES.has(val);
}

// ─── Component ─────────────────────────────────────────────────────────────

export function DateRangeSelector({ value, onChange, className }: DateRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customDateError, setCustomDateError] = useState("");

  // ── Reset custom view when dropdown closes ───────────────────────────────
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setShowCustom(false);
      setCustomDateError("");
    }
  }, []);

  // ── Preset selection → close dropdown immediately ────────────────────────
  const handlePresetSelect = useCallback(
    (option: DatePreset) => {
      if (!option.getRange) return;
      const range = option.getRange();
      if (!range) return;

      onChange({
        ...range,
        label: option.label,
        isCustom: false,
        preset: option.value,
        period: option.period,
      });
    },
    [onChange],
  );

  // ── "Custom" clicked → flip to custom view (same dropdown stays open) ───
  const handleShowCustom = useCallback(() => {
    if (!customStartDate || !customEndDate) {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      setCustomStartDate(timestampToDateInput(thirtyDaysAgo));
      setCustomEndDate(timestampToDateInput(Date.now()));
    }
    setShowCustom(true);
  }, [customStartDate, customEndDate]);

  // ── Custom date apply ───────────────────────────────────────────────────
  const handleCustomDateApply = useCallback(() => {
    if (!customStartDate || !customEndDate) {
      setCustomDateError("Please select both start and end dates");
      return;
    }

    const start = dateToTimestamp(customStartDate);
    const end = dateToTimestamp(customEndDate);

    if (start > end) {
      setCustomDateError("Start date must be before or equal to end date");
      return;
    }

    const todayTs = Date.now() - (Date.now() % 86400000);
    if (start > todayTs || end > todayTs) {
      setCustomDateError("Cannot select future dates");
      return;
    }

    onChange({
      start,
      end,
      label: formatDateRange(start, end),
      isCustom: true,
      period: inferPeriodFromRange(start, end),
    });
  }, [customStartDate, customEndDate, onChange]);

  // ── Custom date cancel → go back to preset list ─────────────────────────
  const handleCustomDateCancel = useCallback(() => {
    setCustomStartDate("");
    setCustomEndDate("");
    setCustomDateError("");
    setShowCustom(false);
  }, []);

  // ── Trigger label ───────────────────────────────────────────────────────
  const getTriggerLabel = () => {
    const selectedOption = DATE_PRESETS.find((opt) => opt.value === value);
    return selectedOption?.label || "Last 30 days";
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-1 min-w-[90px] justify-between text-xs h-8",
            value === "custom" && "border-brand-primary border-2",
            className,
          )}
          aria-label={`Select date range, currently ${getTriggerLabel()}`}
        >
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {getTriggerLabel()}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className={cn("p-1", showCustom ? "w-[300px]" : "w-52")}>
        {showCustom ? (
          /* ── Custom Date Picker view ──────────────────────────────── */
          <div className="p-2 space-y-3">
            {/* Back button */}
            <button
              type="button"
              onClick={handleCustomDateCancel}
              className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to presets
            </button>

            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">Custom Range</p>
            </div>

            {/* Date inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="dash-start-date" className="text-[11px] text-muted-foreground">
                  Start Date
                </Label>
                <Input
                  id="dash-start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setCustomDateError("");
                  }}
                  max={getMaxDateInput()}
                  className="h-8 text-[13px]"
                  aria-label="Start date"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dash-end-date" className="text-[11px] text-muted-foreground">
                  End Date
                </Label>
                <Input
                  id="dash-end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setCustomDateError("");
                  }}
                  max={getMaxDateInput()}
                  className="h-8 text-[13px]"
                  aria-label="End date"
                />
              </div>
            </div>

            {customDateError && (
              <p className="text-[11px] text-destructive" role="alert">
                {customDateError}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCustomDateCancel}
                className="h-7 text-[12px]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCustomDateApply}
                className="h-7 text-[12px] bg-brand-primary hover:bg-brand-secondary"
              >
                Apply
              </Button>
            </div>
          </div>
        ) : (
          /* ── Preset list view ─────────────────────────────────────── */
          <>
            {DATE_PRESETS.filter((opt) => opt.value !== "custom").map((option) => {
              const isActive = value === option.value;

              return (
                <div key={option.value}>
                  <DropdownMenuItem
                    onClick={() => handlePresetSelect(option)}
                    className={cn(
                      "cursor-pointer text-[13px] pl-3 gap-2",
                      isActive && "bg-accent font-medium",
                    )}
                  >
                    <span className="flex-1">{option.label}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-[var(--brand-primary)]" />}
                  </DropdownMenuItem>
                  {needsSeparatorAfter(option.value) && <DropdownMenuSeparator />}
                </div>
              );
            })}

            {/* Custom — preventDefault stops DropdownMenu from closing */}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleShowCustom();
              }}
              className={cn(
                "cursor-pointer text-[13px] flex items-center gap-2 pl-3",
                value === "custom" && "bg-accent font-medium",
              )}
            >
              <Calendar className="w-3 h-3" />
              Custom
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
