"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle, AlertTriangle, CreditCard } from "lucide-react";
import Link from "next/link";

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

const iconMap: Record<string, React.ReactNode> = {
  green: <CheckCircle className="w-4 h-4" />,
  amber: <AlertTriangle className="w-4 h-4" />,
  blue: <CreditCard className="w-4 h-4" />,
  red: <AlertTriangle className="w-4 h-4" />,
};

const iconBgMap: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  blue: "bg-blue-100 text-blue-600",
  red: "bg-red-100 text-red-600",
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
  return new Date(timestamp).toLocaleDateString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ActivityFeed({ activities, isLoading = false }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No recent activity</p>
        <p className="text-xs mt-1">Activity will appear here as events occur</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Activity Feed
      </h3>

      <div className="h-[280px] overflow-y-auto pr-2">
        <div className="space-y-3">
          {activities.map((activity) => {
            const iconBg = iconBgMap[activity.iconType] || iconBgMap.blue;

            return (
              <div
                key={activity._id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className={cn("p-2 rounded-lg shrink-0", iconBg)}>
                  {iconMap[activity.iconType] || iconMap.blue}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.description}
                  </p>
                  {activity.amount !== undefined && activity.amount > 0 && (
                    <p className="text-xs font-medium text-emerald-600 mt-0.5">
                      {formatCurrency(activity.amount)}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatRelativeTime(activity.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Link
          href="/activity"
          className="inline-flex items-center text-xs font-medium text-primary hover:underline"
        >
          View All
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>
      </div>
    </div>
  );
}
