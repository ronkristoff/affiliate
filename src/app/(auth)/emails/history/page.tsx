"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
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
  ArrowUpDown,
  Eye,
  MousePointerClick,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  sent: { label: "Sent", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  partial: { label: "Partial", variant: "secondary", icon: <AlertCircle className="h-3 w-3" /> },
  failed: { label: "Failed", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
  sending: { label: "Sending", variant: "outline", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  pending: { label: "Pending", variant: "outline", icon: <Loader2 className="h-3 w-3" /> },
};

type SortField = "date" | "subject" | "recipientCount";
type SortDirection = "asc" | "desc";
type DateRangeFilter = "all" | "7d" | "30d" | "90d";

export default function BroadcastHistoryPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("all");

  const broadcasts = useQuery(api.broadcasts.listBroadcasts, {
    paginationOpts: { numItems: 20, cursor },
  });

  const exportData = useAction(api.broadcasts.exportBroadcastData);

  // Filter and sort broadcasts client-side
  const filteredBroadcasts = (() => {
    if (!broadcasts?.page) return [];
    let items = [...broadcasts.page];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      items = items.filter((b: Record<string, unknown>) =>
        (b.subject as string).toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      items = items.filter((b: Record<string, unknown>) => b.status === statusFilter);
    }

    // Date range filter (AC1)
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
      items = items.filter((b: Record<string, unknown>) => {
        const sentAt = (b.sentAt as number) || (b._creationTime as number);
        return sentAt >= cutoffTime;
      });
    }

    // Sort
    items.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison = ((a.sentAt as number) || 0) - ((b.sentAt as number) || 0);
          break;
        case "subject":
          comparison = (a.subject as string).localeCompare(b.subject as string);
          break;
        case "recipientCount":
          comparison = (a.recipientCount as number) - (b.recipientCount as number);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return items;
  })();

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField]
  );

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

  const getOpenRate = (broadcast: Record<string, unknown>) => {
    const sent = broadcast.sentCount as number;
    const opened = (broadcast.openedCount as number) ?? 0;
    if (sent === 0) return "0%";
    return `${Math.round((opened / sent) * 100)}%`;
  };

  const getClickRate = (broadcast: Record<string, unknown>) => {
    const sent = broadcast.sentCount as number;
    const clicked = (broadcast.clickedCount as number) ?? 0;
    if (sent === 0) return "0%";
    return `${Math.round((clicked / sent) * 100)}%`;
  };

  if (broadcasts === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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

            {/* Date Range Filter (AC1) */}
            <Select value={dateRangeFilter} onValueChange={(v) => setDateRangeFilter(v as DateRangeFilter)}>
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

            {/* Sort */}
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
      {broadcasts.page.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No broadcasts yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              Send your first broadcast email to communicate with all active affiliates.
            </p>
            <Button asChild>
              <Link href="/emails/broadcast">
                <Send className="h-4 w-4 mr-2" />
                Send First Broadcast
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Column Headers */}
            <div className="hidden md:grid md:grid-cols-[1fr_120px_120px_100px_100px_120px_80px] gap-4 px-6 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
              <button
                onClick={() => handleSort("subject")}
                className="flex items-center gap-1 hover:text-foreground text-left"
              >
                Subject
                <ArrowUpDown className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleSort("date")}
                className="flex items-center gap-1 hover:text-foreground text-left"
              >
                Sent Date
                <ArrowUpDown className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleSort("recipientCount")}
                className="flex items-center gap-1 hover:text-foreground text-left"
              >
                Recipients
                <ArrowUpDown className="h-3 w-3" />
              </button>
              <div className="text-center">Status</div>
              <div className="text-center flex items-center justify-center gap-1">
                <Eye className="h-3 w-3" />
                Opens
              </div>
              <div className="text-center flex items-center justify-center gap-1">
                <MousePointerClick className="h-3 w-3" />
                Clicks
              </div>
              <div className="text-center">Actions</div>
            </div>

            <div className="divide-y">
              {filteredBroadcasts.length === 0 ? (
                <div className="px-6 py-8 text-center text-muted-foreground">
                  No broadcasts match your filters
                </div>
              ) : (
                filteredBroadcasts.map((broadcast: Record<string, unknown>) => {
                  const statusConfig = STATUS_CONFIG[broadcast.status as string] || STATUS_CONFIG.pending;
                  const id = broadcast._id as string;
                  return (
                    <Link
                      key={id}
                      href={`/emails/history/${id}`}
                      className="block hover:bg-muted/50 transition-colors"
                    >
                      {/* Mobile Layout */}
                      <div className="md:hidden px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {broadcast.subject as string}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {broadcast.sentCount as number}/{broadcast.recipientCount as number}
                              </span>
                              {(broadcast.sentAt as number) && (
                                <span>
                                  {new Date(broadcast.sentAt as number).toLocaleDateString("en-US", {
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

                      {/* Desktop Layout */}
                      <div className="hidden md:grid md:grid-cols-[1fr_120px_120px_100px_100px_120px_80px] gap-4 px-6 py-3 items-center">
                        <p className="font-medium truncate">
                          {broadcast.subject as string}
                        </p>
                        {(broadcast.sentAt as number) ? (
                          <span className="text-sm text-muted-foreground">
                            {new Date(broadcast.sentAt as number).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {(broadcast.sentCount as number)}/{(broadcast.recipientCount as number)}
                        </span>
                        <div className="flex justify-center">
                          <Badge
                            variant={statusConfig.variant}
                            className="flex items-center gap-1"
                          >
                            {statusConfig.icon}
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="text-center text-sm font-medium text-emerald-600">
                          {getOpenRate(broadcast)}
                        </div>
                        <div className="text-center text-sm font-medium text-blue-600">
                          {getClickRate(broadcast)}
                        </div>
                        <div className="flex justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleExport(id);
                            }}
                            disabled={exportingId === id}
                          >
                            {exportingId === id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Pagination */}
            {broadcasts.page.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredBroadcasts.length} of {broadcasts.page.length} broadcasts
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
