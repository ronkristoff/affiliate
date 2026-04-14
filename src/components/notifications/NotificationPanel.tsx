"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "./useNotifications";
import { NotificationItem } from "./NotificationItem";
import { Bell, CheckCheck } from "lucide-react";
import { useNotificationCount } from "./useNotificationCount";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface NotificationPanelProps {
  userId: Id<"users"> | undefined;
}

export function NotificationPanel({ userId }: NotificationPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { notifications, isLoading, markRead, markAllRead } = useNotifications(userId);
  const { total } = useNotificationCount(userId);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await markAllRead();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleMarkRead = async (notificationId: Id<"notifications">) => {
    await markRead({ notificationId });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${total > 0 ? `, ${total} unread` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-white",
                total >= 5 ? "bg-red-500 animate-pulse" : "bg-amber-500"
              )}
              aria-live="polite"
            >
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 z-[200] rounded-xl border-[var(--border-light)] shadow-lg overflow-hidden"
        sideOffset={8}
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-heading)]">Notifications</h3>
            {total > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-[var(--bg-page)] px-1.5 text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border-light)]">
                {total}
              </span>
            )}
          </div>
          {total > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-[var(--brand-secondary)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-light)]"
              onClick={handleMarkAllRead}
              disabled={isMarkingAll}
            >
              {isMarkingAll ? (
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 border-2 border-[var(--brand-primary)]/30 border-t-[var(--brand-primary)] rounded-full animate-spin" />
                  Marking...
                </span>
              ) : (
                <>
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  Mark all read
                </>
              )}
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-96 overflow-y-auto" role="list" aria-label="Recent notifications">
          {isLoading ? (
            <div className="p-4 space-y-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <Skeleton className="h-[18px] w-[18px] rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 text-[var(--text-muted)]/30" />
              <p className="text-sm text-[var(--text-muted)]">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {notifications.map((notification: any) => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onClick={() => setOpen(false)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border-light)] px-4 py-2 bg-[var(--bg-page)]/40">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/notifications");
            }}
            className="block w-full text-center text-xs font-medium text-[var(--brand-secondary)] hover:text-[var(--brand-primary)] py-1 transition-colors"
          >
            View all notifications
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
