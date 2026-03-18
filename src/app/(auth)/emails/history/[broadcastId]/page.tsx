"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ArrowLeft,
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  MousePointerClick,
  Users,
  Download,
  Search,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type DeliveryStatus = "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained";

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  delivered: { label: "Delivered", variant: "default", color: "text-emerald-600" },
  opened: { label: "Opened", variant: "default", color: "text-emerald-600" },
  clicked: { label: "Clicked", variant: "default", color: "text-emerald-600" },
  bounced: { label: "Bounced", variant: "destructive", color: "text-red-600" },
  complained: { label: "Complained", variant: "destructive", color: "text-red-600" },
  queued: { label: "Queued", variant: "outline", color: "text-amber-600" },
  sent: { label: "Sent", variant: "secondary", color: "text-blue-600" },
};

export default function BroadcastDetailPage() {
  const params = useParams();
  const broadcastId = params.broadcastId as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Real-time subscription: broadcast details and stats update live
  const broadcast = useQuery(api.broadcasts.getBroadcast, {
    broadcastId: broadcastId as Id<"broadcastEmails">,
  });

  const stats = useQuery(api.broadcasts.getBroadcastStats, {
    broadcastId: broadcastId as Id<"broadcastEmails">,
  });

  const recipients = useQuery(
    api.broadcasts.getBroadcastRecipients,
    {
      broadcastId: broadcastId as Id<"broadcastEmails">,
      paginationOpts: { numItems: 20, cursor },
      searchQuery: searchQuery || undefined,
      statusFilter: statusFilter !== "all" ? (statusFilter as DeliveryStatus) : undefined,
    },
    // Reset cursor when filters change
    [searchQuery, statusFilter]
  );

  const exportData = useMutation(api.broadcasts.exportBroadcastData);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const csv = await exportData({ broadcastId: broadcastId as Id<"broadcastEmails"> });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const subject = broadcast?.subject ?? "broadcast";
      link.download = `broadcast-${subject.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  }, [exportData, broadcastId, broadcast?.subject]);

  if (broadcast === undefined || stats === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!broadcast) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-lg font-semibold">Broadcast not found</h2>
        <p className="text-muted-foreground mt-1">This broadcast may have been deleted.</p>
        <Button asChild className="mt-4">
          <Link href="/emails/history">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to History
          </Link>
        </Button>
      </div>
    );
  }

  const isSending = broadcast.status === "sending" || broadcast.status === "pending";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/emails/history"
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold truncate max-w-md">
              {broadcast.subject}
            </h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              {broadcast.sentAt ? (
                <>
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(broadcast.sentAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              ) : (
                "Not yet sent"
              )}
              {isSending && (
                <Badge variant="outline" className="ml-2">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  {broadcast.status === "sending" ? "Sending..." : "Pending"}
                </Badge>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Total</span>
            </div>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Send className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Sent</span>
            </div>
            <p className="text-3xl font-bold">{stats.sent}</p>
            {stats.total > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round((stats.sent / stats.total) * 100)}% of total
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Opened</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{stats.opened}</p>
            {stats.openRate > 0 && (
              <p className="text-xs text-emerald-600 mt-1 font-medium">
                {stats.openRate}% open rate
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MousePointerClick className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Clicked</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{stats.clicked}</p>
            {stats.clickRate > 0 && (
              <p className="text-xs text-blue-600 mt-1 font-medium">
                {stats.clickRate}% click rate
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delivery Funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Delivery Funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {isSending && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sending progress</span>
                <span className="font-medium">
                  {broadcast.sentCount}/{broadcast.recipientCount}
                </span>
              </div>
              <Progress
                value={broadcast.recipientCount > 0
                  ? (broadcast.sentCount / broadcast.recipientCount) * 100
                  : 0
                }
                className="h-3"
              />
            </div>
          )}

          {/* Funnel Bars */}
          {stats.sent > 0 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Delivered
                  </span>
                  <span className="font-medium">
                    {stats.delivered} ({stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-emerald-500" />
                    Opened
                  </span>
                  <span className="font-medium">
                    {stats.opened} ({stats.openRate}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${stats.openRate}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <MousePointerClick className="h-3.5 w-3.5 text-blue-500" />
                    Clicked
                  </span>
                  <span className="font-medium">
                    {stats.clicked} ({stats.clickRate}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${stats.clickRate}%` }}
                  />
                </div>
              </div>

              {(stats.bounced > 0 || stats.complained > 0) && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                        Bounced
                      </span>
                      <span className="font-medium text-red-600">
                        {stats.bounced} ({stats.bounceRate}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all"
                        style={{ width: `${stats.bounceRate}%` }}
                      />
                    </div>
                  </div>

                  {stats.complained > 0 && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg p-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>
                        {stats.complained} complaint{stats.complained > 1 ? "s" : ""} received
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {stats.sent === 0 && !isSending && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No emails sent yet. Delivery statistics will appear here once emails are processed.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recipient List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base">
              Recipients ({broadcast.sentCount}/{broadcast.recipientCount})
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCursor(null);
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setCursor(null);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="opened">Opened</SelectItem>
                  <SelectItem value="clicked">Clicked</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="complained">Complained</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recipients === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recipients.page.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recipients found</p>
              {searchQuery && <p className="text-sm mt-1">Try adjusting your search or filters</p>}
            </div>
          ) : (
            <>
              {/* Mobile Layout */}
              <div className="md:hidden divide-y">
                {recipients.page.map((recipient: Record<string, unknown>) => (
                  <div key={recipient._id as string} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {(recipient.affiliateName as string) ?? "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {recipient.recipientEmail as string}
                        </p>
                      </div>
                      {Boolean(recipient.deliveryStatus) ? (
                        <Badge
                          variant={(DELIVERY_STATUS_CONFIG[recipient.deliveryStatus as string]?.variant as "default" | "secondary" | "destructive" | "outline") ?? "outline"}
                          className="flex-shrink-0 text-xs"
                        >
                          {DELIVERY_STATUS_CONFIG[recipient.deliveryStatus as string]?.label ?? String(recipient.deliveryStatus)}
                        </Badge>
                      ) : null}
                    </div>
                    {Boolean(recipient.bounceReason) && (
                      <p className="text-xs text-red-600 mt-1">
                        {String(recipient.bounceReason)}
                      </p>
                    )}
                    {Boolean(recipient.deliveredAt) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Delivered {new Date(recipient.deliveredAt as number).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Layout */}
              <div className="hidden md:block">
                <div className="grid grid-cols-[1fr_180px_140px_160px] gap-4 px-6 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
                  <div>Recipient</div>
                  <div>Status</div>
                  <div>Delivered</div>
                  <div>Details</div>
                </div>
                <div className="divide-y">
                {recipients.page.map((recipient: Record<string, unknown>) => {
                  const statusConfig = DELIVERY_STATUS_CONFIG[recipient.deliveryStatus as string];
                    return (
                      <div
                        key={recipient._id as string}
                        className="grid grid-cols-[1fr_180px_140px_160px] gap-4 px-6 py-3 items-center"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {(recipient.affiliateName as string) ?? "Unknown"}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {recipient.recipientEmail as string}
                          </p>
                        </div>
                        <div>
                          {recipient.deliveryStatus ? (
                            <Badge
                              variant={statusConfig?.variant ?? "outline"}
                              className="flex-shrink-0"
                            >
                              {statusConfig?.label ?? (recipient.deliveryStatus as string)}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {recipient.deliveredAt
                            ? new Date(recipient.deliveredAt as number).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </div>
                        <div className="text-sm">
                          {Boolean(recipient.bounceReason) ? (
                            <span className="text-red-600">{String(recipient.bounceReason)}</span>
                          ) : null}
                          {Boolean(recipient.openedAt) ? (
                            <span className="text-emerald-600">
                              Opened {new Date(recipient.openedAt as number).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          ) : null}
                          {Boolean(recipient.clickedAt) ? (
                            <span className="text-blue-600 ml-2">
                              Clicked {new Date(recipient.clickedAt as number).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          ) : null}
                          {!recipient.bounceReason && !recipient.openedAt && !recipient.clickedAt ? "—" : null}
                        </div>
                      </div>
                    );
                })}
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Showing {recipients.page.length} recipients
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
                  {!recipients.isDone && recipients.continueCursor && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCursor(recipients.continueCursor)}
                    >
                      Load more
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
