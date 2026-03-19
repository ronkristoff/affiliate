"use client";

import { useState, useCallback, useMemo, Suspense } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  History,
  Mail,
  Send,
  ArrowLeft,
  Users,
  AlertCircle,
  CheckCircle2,
  Download,
  Search,
  Eye,
  MousePointerClick,
} from "lucide-react";
import Link from "next/link";
import {
  DataTable,
  type TableColumn,
  type TableAction,
  DateCell,
} from "@/components/ui/DataTable";
import {
  useQueryState,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Broadcast {
  _id: string;
  subject: string;
  sentAt?: number;
  _creationTime: number;
  recipientCount: number;
  sentCount: number;
  openedCount?: number;
  clickedCount?: number;
  status: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  sent: { label: "Sent", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  partial: { label: "Partial", variant: "secondary", icon: <AlertCircle className="h-3 w-3" /> },
  failed: { label: "Failed", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
  sending: { label: "Sending", variant: "outline", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  pending: { label: "Pending", variant: "outline", icon: <Loader2 className="h-3 w-3" /> },
};

type SortField = "date" | "subject" | "recipientCount";
type SortDirection = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOpenRate(b: Broadcast): string {
  const sent = b.sentCount;
  const opened = b.openedCount ?? 0;
  if (sent === 0) return "0%";
  return `${Math.round((opened / sent) * 100)}%`;
}

function getClickRate(b: Broadcast): string {
  const sent = b.sentCount;
  const clicked = b.clickedCount ?? 0;
  if (sent === 0) return "0%";
  return `${Math.round((clicked / sent) * 100)}%`;
}

// ---------------------------------------------------------------------------
// Column Config for Desktop DataTable
// ---------------------------------------------------------------------------

function buildBroadcastColumns(
  sortField: SortField,
  sortDirection: SortDirection,
  onSortChange: (field: string, order: "asc" | "desc") => void,
  exportingId: string | null,
  onExport: (id: string) => void
): { columns: TableColumn<Broadcast>[]; actions: TableAction<Broadcast>[] } {
  const columns: TableColumn<Broadcast>[] = [
    {
      key: "subject",
      header: "Subject",
      sortable: true,
      sortField: "subject",
      cell: (row) => (
        <Link
          href={`/emails/history/${row._id}`}
          className="font-medium truncate hover:text-[#10409a] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.subject}
        </Link>
      ),
    },
    {
      key: "sentAt",
      header: "Sent Date",
      sortable: true,
      sortField: "sentAt",
      width: "120px",
      cell: (row) =>
        row.sentAt ? (
          <DateCell value={row.sentAt} format="short" />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "recipientCount",
      header: "Recipients",
      sortable: true,
      sortField: "recipientCount",
      align: "right",
      width: "120px",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.sentCount}/{row.recipientCount}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      width: "100px",
      cell: (row) => {
        const config = STATUS_CONFIG[row.status] || STATUS_CONFIG.pending;
        return (
          <Badge
            variant={config.variant}
            className="flex items-center gap-1"
          >
            {config.icon}
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: "opens",
      header: "Opens",
      align: "center",
      width: "100px",
      cell: (row) => (
        <span className="text-center text-sm font-medium text-emerald-600">
          {getOpenRate(row)}
        </span>
      ),
    },
    {
      key: "clicks",
      header: "Clicks",
      align: "center",
      width: "120px",
      cell: (row) => (
        <span className="text-center text-sm font-medium text-blue-600">
          {getClickRate(row)}
        </span>
      ),
    },
  ];

  const actions: TableAction<Broadcast>[] = [
    {
      label: "",
      variant: "outline",
      disabled: (row) => exportingId === row._id,
      onClick: (row) => onExport(row._id),
      icon: exportingId ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      ),
    },
  ];

  return { columns, actions };
}

function BroadcastHistoryPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // URL state via nuqs
  const [searchQuery, setSearchQuery] = useQueryState(
    "search",
    parseAsString.withDefault("")
  );
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsStringLiteral(["all", "sent", "partial", "failed", "sending"]).withDefault("all")
  );
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dateRangeFilter, setDateRangeFilter] = useQueryState(
    "range",
    parseAsStringLiteral(["all", "7d", "30d", "90d"]).withDefault("all")
  );

  const broadcasts = useQuery(api.broadcasts.listBroadcasts, {
    paginationOpts: { numItems: 20, cursor },
  });

  const exportData = useAction(api.broadcasts.exportBroadcastData);

  // Map DataTable sort field back to our SortField type
  const handleDataTableSort = useCallback(
    (field: string, order: "asc" | "desc") => {
      // Map DataTable field names to our SortField
      const fieldMap: Record<string, SortField> = {
        subject: "subject",
        sentAt: "date",
        recipientCount: "recipientCount",
      };
      const mappedField = fieldMap[field] || "date";
      setSortField(mappedField);
      setSortDirection(order);
    },
    []
  );

  // Filter broadcasts client-side
  const filteredBroadcasts = useMemo(() => {
    if (!broadcasts?.page) return [];
    const items = broadcasts.page as Broadcast[];

    // Search filter
    let filtered = items;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((b) =>
        b.subject.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    // Date range filter
    if (dateRangeFilter !== "all") {
      const now = Date.now();
      let cutoffTime: number;
      switch (dateRangeFilter) {
        case "7d":
          cutoffTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case "30d":
          cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
          break;
        case "90d":
          cutoffTime = now - 90 * 24 * 60 * 60 * 1000;
          break;
        default:
          cutoffTime = 0;
      }
      filtered = filtered.filter((b) => {
        const sentAt = b.sentAt || b._creationTime;
        return sentAt >= cutoffTime;
      });
    }

    return filtered;
  }, [broadcasts?.page, searchQuery, statusFilter, dateRangeFilter]);

  // Sort broadcasts client-side
  const sortedBroadcasts = useMemo(() => {
    const items = [...filteredBroadcasts];
    items.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison = ((a.sentAt as number) || 0) - ((b.sentAt as number) || 0);
          break;
        case "subject":
          comparison = a.subject.localeCompare(b.subject);
          break;
        case "recipientCount":
          comparison = a.recipientCount - b.recipientCount;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return items;
  }, [filteredBroadcasts, sortField, sortDirection]);

  const handleExport = useCallback(
    async (broadcastId: string) => {
      setExportingId(broadcastId);
      try {
        const csv = await exportData({ broadcastId: broadcastId as any });
        // Create download
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `broadcast-${broadcastId}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Export failed:", error);
      } finally {
        setExportingId(null);
      }
    },
    [exportData]
  );

  const { columns, actions } = buildBroadcastColumns(
    sortField,
    sortDirection,
    handleDataTableSort,
    exportingId,
    handleExport
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/emails/broadcast"
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Broadcast History</h1>
            <p className="text-muted-foreground mt-1">
              View previously sent broadcast emails with delivery tracking
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/emails/broadcast">
            <Send className="h-4 w-4 mr-2" />
            New Broadcast
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "sent" | "partial" | "failed" | "sending")}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Filter */}
            <Select value={dateRangeFilter} onValueChange={(v) => setDateRangeFilter(v as "all" | "7d" | "30d" | "90d")}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Dropdown — complementary control, synced with DataTable column headers */}
            <Select
              value={`${sortField}-${sortDirection}`}
              onValueChange={(v) => {
                const [field, dir] = v.split("-") as [SortField, SortDirection];
                setSortField(field);
                setSortDirection(dir);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest first</SelectItem>
                <SelectItem value="date-asc">Oldest first</SelectItem>
                <SelectItem value="subject-asc">Subject A-Z</SelectItem>
                <SelectItem value="subject-desc">Subject Z-A</SelectItem>
                <SelectItem value="recipientCount-desc">Most recipients</SelectItem>
                <SelectItem value="recipientCount-asc">Fewest recipients</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Broadcast List */}
      {broadcasts === undefined || broadcasts.page.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {broadcasts === undefined ? "Loading broadcasts..." : "No broadcasts yet"}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              {broadcasts === undefined
                ? ""
                : "Send your first broadcast email to communicate with all active affiliates."
              }
            </p>
            {broadcasts?.page.length === 0 && broadcasts.page.length === 0 && (
              <Button asChild>
                <Link href="/emails/broadcast">
                  <Send className="h-4 w-4 mr-2" />
                  Send First Broadcast
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Mobile Card Layout — preserved for md:hidden */}
            <div className="md:hidden divide-y">
              {sortedBroadcasts.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  No broadcasts match your filters
                </div>
              ) : (
                sortedBroadcasts.map((broadcast) => {
                  const statusConfig = STATUS_CONFIG[broadcast.status] || STATUS_CONFIG.pending;
                  return (
                    <Link
                      key={broadcast._id}
                      href={`/emails/history/${broadcast._id}`}
                      className="block hover:bg-muted/50 transition-colors"
                    >
                      <div className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {broadcast.subject}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {broadcast.sentCount}/{broadcast.recipientCount}
                              </span>
                              {broadcast.sentAt && (
                                <span>
                                  {new Date(broadcast.sentAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {getOpenRate(broadcast)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MousePointerClick className="h-3 w-3" />
                                {getClickRate(broadcast)}
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant={statusConfig.variant}
                            className="flex items-center gap-1 flex-shrink-0"
                          >
                            {statusConfig.icon}
                            {statusConfig.label}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Desktop DataTable — hidden on mobile */}
            <div className="hidden md:block">
              <DataTable<Broadcast>
                columns={columns}
                actions={actions}
                data={sortedBroadcasts}
                getRowId={(row) => row._id}
                isLoading={false}
                emptyMessage="No broadcasts match your filters"
                sortBy={sortField === "date" ? "sentAt" : sortField}
                sortOrder={sortDirection}
                onSortChange={handleDataTableSort}
              />
            </div>

            {/* Pagination */}
            {broadcasts.page.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Showing {sortedBroadcasts.length} of {broadcasts.page.length} broadcasts
                </p>
                <div className="flex gap-2">
                  {cursor && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCursor(null)}
                    >
                      First page
                    </Button>
                  )}
                  {!broadcasts.isDone && broadcasts.continueCursor && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCursor(broadcasts.continueCursor)}
                    >
                      Load more
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export default function BroadcastHistoryPageWrapper() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BroadcastHistoryPage />
    </Suspense>
  );
}
