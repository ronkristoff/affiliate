"use client";

import { Suspense, useCallback, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useQueryState,
  parseAsString,
  parseAsBoolean,
} from "nuqs";
import { toast } from "sonner";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DateCell } from "@/components/ui/DataTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  Bug,
  Loader2,
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorLogEntry {
  _id: Id<"errorLogs">;
  _creationTime: number;
  severity: "error" | "warning" | "info";
  source: string;
  message: string;
  stackTrace?: string;
  metadata?: unknown;
  resolved?: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

interface ErrorStats {
  total: number;
  unresolved: number;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeverityConfig(severity: string) {
  switch (severity) {
    case "error":
      return {
        label: "Error",
        variant: "destructive" as const,
        icon: <XCircle className="w-3.5 h-3.5" />,
        bg: "bg-red-50",
        text: "text-red-600",
        border: "border-red-200",
      };
    default:
      return {
        label: severity,
        variant: "neutral" as const,
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        bg: "bg-gray-50",
        text: "text-gray-600",
        border: "border-gray-200",
      };
  }
}

function formatMetadata(metadata: unknown): string | null {
  if (metadata === null || metadata === undefined) return null;
  if (typeof metadata === "string") return metadata.length > 200 ? metadata.slice(0, 200) + "..." : metadata;
  try {
    const str = JSON.stringify(metadata, null, 2);
    return str.length > 500 ? str.slice(0, 500) + "\n..." : str;
  } catch {
    return null;
  }
}

function truncateMessage(message: string, maxLen = 120): string {
  return message.length > maxLen ? message.slice(0, maxLen) + "..." : message;
}

// ---------------------------------------------------------------------------
// Error Detail Dialog
// ---------------------------------------------------------------------------

function ErrorDetailDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: ErrorLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!entry) return null;

  const config = getSeverityConfig(entry.severity);
  const metaStr = formatMetadata(entry.metadata);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center ${config.text}`}>
              {config.icon}
            </div>
            Error Detail
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={config.variant}>{config.label}</Badge>
            <Badge variant="outline">{entry.source}</Badge>
            {entry.resolved ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Resolved
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" />
                Unresolved
              </Badge>
            )}
          </div>

          <div>
            <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Message
            </div>
            <div className="text-[13px] text-[var(--text-heading)] bg-[var(--bg-page)] rounded-lg p-3 font-mono break-words">
              {entry.message}
            </div>
          </div>

          {entry.stackTrace && (
            <div>
              <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Stack Trace
              </div>
              <pre className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-page)] rounded-lg p-3 overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
                {entry.stackTrace}
              </pre>
            </div>
          )}

          {metaStr && (
            <div>
              <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Metadata
              </div>
              <pre className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-page)] rounded-lg p-3 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                {metaStr}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-light)]">
            <span>ID: {entry._id}</span>
            <span>
              Logged: <DateCell value={entry._creationTime} format="relative-full" size="sm" />
            </span>
            {entry.resolvedAt && entry.resolvedBy && (
              <span>
                Resolved by {entry.resolvedBy} at{" "}
                <DateCell value={entry.resolvedAt} format="relative-full" size="sm" />
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Stats Cards
// ---------------------------------------------------------------------------

function StatsCards({ stats }: { stats: ErrorStats | undefined }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <MetricCard
        label="Total Errors"
        numericValue={stats?.total ?? 0}
        isLoading={stats === undefined}
        variant="blue"
        icon={<Bug className="w-4 h-4" />}
      />
      <MetricCard
        label="Unresolved"
        numericValue={stats?.unresolved ?? 0}
        isLoading={stats === undefined}
        variant="red"
        icon={<AlertCircle className="w-4 h-4" />}
      />
      <MetricCard
        label="Errors"
        numericValue={stats?.bySeverity?.error ?? 0}
        isLoading={stats === undefined}
        variant="red"
        icon={<XCircle className="w-4 h-4" />}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error Log Row
// ---------------------------------------------------------------------------

function ErrorLogRow({
  entry,
  onView,
  onResolve,
  resolvingId,
}: {
  entry: ErrorLogEntry;
  onView: (entry: ErrorLogEntry) => void;
  onResolve: (id: Id<"errorLogs">) => void;
  resolvingId: Id<"errorLogs"> | null;
}) {
  const config = getSeverityConfig(entry.severity);
  const metaPreview = entry.metadata
    ? (() => {
        if (typeof entry.metadata === "string") return entry.metadata.length > 80 ? entry.metadata.slice(0, 80) + "..." : entry.metadata;
        try {
          const s = JSON.stringify(entry.metadata);
          return s.length > 80 ? s.slice(0, 80) + "..." : s;
        } catch { return null; }
      })()
    : null;

  return (
    <div className="group px-5 py-3.5 border-b border-[var(--border-light)] last:border-b-0 hover:bg-[var(--brand-light)]/20 transition-colors">
      <div className="flex items-start gap-3.5">
        <div className={`mt-0.5 w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center ${config.text} shrink-0`}>
          {config.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={config.variant}>{config.label}</Badge>
            <Badge variant="outline">{entry.source}</Badge>
            {entry.resolved ? (
              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                <CheckCircle2 className="w-3 h-3" />
                Resolved
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                Unresolved
              </Badge>
            )}
          </div>

          <div className="mt-1.5 text-[13px] text-[var(--text-heading)] break-words">
            {truncateMessage(entry.message)}
          </div>

          {metaPreview && (
            <div className="mt-1 text-[11px] text-[var(--text-muted)] font-mono bg-[var(--bg-page)] rounded-md px-2 py-1 max-w-[500px] truncate">
              {metaPreview}
            </div>
          )}

          {entry.resolvedBy && (
            <div className="mt-1 text-[10px] text-[var(--text-muted)]">
              Resolved by {entry.resolvedBy}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView(entry)}
            className="h-7 px-2 text-[12px] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {!entry.resolved && (
            <Button
              variant="ghost"
              size="sm"
              disabled={resolvingId === entry._id}
              onClick={() => onResolve(entry._id)}
              className="h-7 px-2 text-[12px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {resolvingId === entry._id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
          <div className="text-right">
            <DateCell value={entry._creationTime} format="relative-full" size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function ErrorLogsContent() {
  const [source, setSource] = useQueryState("source", parseAsString.withDefault(""));
  const [showUnresolved, setShowUnresolved] = useQueryState("unresolved", parseAsBoolean.withDefault(false));

  const [selectedEntry, setSelectedEntry] = useState<ErrorLogEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<Id<"errorLogs"> | null>(null);

  const stats = useQuery(api.errorLogs.getErrorStats, {});
  const logs = useQuery(api.errorLogs.getErrorLogs, {
    severity: "error",
    source: source || undefined,
    resolved: showUnresolved ? false : undefined,
    limit: 100,
  });

  const currentUser = useQuery(api.auth.getCurrentUser);
  const resolveError = useMutation(api.errorLogs.resolveErrorLog);

  const handleView = useCallback((entry: ErrorLogEntry) => {
    setSelectedEntry(entry);
    setDetailOpen(true);
  }, []);

  const handleResolve = useCallback(
    async (id: Id<"errorLogs">) => {
      const resolvedBy = currentUser?.name || currentUser?.email || "admin";
      setResolvingId(id);
      try {
        await resolveError({ errorLogId: id, resolvedBy });
        toast.success("Error marked as resolved");
        setSelectedEntry((prev) =>
          prev && prev._id === id
            ? { ...prev, resolved: true, resolvedAt: Date.now(), resolvedBy }
            : prev,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to resolve error");
      } finally {
        setResolvingId(null);
      }
    },
    [resolveError, currentUser],
  );

  const isLoading = logs === undefined;
  const entries = logs ?? [];
  const hasFilters = source !== "" || showUnresolved;

  const handleClearAll = useCallback(() => {
    setSource("");
    setShowUnresolved(false);
  }, [setSource, setShowUnresolved]);

  const sources = stats?.bySource ? Object.keys(stats.bySource).sort() : [];

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <PageTopbar description="View and manage platform error and exception logs">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          Error Logs
        </h1>
      </PageTopbar>

      <div className="px-8 pt-6 pb-8">
        <div className="space-y-5">
          <FadeIn delay={0}>
            <StatsCards stats={stats} />
          </FadeIn>

          <FadeIn delay={60}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                <Filter className="w-3.5 h-3.5" />
                Filters:
              </div>

              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="h-8 rounded-lg border border-[var(--border-light)] bg-white px-2.5 text-[12px] text-[var(--text-body)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/40"
              >
                <option value="">All Sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowUnresolved((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                  showUnresolved
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "border-[var(--border-light)] text-[var(--text-muted)] hover:bg-[var(--bg-page)]"
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Unresolved only
              </button>

              {hasFilters && (
                <button
                  onClick={handleClearAll}
                  className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-heading)] underline underline-offset-2 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </FadeIn>

          <FadeIn delay={120}>
            <div className="bg-white rounded-xl overflow-hidden border border-[var(--border-light)] shadow-sm">
              <div className="h-px bg-gradient-to-r from-transparent via-red-200/40 to-transparent" />

              {isLoading ? (
                <div className="divide-y divide-[var(--border-light)]">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-start gap-3.5">
                      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-16 rounded-md" />
                          <Skeleton className="h-5 w-20 rounded-md" />
                          <Skeleton className="h-5 w-16 rounded-md" />
                        </div>
                        <Skeleton className="h-4 w-80" />
                      </div>
                      <Skeleton className="h-3 w-20" />
                    </div>
                  ))}
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium mb-1">No error logs found</p>
                  <p className="text-[12px]">
                    {hasFilters ? "Try adjusting your filters." : "Everything is running smoothly."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-light)]">
                  {entries.map((entry) => (
                    <ErrorLogRow
                      key={entry._id}
                      entry={entry}
                      onView={handleView}
                      onResolve={handleResolve}
                      resolvingId={resolvingId}
                    />
                  ))}
                </div>
              )}

              <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/10 to-transparent" />
            </div>
          </FadeIn>

          {entries.length > 0 && (
            <div className="text-[11px] text-[var(--text-muted)] text-center">
              Showing up to 100 most recent entries
            </div>
          )}
        </div>
      </div>

      <ErrorDetailDialog
        entry={selectedEntry}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton & Page Export
// ---------------------------------------------------------------------------

function ErrorLogsSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--border-light)] px-8 py-3">
        <Skeleton className="h-5 w-28 mb-1" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="px-8 pt-6 pb-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <div className="bg-white rounded-xl border border-[var(--border-light)] overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-5 py-3.5 flex items-start gap-3.5 border-b border-[var(--border-light)]">
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <Skeleton className="h-4 w-80" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ErrorLogsPage() {
  return (
    <Suspense fallback={<ErrorLogsSkeleton />}>
      <ErrorLogsContent />
    </Suspense>
  );
}
