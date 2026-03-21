"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Activity {
  _id: string;
  type: string;
  title: string;
  description: string;
  amount?: number;
  status?: string;
  timestamp: number;
  iconType: string;
}

interface ActivityFeedProps {
  activities: Activity[];
  isLoading?: boolean;
}

const iconBgMap: Record<string, string> = {
  green: "bg-[#d1fae5]",
  yellow: "bg-[#fef3c7]",
  blue: "bg-[#dbeafe]",
  red: "bg-[#fee2e2]",
};

const iconEmojiMap: Record<string, string> = {
  green: "✅",
  yellow: "⚠️",
  blue: "👤",
  red: "❌",
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityFeed({ activities, isLoading = false }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="p-5">
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 px-5">
        <p className="text-sm text-muted-foreground">No recent activity</p>
        <p className="text-xs mt-1 text-muted-foreground">Activity will appear here as events occur</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Recent Activity</h3>
      </div>
      <div className="divide-y divide-[var(--bg-page)]">
        {activities.slice(0, 5).map((activity) => {
          const iconBg = iconBgMap[activity.iconType] || iconBgMap.blue;
          const emoji = iconEmojiMap[activity.iconType] || "📌";

          return (
            <div
              key={activity._id}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-[var(--bg-page)] transition-colors"
            >
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0", iconBg)}>
                {emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--text-body)] leading-relaxed">
                  <span className="font-semibold text-[var(--text-heading)]">{activity.title}</span>
                  {activity.description && ` — ${activity.description}`}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatRelativeTime(activity.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
