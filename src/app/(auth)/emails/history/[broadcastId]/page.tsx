"use client";

import { useState, useCallback, Suspense } from "react";
import { useQuery, useAction } from "convex/react";
import { useParams } from "next/navigation";
import { useQueryState, parseAsArrayOf, parseAsString } from "nuqs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { FilterPillBar } from "@/components/ui/FilterPill";
import {
  Loader2,
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  MousePointerClick,
  Users,
  Search,
} from "lucide-react";
import Link from "next/link";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { ExportButton } from "@/components/ui/ExportButton";
import { FadeIn } from "@/components/ui/FadeIn";
import { MetricCard } from "@/components/ui/MetricCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained";

const DELIVERY_STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    color: string;
  }
> = {
  delivered: { label: "Delivered", variant: "default", color: "text-emerald-600" },
  opened: { label: "Opened", variant: "default", color: "text-emerald-600" },
  clicked: { label: "Clicked", variant: "default", color: "text-emerald-600" },
  bounced: { label: "Bounced", variant: "destructive", color: "text-red-600" },
  complained: { label: "Complained", variant: "destructive", color: "text-red-600" },
  queued: { label: "Queued", variant: "outline", color: "text-amber-600" },
  sent: { label: "Sent", variant: "secondary", color: "text-blue-600" },
};

const DELIVERY_STATUS_OPTIONS = Object.entries(DELIVERY_STATUS_CONFIG).map(
  ([value, cfg]) => ({ value, label: cfg.label })
);

// ---------------------------------------------------------------------------
// Broadcast Detail Content (client component with hooks)
// ---------------------------------------------------------------------------

