"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar, ChevronDown } from "lucide-react";

type DateRangeOption = {
  label: string;
  value: string;
  getRange?: () => { start: number; end: number } | null;
};

const dateRangeOptions: DateRangeOption[] = [
  {
    label: "Last 7 days",
    value: "7d",
    getRange: () => {
      const end = Date.now();
      const start = end - 7 * 24 * 60 * 60 * 1000;
      return { start, end };
    },
  },
  {
    label: "Last 30 days",
    value: "30d",
    getRange: () => {
      const end = Date.now();
      const start = end - 30 * 24 * 60 * 60 * 1000;
      return { start, end };
    },
  },
  {
    label: "Last 90 days",
    value: "90d",
    getRange: () => {
      const end = Date.now();
      const start = end - 90 * 24 * 60 * 60 * 1000;
      return { start, end };
    },
  },
  {
    label: "This month",
    value: "thisMonth",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { start, end: Date.now() };
    },
  },
  {
    label: "Last month",
    value: "lastMonth",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of prev month
      start.setDate(1); // First day of prev month
      const end = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of prev month
      return { start: start.getTime(), end: end.getTime() };
    },
  },
  {
    label: "Custom",
    value: "custom",
    getRange: () => null, // Indicates custom range - opens date picker
  },
];

interface DateRangeSelectorProps {
  onChange?: (range: { start: number; end: number; label: string; isCustom: boolean; preset?: string }) => void;
  className?: string;
}

/**
 * Formats a timestamp to a localized date string for display
 */
