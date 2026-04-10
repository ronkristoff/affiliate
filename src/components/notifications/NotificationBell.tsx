"use client";

import { Bell } from "lucide-react";
import { useNotificationCount } from "./useNotificationCount";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NotificationBellProps {
  userId: Id<"users"> | undefined;
  onClick?: () => void;
}

export function NotificationBell({ userId, onClick }: NotificationBellProps) {
  const { total, isLoading } = useNotificationCount(userId);

  if (!userId || isLoading) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={onClick}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={onClick}
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
  );
}