function BroadcastDetailContent() {
  const params = useParams();
  const broadcastId = params.broadcastId as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useQueryState(
    "status",
    parseAsArrayOf(parseAsString).withDefault([])
  );
  const [cursor, setCursor] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const broadcast = useQuery(api.broadcasts.getBroadcast, {
    broadcastId: broadcastId as Id<"broadcastEmails">,
  });

  const stats = useQuery(api.broadcasts.getBroadcastStats, {
    broadcastId: broadcastId as Id<"broadcastEmails">,
  });

  const recipients = useQuery(api.broadcasts.getBroadcastRecipients, {
    broadcastId: broadcastId as Id<"broadcastEmails">,
    paginationOpts: { numItems: 20, cursor },
    searchQuery: searchQuery || undefined,
    statusFilter:
      selectedStatuses.length > 0
        ? (selectedStatuses as Array<"queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained">)
        : undefined,
  });

  const exportData = useAction(api.broadcasts.exportBroadcastData);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const csv = await exportData({
        broadcastId: broadcastId as Id<"broadcastEmails">,
      });
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
      <div className="px-8 pt-6 pb-8">
        <DetailSkeleton />
      </div>
    );
  }

  if (!broadcast) {
    return (
      <div className="px-8 pt-6 pb-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-[var(--bg-page)] p-4 mb-4">
            <Mail className="h-8 w-8 text-[var(--text-muted)]" />
          </div>
          <h2 className="text-lg font-semibold">Broadcast not found</h2>
          <p className="text-[var(--text-muted)] mt-1">
            This broadcast may have been deleted.
          </p>
          <Button size="sm" asChild className="mt-4">
            <Link href="/emails/history">Back to History</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isSending =
    broadcast.status === "sending" || broadcast.status === "pending";

  return (
    <>
      {/* Top Bar */}
      <PageTopbar
        description={
          broadcast.sentAt
            ? new Date(broadcast.sentAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Not yet sent"
        }
        className="top-[var(--sub-nav-h)]"
        actions={
          <ExportButton onClick={handleExport} isExporting={exporting} />
        }
      >
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-[var(--text-heading)] truncate max-w-md">
            {broadcast.subject}
          </h1>
          {isSending && (
            <Badge variant="outline" className="flex-shrink-0">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              {broadcast.status === "sending" ? "Sending..." : "Pending"}
            </Badge>
          )}
        </div>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8 space-y-6">
        {/* Stats Cards */}
        <FadeIn className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total"
            value={String(stats.total)}
            variant="gray"
            icon={<Users className="w-4 h-4" />}
          />
          <MetricCard
            label="Sent"
            value={String(stats.sent)}
            subtext={
              stats.total > 0
                ? `${Math.round((stats.sent / stats.total) * 100)}% of total`
                : undefined
            }
            variant="blue"
            icon={<Send className="w-4 h-4" />}
          />
          <MetricCard
            label="Opened"
            value={String(stats.opened)}
            subtext={
              stats.openRate > 0
                ? `${stats.openRate}% open rate`
                : undefined
            }
            variant="green"
            icon={<Eye className="w-4 h-4" />}
          />
          <MetricCard
            label="Clicked"
            value={String(stats.clicked)}
            subtext={
              stats.clickRate > 0
                ? `${stats.clickRate}% click rate`
                : undefined
            }
            variant="blue"
            icon={<MousePointerClick className="w-4 h-4" />}
          />
        </FadeIn>

        {/* Delivery Funnel */}
        <FadeIn delay={100}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Delivery Funnel</h3>
            </div>
            <div className="px-5 pb-5 space-y-4">
              {/* Progress Bar */}
              {isSending && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">
                      Sending progress
                    </span>
                    <span className="font-medium">
                      {broadcast.sentCount}/{broadcast.recipientCount}
                    </span>
                  </div>
                  <Progress
                    value={
                      broadcast.recipientCount > 0
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
                        {stats.delivered} (
                        {stats.sent > 0
                          ? Math.round((stats.delivered / stats.sent) * 100)
                          : 0}
                        %)
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--bg-page)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0}%`,
                        }}
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
                    <div className="h-2 bg-[var(--bg-page)] rounded-full overflow-hidden">
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
                    <div className="h-2 bg-[var(--bg-page)] rounded-full overflow-hidden">
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
                        <div className="h-2 bg-[var(--bg-page)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full transition-all"
                            style={{ width: `${stats.bounceRate}%` }}
                          />
                        </div>
                      </div>

                      {stats.complained > 0 && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-[var(--danger-bg)] rounded-lg p-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span>
                            {stats.complained} complaint
                            {stats.complained > 1 ? "s" : ""} received
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {stats.sent === 0 && !isSending && (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">
                  No emails sent yet. Delivery statistics will appear here once
                  emails are processed.
                </p>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Recipient List */}
        <FadeIn delay={200}>
          <div className="card">
            <div className="card-header">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="card-title">
                  Recipients ({broadcast.sentCount}/
                  {broadcast.recipientCount})
                </h3>
                <div className="flex gap-2">
                  <div className="relative flex-1 sm:w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
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
                  <MultiSelect
                    options={DELIVERY_STATUS_OPTIONS}
                    selected={selectedStatuses}
                    onChange={(values) => {
                      setSelectedStatuses(values);
                      setCursor(null);
                    }}
                    placeholder="All statuses"
                    popoverWidth="w-[180px]"
                  />
                </div>
                {selectedStatuses.length > 0 && (
                  <div className="mt-2">
                    <FilterPillBar
                      pills={selectedStatuses.map((s) => ({
                        key: s,
                        label: DELIVERY_STATUS_CONFIG[s]?.label ?? s,
                      }))}
                      onRemove={(key) => {
                        setSelectedStatuses(selectedStatuses.filter((s) => s !== key));
                      }}
                      onClearAll={() => {
                        setSelectedStatuses([]);
                        setCursor(null);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {recipients === undefined ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : recipients.page.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recipients found</p>
                {searchQuery && (
                  <p className="text-sm mt-1">
                    Try adjusting your search or filters
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Layout */}
                <div className="md:hidden divide-y">
                  {recipients.page.map(
                    (recipient: Record<string, unknown>) => (
                      <div
                        key={recipient._id as string}
                        className="px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">
                              {(recipient.affiliateName as string) ??
                                "Unknown"}
                            </p>
                            <p className="text-sm text-[var(--text-muted)] truncate">
                              {recipient.recipientEmail as string}
                            </p>
                          </div>
                          {Boolean(recipient.deliveryStatus) ? (
                            <Badge
                              variant={
                                (DELIVERY_STATUS_CONFIG[
                                  recipient.deliveryStatus as string
                                ]?.variant as
                                  | "default"
                                  | "secondary"
                                  | "destructive"
                                  | "outline") ?? "outline"
                              }
                              className="flex-shrink-0 text-xs"
                            >
                              {DELIVERY_STATUS_CONFIG[
                                recipient.deliveryStatus as string
                              ]?.label ?? String(recipient.deliveryStatus)}
                            </Badge>
                          ) : null}
                        </div>
                        {Boolean(recipient.bounceReason) && (
                          <p className="text-xs text-red-600 mt-1">
                            {String(recipient.bounceReason)}
                          </p>
                        )}
                        {Boolean(recipient.deliveredAt) && (
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            Delivered{" "}
                            {new Date(
                              recipient.deliveredAt as number
                            ).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:block">
                  <div className="grid grid-cols-[1fr_180px_140px_160px] gap-4 px-6 py-3 border-b bg-[var(--bg-page)] text-sm font-medium text-[var(--text-muted)]">
                    <div>Recipient</div>
                    <div>Status</div>
                    <div>Delivered</div>
                    <div>Details</div>
                  </div>
                  <div className="divide-y">
                    {recipients.page.map(
                      (recipient: Record<string, unknown>) => {
                        const statusConfig =
                          DELIVERY_STATUS_CONFIG[
                            recipient.deliveryStatus as string
                          ];
                        return (
                          <div
                            key={recipient._id as string}
                            className="grid grid-cols-[1fr_180px_140px_160px] gap-4 px-6 py-3 items-center"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">
                                {(recipient.affiliateName as string) ??
                                  "Unknown"}
                              </p>
                              <p className="text-sm text-[var(--text-muted)] truncate">
                                {recipient.recipientEmail as string}
                              </p>
                            </div>
                            <div>
                              {recipient.deliveryStatus ? (
                                <Badge
                                  variant={statusConfig?.variant ?? "outline"}
                                  className="flex-shrink-0"
                                >
                                  {statusConfig?.label ??
                                    (recipient.deliveryStatus as string)}
                                </Badge>
                              ) : (
                                <span className="text-sm text-[var(--text-muted)]">
                                  —
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-[var(--text-muted)]">
                              {recipient.deliveredAt
                                ? new Date(
                                    recipient.deliveredAt as number
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </div>
                            <div className="text-sm">
                              {Boolean(recipient.bounceReason) ? (
                                <span className="text-red-600">
                                  {String(recipient.bounceReason)}
                                </span>
                              ) : null}
                              {Boolean(recipient.openedAt) ? (
                                <span className="text-emerald-600">
                                  Opened{" "}
                                  {new Date(
                                    recipient.openedAt as number
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              ) : null}
                              {Boolean(recipient.clickedAt) ? (
                                <span className="text-blue-600 ml-2">
                                  Clicked{" "}
                                  {new Date(
                                    recipient.clickedAt as number
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              ) : null}
                              {!recipient.bounceReason &&
                              !recipient.openedAt &&
                              !recipient.clickedAt
                                ? "—"
                                : null}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t bg-[var(--bg-page)]">
                  <p className="text-sm text-[var(--text-muted)]">
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
                        onClick={() =>
                          setCursor(recipients.continueCursor)
                        }
                      >
                        Load more
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </FadeIn>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[300px] w-full rounded-xl" />
      <Skeleton className="h-[400px] w-full rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (with Suspense boundary)
// ---------------------------------------------------------------------------

export default function BroadcastDetailPage() {
  return (
    <Suspense
      fallback={
        <>
          <div className="h-[60px] border-b" />
          <div className="px-8 pt-6 pb-8">
            <DetailSkeleton />
          </div>
        </>
      }
    >
      <BroadcastDetailContent />
    </Suspense>
  );
}
