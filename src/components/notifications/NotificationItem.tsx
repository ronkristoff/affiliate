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
    iconColor: "text-[var(--text-muted)]",
    dotColor: "bg-[var(--text-muted)]/40",
    unreadBg: "bg-[var(--brand-light)]/60",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    dotColor: "bg-amber-500",
    unreadBg: "bg-amber-50/80",
  },
  success: {
    icon: CheckCircle,
    iconColor: "text-emerald-500",
    dotColor: "bg-emerald-500",
    unreadBg: "bg-emerald-50/80",
  },
  critical: {
    icon: AlertCircle,
    iconColor: "text-red-500",
    dotColor: "bg-red-500",
    unreadBg: "bg-red-50/80",
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
        "flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer",
        notification.isRead ? "hover:bg-[var(--bg-page)]/60" : config.unreadBg
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="listitem"
      tabIndex={notification.actionUrl ? 0 : undefined}
    >
      {/* Severity icon with unread dot indicator */}
      <div className="relative mt-0.5 shrink-0">
        <Icon className={cn(
          "h-[18px] w-[18px]",
          notification.isRead ? "text-[var(--text-muted)]/50" : config.iconColor
        )} />
        {!notification.isRead && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full",
            config.dotColor
          )} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-[13px] truncate leading-snug",
              notification.isRead
                ? "text-[var(--text-muted)]"
                : "font-semibold text-[var(--text-heading)]"
            )}
          >
            {notification.title}
          </p>
          {notification.aggregatedCount > 1 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-[var(--bg-page)] px-1.5 text-[10px] font-bold text-[var(--text-muted)] border border-[var(--border-light)]">
              {notification.aggregatedCount}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-[var(--text-muted)]/60">
            {formatDistanceToNow(notification._creationTime, { addSuffix: true })}
          </span>
          {notification.actionLabel && notification.actionUrl && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--brand-secondary)] hover:text-[var(--brand-primary)] transition-colors">
              {notification.actionLabel}
              <ExternalLink className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