function formatDateRange(start: number, end: number): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  const options: Intl.DateTimeFormatOptions = { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  };
  
  return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`;
}

/**
 * Converts a date string (YYYY-MM-DD) to timestamp at end of day
 */
function dateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

/**
 * Converts timestamp to YYYY-MM-DD format for input value
 */
function timestampToDateInput(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toISOString().split("T")[0];
}

/**
 * Get max date (today) in YYYY-MM-DD format
 */
function getMaxDateInput(): string {
  return timestampToDateInput(Date.now());
}

export function DateRangeSelector({ onChange, className }: DateRangeSelectorProps) {
  const searchParams = useSearchParams();
  
  // State for preset selection
  const [selectedValue, setSelectedValue] = useState<string>("30d");
  
  // State for custom date picker
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [customDateError, setCustomDateError] = useState<string>("");

  // Determine if we're in custom mode based on URL params
  const hasCustomRange = searchParams.has("start") && searchParams.has("end");

  // Initialize from URL params
  useEffect(() => {
    const rangeParam = searchParams.get("range");

    // Check for custom range first
    if (hasCustomRange) {
      setSelectedValue("custom");
      const startParam = searchParams.get("start");
      const endParam = searchParams.get("end");
      if (startParam) setCustomStartDate(timestampToDateInput(parseInt(startParam, 10)));
      if (endParam) setCustomEndDate(timestampToDateInput(parseInt(endParam, 10)));
    } else if (rangeParam && dateRangeOptions.some((opt) => opt.value === rangeParam && opt.value !== "custom")) {
      setSelectedValue(rangeParam);
    }
  }, [searchParams, hasCustomRange]);

  // Keyboard navigation: Close picker on Escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isCustomPickerOpen) {
        handleCustomDateCancel();
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [isCustomPickerOpen]);

  // Handle preset selection
  const handlePresetSelect = useCallback((option: DateRangeOption) => {
    if (!option.getRange) return;

    const range = option.getRange();
    if (!range) return; // This is the "custom" option

    setSelectedValue(option.value);
    setCustomDateError("");
    setIsCustomPickerOpen(false);

    // Notify parent - parent/hook will update URL
    onChange?.({
      ...range,
      label: option.label,
      isCustom: false,
      preset: option.value,
    });
  }, [onChange]);

  // Handle custom date apply
  const handleCustomDateApply = useCallback(() => {
    // Validate dates
    if (!customStartDate || !customEndDate) {
      setCustomDateError("Please select both start and end dates");
      return;
    }

    const startTimestamp = dateToTimestamp(customStartDate);
    const endTimestamp = dateToTimestamp(customEndDate);

    // Validate start <= end
    if (startTimestamp > endTimestamp) {
      setCustomDateError("Start date must be before or equal to end date");
      return;
    }

    // Validate not future dates (compare at midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    if (startTimestamp > todayTimestamp || endTimestamp > todayTimestamp) {
      setCustomDateError("Cannot select future dates");
      return;
    }

    setCustomDateError("");
    setSelectedValue("custom");
    setIsCustomPickerOpen(false);

    // Notify parent - parent/hook will update URL
    onChange?.({
      start: startTimestamp,
      end: endTimestamp,
      label: formatDateRange(startTimestamp, endTimestamp),
      isCustom: true,
    });
  }, [customStartDate, customEndDate, onChange]);

  // Handle custom date cancel
  const handleCustomDateCancel = useCallback(() => {
    // Reset to previous valid state
    if (selectedValue !== "custom") {
      setCustomStartDate("");
      setCustomEndDate("");
    } else {
      // Restore current custom values from URL
      const startParam = searchParams.get("start");
      const endParam = searchParams.get("end");
      if (startParam) setCustomStartDate(timestampToDateInput(parseInt(startParam, 10)));
      if (endParam) setCustomEndDate(timestampToDateInput(parseInt(endParam, 10)));
    }
    setCustomDateError("");
    setIsCustomPickerOpen(false);
  }, [selectedValue, searchParams]);

  // Get the display label for the trigger button
  const getTriggerLabel = () => {
    if (selectedValue === "custom" && hasCustomRange) {
      const startParam = searchParams.get("start");
      const endParam = searchParams.get("end");
      if (startParam && endParam) {
        return formatDateRange(parseInt(startParam, 10), parseInt(endParam, 10));
      }
    }
    
    const selectedOption = dateRangeOptions.find((opt) => opt.value === selectedValue);
    return selectedOption?.label || "Last 30 days";
  };

  const selectedOption = dateRangeOptions.find((opt) => opt.value === selectedValue);

  return (
    <div className={cn("relative", className)}>
      <DropdownMenu open={isCustomPickerOpen} onOpenChange={setIsCustomPickerOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "gap-2 min-w-[140px] justify-between",
              selectedValue === "custom" && "border-brand-primary border-2",
              className
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
        <DropdownMenuContent align="end" className="w-48">
          {/* Preset options */}
          {dateRangeOptions
            .filter((opt) => opt.value !== "custom")
            .map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => handlePresetSelect(option)}
                className={cn(
                  "cursor-pointer text-[13px]",
                  selectedValue === option.value && "bg-accent font-medium"
                )}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          
          <DropdownMenuSeparator />
          
          {/* Custom option */}
          <div className="relative">
            <DropdownMenuItem
              onClick={() => {
                // Set default dates if not already set
                if (!customStartDate || !customEndDate) {
                  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
                  setCustomStartDate(timestampToDateInput(thirtyDaysAgo));
                  setCustomEndDate(timestampToDateInput(Date.now()));
                }
                setIsCustomPickerOpen(true);
              }}
              className={cn(
                "cursor-pointer text-[13px] flex items-center gap-2",
                selectedValue === "custom" && "bg-accent font-medium"
              )}
            >
              <Calendar className="w-3 h-3" />
              Custom
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom Date Picker Popover */}
      <Popover open={isCustomPickerOpen} onOpenChange={setIsCustomPickerOpen}>
        <PopoverContent className="w-auto p-4" align="end">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Select Custom Range</h4>
              <p className="text-sm text-muted-foreground">
                Choose a start and end date for your report.
              </p>
            </div>
            
            {/* Date inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-xs font-medium">
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setCustomDateError("");
                  }}
                  max={getMaxDateInput()}
                  className="h-9"
                  aria-label="Start date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-xs font-medium">
                  End Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setCustomDateError("");
                  }}
                  max={getMaxDateInput()}
                  className="h-9"
                  aria-label="End date"
                />
              </div>
            </div>

            {/* Error message with ARIA live region for screen readers */}
            <div aria-live="polite" aria-atomic="true">
              {customDateError && (
                <p className="text-sm text-destructive" role="alert">
                  {customDateError}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCustomDateCancel}
                className="h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCustomDateApply}
                className="h-8 bg-brand-primary hover:bg-brand-secondary"
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
