"use client";

import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface NotificationItemProps {
  notification: {
    _id: string;
    type: string;
    title: string;
    message: string;
    severity: "info" | "warning" | "success" | "critical";
    actionUrl?: string;
    actionLabel?: string;
    isRead: boolean;
    _creationTime: number;
    aggregatedCount: number;
  };
  onMarkRead?: (notificationId: string) => void;
  onClick?: () => void;
}

const severityConfig = {
  info: {
    icon: Info,
    color: "text-gray-500",
    border: "border-l-gray-400",
    bg: "bg-gray-50",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-500",
    border: "border-l-amber-500",
    bg: "bg-amber-50",
  },
  success: {
    icon: CheckCircle,
    color: "text-green-500",
    border: "border-l-green-500",
    bg: "bg-green-50",
  },
  critical: {
    icon: AlertCircle,
    color: "text-red-500",
    border: "border-l-red-500",
    bg: "bg-red-50",
  },
};

export function NotificationItem({ notification, onMarkRead, onClick }: NotificationItemProps) {
  const router = useRouter();
  const config = severityConfig[notification.severity];
  const Icon = config.icon;

  const handleClick = () => {
    if (notification.actionUrl) {
      if (!notification.isRead && onMarkRead) {
        onMarkRead(notification._id);
      }
      onClick?.();
      router.push(notification.actionUrl);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 border-l-4 transition-colors cursor-pointer",
        config.border,
        notification.isRead ? "bg-background" : config.bg
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="listitem"
      tabIndex={notification.actionUrl ? 0 : undefined}
    >
      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", config.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm truncate",
              notification.isRead ? "text-muted-foreground" : "font-semibold text-foreground"
            )}
          >
            {notification.title}
          </p>
          {notification.aggregatedCount > 1 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-gray-200 px-1.5 text-xs font-medium text-gray-600">
              {notification.aggregatedCount}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-muted-foreground/70">
            {formatDistanceToNow(notification._creationTime, { addSuffix: true })}
          </span>
          {notification.actionLabel && notification.actionUrl && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {notification.actionLabel}
              <ExternalLink className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
