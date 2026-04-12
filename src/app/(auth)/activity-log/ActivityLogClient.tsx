"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";
import { AuditLogEntry } from "./components/AuditLogEntry";
import { EntityStoryDrawer } from "./components/EntityStoryDrawer";
import { getAuditActionLabel } from "@/lib/audit-constants";
import { cn } from "@/lib/utils";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const ENTITY_TABS: FilterTabItem[] = [
  { key: "all", label: "All" },
  { key: "commission", label: "Commissions" },
  { key: "conversion", label: "Conversions" },
  { key: "click", label: "Clicks" },
  { key: "affiliate", label: "Affiliates" },
  { key: "payoutBatches", label: "Payouts" },
];

type DateRange = "7d" | "30d" | "90d" | "all";

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

function getStartTime(range: DateRange): number | undefined {
  if (range === "all") return undefined;
  const now = Date.now();
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range] ?? 30;
  return now - days * 24 * 60 * 60 * 1000;
}

function getEntityTypeFilter(tab: string): string | undefined {
  return tab === "all" ? undefined : tab;
}

export function ActivityLogClient() {
  const [entityTab, setEntityTab] = useState("all");
  const [actionFilter, setActionFilter] = useState<string | undefined>(
    undefined
  );
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [paginationCursor, setPaginationCursor] = useState<
    string | undefined
  >(undefined);

  const [drawerState, setDrawerState] = useState<{
    open: boolean;
    entityType: string;
    entityId: string;
  }>({
    open: false,
    entityType: "",
    entityId: "",
  });

  const actionTypes = useQuery(api.audit.getActivityLogActionTypes, {});

  const queryArgs = useMemo(() => {
    const startTime = getStartTime(dateRange);
    const entityType = getEntityTypeFilter(entityTab);

    return {
      paginationOpts: {
        numItems: 20,
        cursor: paginationCursor ?? null,
      },
      entityType,
      action: actionFilter,
      startDate: startTime,
    };
  }, [entityTab, actionFilter, dateRange, paginationCursor]);

  const logsResult = useQuery(api.audit.listTenantAuditLogs, queryArgs);

  const handleTabChange = useCallback((key: string) => {
    setEntityTab(key);
    setPaginationCursor(undefined);
  }, []);

  const handleActionChange = useCallback((value: string) => {
    setActionFilter(value === "all" ? undefined : value);
    setPaginationCursor(undefined);
  }, []);

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
    setPaginationCursor(undefined);
  }, []);

  const handleEntityClick = useCallback(
    (entityType: string, entityId: string) => {
      setDrawerState({ open: true, entityType, entityId });
    },
    []
  );

  const handleDrawerClose = useCallback(() => {
    setDrawerState((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          <FilterTabs
            tabs={ENTITY_TABS}
            activeTab={entityTab}
            onTabChange={handleTabChange}
            size="sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={actionFilter ?? "all"}
            onValueChange={handleActionChange}
          >
            <SelectTrigger size="sm" className="w-[180px] text-[12px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[12px]">
                All actions
              </SelectItem>
              {actionTypes &&
                actionTypes.map((action: string) => (
                  <SelectItem key={action} value={action} className="text-[12px]">
                    {getAuditActionLabel(action)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
            {DATE_RANGES.map((range) => (
              <button
                key={range.key}
                type="button"
                onClick={() => handleDateRangeChange(range.key)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors",
                  dateRange === range.key
                    ? "bg-[var(--brand-primary)] text-white"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-page)]"
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feed */}
      {logsResult === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border"
            >
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : logsResult.page.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-page)]">
            <Clock className="h-6 w-6 text-[var(--text-muted)]" />
          </div>
          <h3 className="text-[13px] font-semibold text-[var(--text-heading)]">
            No Activity Found
          </h3>
          <p className="mt-1 text-[12px] text-[var(--text-muted)] max-w-sm mx-auto">
            No audit log entries match your current filters. Try adjusting the
            date range or entity type.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logsResult.page.map((log: any) => (
            <AuditLogEntry
              key={log._id}
              log={log}
              onEntityClick={handleEntityClick}
            />
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              disabled={paginationCursor === undefined}
              onClick={() => setPaginationCursor(undefined)}
              className="text-[12px]"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Newer
            </Button>
            <span className="text-[12px] text-[var(--text-muted)]">
              {logsResult.page.length} entries
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={logsResult.isDone}
              onClick={() =>
                setPaginationCursor(logsResult.continueCursor ?? undefined)
              }
              className="text-[12px]"
            >
              Older
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Entity Story Drawer */}
      <EntityStoryDrawer
        open={drawerState.open}
        onClose={handleDrawerClose}
        entityType={drawerState.entityType}
        entityId={drawerState.entityId}
      />
    </div>
  );
}
