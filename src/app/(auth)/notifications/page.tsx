"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CheckCheck, Inbox, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { useNotifications } from "@/components/notifications/useNotifications";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";

// Filter options
const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "billing", label: "Billing" },
  { key: "affiliate", label: "Affiliate" },
  { key: "commission", label: "Commission" },
  { key: "payout", label: "Payout" },
  { key: "team", label: "Team" },
  { key: "campaign", label: "Campaign" },
] as const;

type FilterKey = (typeof FILTER_OPTIONS)[number]["key"];

function NotificationsContent() {
  const user = useQuery(api.auth.getCurrentUser);
  const userId = user?._id;
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Use the pagination-aware hook
  const {
    notifications,
    isDone,
    isLoading,
    markRead,
    markAllRead: hookMarkAllRead,
    loadMore,
    setTypeFilter,
    setUnreadOnly,
  } = useNotifications(userId);

  const unreadCount = useQuery(
    userId && api.notifications.getUnreadNotificationCount,
    userId ? { userId } : "SKIP"
  );

  // Sync filter state to hook
  const handleFilterChange = (key: FilterKey) => {
    setActiveFilter(key);
    if (key === "unread") {
      setTypeFilter(undefined);
      setUnreadOnly(true);
    } else if (key === "all") {
      setTypeFilter(undefined);
      setUnreadOnly(false);
    } else {
      setTypeFilter(key);
      setUnreadOnly(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    setIsMarkingAll(true);
    try {
      await hookMarkAllRead();
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Show loading skeleton while user is loading
  if (user === undefined) {
    return <NotificationsLoadingSkeleton />;
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="h-12 w-12 text-[var(--text-muted)] mb-3" />
          <p className="text-sm text-[var(--text-muted)]">Please sign in to view notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">Notifications</h1>
          {unreadCount && unreadCount.total > 0 && (
            <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-amber-500 px-2 text-xs font-bold text-white">
              {unreadCount.total}
            </span>
          )}
        </div>
        {unreadCount && unreadCount.total > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
          >
            {isMarkingAll ? (
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Marking...
              </span>
            ) : (
              <>
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all as read
              </>
            )}
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {FILTER_OPTIONS.map((filter) => (
          <Button
            key={filter.key}
            variant="ghost"
            size="sm"
            onClick={() => handleFilterChange(filter.key)}
            aria-pressed={activeFilter === filter.key}
            className={cn(
              "h-8 px-3 text-xs font-medium rounded-full",
              activeFilter === filter.key
                ? "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary)]/90 hover:text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-600"
            )}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="h-12 w-12 text-[var(--text-muted)] mb-3" />
          <p className="text-sm text-[var(--text-muted)]">
            {activeFilter === "unread"
              ? "No unread notifications"
              : activeFilter !== "all"
                ? `No ${activeFilter} notifications`
                : "No notifications yet"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1 divide-y divide-border rounded-lg border" role="list" aria-label="Notifications">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onMarkRead={(id) => markRead({ notificationId: id })}
              />
            ))}
          </div>

          {/* Load More */}
          {!isDone && notifications.length > 0 && (
            <div className="text-center mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NotificationsLoadingSkeleton() {
  return (
    <div className="container max-w-3xl mx-auto px-4 py-8">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="flex gap-1.5 mb-6">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsLoadingSkeleton />}>
      <NotificationsContent />
    </Suspense>
  );
}
