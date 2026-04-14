"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchField } from "@/components/ui/SearchField";
import { Badge } from "@/components/ui/badge";
import { AffiliateTimeline } from "./components/AffiliateTimeline";
import { getAuditActionLabel } from "@/lib/audit-constants";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import {
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  User,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

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

interface AffiliateSummary {
  _id: string;
  name?: string;
  email?: string;
  status: string;
  issueCount: number;
  lastActivityTime: number;
  latestAction: string;
  hasIssues: boolean;
}

function AffiliateRow({
  affiliate,
  isExpanded,
  onToggle,
  dateRange,
}: {
  affiliate: AffiliateSummary;
  isExpanded: boolean;
  onToggle: () => void;
  dateRange: DateRange;
}) {
  const displayName = affiliate.name || affiliate.email || "Unknown Affiliate";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Affiliate Header */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 p-3 text-left transition-colors",
          isExpanded ? "bg-muted/50" : "hover:bg-muted/30"
        )}
      >
        {/* Expand Icon */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
          )}
        </div>

        {/* Avatar */}
        <div
          className={cn(
            "flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-medium",
            affiliate.hasIssues
              ? "bg-amber-100 text-amber-700"
              : "bg-green-100 text-green-700"
          )}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--text-heading)] truncate">
              {displayName}
            </span>
            {affiliate.hasIssues && (
              <Badge
                variant="outline"
                className="text-[10px] font-medium bg-amber-50 text-amber-700 border-amber-200"
              >
                {affiliate.issueCount} issue{affiliate.issueCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {affiliate.hasIssues ? (
              <span className="text-amber-600">
                {getAuditActionLabel(affiliate.latestAction)}
              </span>
            ) : (
              <span>
                Last activity: {formatRelativeTime(affiliate.lastActivityTime)}
              </span>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex-shrink-0">
          {affiliate.hasIssues ? (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
        </div>
      </button>

      {/* Expanded Timeline */}
      {isExpanded && (
        <div className="border-t bg-[var(--bg-page)]">
          <AffiliateTimeline
            affiliateId={affiliate._id as any}
            affiliateName={displayName}
            startDate={getStartTime(dateRange)}
          />
        </div>
      )}
    </div>
  );
}

export function ActivityLogClient() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [affiliateSearch, setAffiliateSearch] = useState("");
  const [showIssuesOnly, setShowIssuesOnly] = useState(true);
  const [expandedAffiliateId, setExpandedAffiliateId] = useState<
    string | null
  >(null);

  const summaryResult = useQuery(api.audit.getAffiliateActivitySummary, {
    search: affiliateSearch || undefined,
    startDate: getStartTime(dateRange),
    issuesOnly: showIssuesOnly || undefined,
  });

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
    setExpandedAffiliateId(null);
  }, []);

  const handleAffiliateSearch = useCallback((value: string) => {
    setAffiliateSearch(value);
    setExpandedAffiliateId(null);
  }, []);

  const handleAffiliateToggle = useCallback((affiliateId: string) => {
    setExpandedAffiliateId((prev) => (prev === affiliateId ? null : affiliateId));
  }, []);

  const affiliates: AffiliateSummary[] = summaryResult?.affiliates ?? [];
  const issuesAffiliates = affiliates.filter((a: AffiliateSummary) => a.hasIssues);
  const clearAffiliates = affiliates.filter((a: AffiliateSummary) => !a.hasIssues);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-heading)] flex items-center gap-2">
            {showIssuesOnly ? (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Issues Requiring Attention
              </>
            ) : (
              <>
                <User className="h-5 w-5 text-[var(--text-muted)]" />
                All Affiliates
              </>
            )}
          </h1>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            {showIssuesOnly
              ? "Affiliates with recent issues that may need your review"
              : "Activity summary for all affiliates"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <SearchField
            value={affiliateSearch}
            onChange={handleAffiliateSearch}
            placeholder="Search affiliates..."
            size="sm"
            clearable
          />

          {/* Date Range */}
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

          {/* Toggle */}
          <Button
            variant={showIssuesOnly ? "outline" : "secondary"}
            size="sm"
            onClick={() => setShowIssuesOnly(!showIssuesOnly)}
            className="gap-2 text-[12px]"
          >
            {showIssuesOnly ? "Show All Affiliates" : "Show Issues Only"}
          </Button>
        </div>
      </div>

      {/* Content */}
      {summaryResult === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : affiliates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-page)]">
            {showIssuesOnly ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <User className="h-6 w-6 text-[var(--text-muted)]" />
            )}
          </div>
          <h3 className="text-[13px] font-semibold text-[var(--text-heading)]">
            {showIssuesOnly ? "All Clear!" : "No Affiliates Found"}
          </h3>
          <p className="mt-1 text-[12px] text-[var(--text-muted)] max-w-sm mx-auto">
            {showIssuesOnly
              ? "No affiliates have issues requiring attention."
              : affiliateSearch
                ? "No affiliates match your search."
                : "You don't have any affiliates yet."}
          </p>
          {showIssuesOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIssuesOnly(false)}
              className="mt-4 text-[12px]"
            >
              View All Affiliates
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Issues Section */}
          {issuesAffiliates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-medium text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Needs Attention ({issuesAffiliates.length})
              </div>
              <div className="space-y-2">
                {issuesAffiliates.map((affiliate: AffiliateSummary) => (
                  <AffiliateRow
                    key={affiliate._id}
                    affiliate={affiliate}
                    isExpanded={expandedAffiliateId === affiliate._id}
                    onToggle={() => handleAffiliateToggle(affiliate._id)}
                    dateRange={dateRange}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Clear Section */}
          {clearAffiliates.length > 0 && !showIssuesOnly && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-medium text-green-700">
                <CheckCircle className="h-3.5 w-3.5" />
                All Clear ({clearAffiliates.length})
              </div>
              <div className="space-y-2">
                {clearAffiliates.map((affiliate: AffiliateSummary) => (
                  <AffiliateRow
                    key={affiliate._id}
                    affiliate={affiliate}
                    isExpanded={expandedAffiliateId === affiliate._id}
                    onToggle={() => handleAffiliateToggle(affiliate._id)}
                    dateRange={dateRange}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
