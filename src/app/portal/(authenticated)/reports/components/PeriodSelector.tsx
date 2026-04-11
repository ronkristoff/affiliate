"use client";

import { useMemo } from "react";
import { useQueryState } from "nuqs";
import { parseAsString } from "nuqs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

function getPeriodDates(period: string): { startDate: number; endDate: number } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  switch (period) {
    case "7d":
      start.setDate(start.getDate() - 6);
      return { startDate: start.getTime(), endDate: end.getTime() };
    case "30d":
      start.setDate(start.getDate() - 29);
      return { startDate: start.getTime(), endDate: end.getTime() };
    case "90d":
      start.setDate(start.getDate() - 89);
      return { startDate: start.getTime(), endDate: end.getTime() };
    case "this_month":
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime(),
        endDate: end.getTime(),
      };
    case "last_month": {
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const endOfLastMonth = new Date(firstOfThisMonth.getTime() - 1);
      return { startDate: firstOfLastMonth.getTime(), endDate: endOfLastMonth.getTime() };
    }
    default:
      start.setDate(start.getDate() - 29);
      return { startDate: start.getTime(), endDate: end.getTime() };
  }
}

export function useReportPeriod() {
  const [period, setPeriod] = useQueryState("period", parseAsString.withDefault("30d"));

  const { startDate, endDate } = useMemo(
    () => getPeriodDates(period),
    [period],
  );

  const previousPeriodDates = useMemo(() => {
    const duration = endDate - startDate;
    const prevEnd = new Date(startDate).getTime() - 1;
    const prevStart = prevEnd - duration + 1;
    return { startDate: prevStart, endDate: prevEnd };
  }, [startDate, endDate]);

  return {
    period,
    setPeriod,
    startDate,
    endDate,
    previousPeriodDates,
  };
}

export function PeriodSelector() {
  const { period, setPeriod } = useReportPeriod();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {PERIOD_OPTIONS.map((option) => {
        const isActive = period === option.value;
        return (
          <Button
            key={option.value}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(option.value)}
            className={cn(
              isActive
                ? "bg-[var(--portal-primary)] text-white"
                : ""
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
