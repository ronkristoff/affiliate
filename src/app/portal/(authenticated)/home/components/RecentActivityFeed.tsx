"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle, Clock, MousePointer, Hourglass } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface ActivityItem {
  _id: string;
  type: "commission_confirmed" | "commission_pending" | "clicks";
  title: string;
  description: string;
  amount?: number;
  status?: string;
  timestamp: number;
  iconType: "green" | "amber" | "blue";
  customerName?: string;
  commissionType?: string;
}

interface RecentActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
  affiliateStatus?: string;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ActivityIcon({ type, iconType }: { type: ActivityItem["type"]; iconType: ActivityItem["iconType"] }) {
  const iconClasses = "w-4 h-4";
  
  if (type === "commission_confirmed") {
    return <CheckCircle className={cn(iconClasses, "text-green-600")} />;
  }
  if (type === "commission_pending") {
    return <Clock className={cn(iconClasses, "text-amber-600")} />;
  }
  // clicks
  return <MousePointer className={cn(iconClasses, "text-blue-600")} />;
}

function getContextualDescription(activity: ActivityItem): string {
  if (activity.type === "clicks") {
    return activity.description;
  }

  const parts: string[] = [];
  if (activity.customerName) {
    parts.push(`from ${activity.customerName}`);
  }
  if (activity.commissionType) {
    const label = activity.commissionType.replace(/_/g, " ").toLowerCase();
    parts.push(`(${label} commission)`);
  }
  if (activity.description) {
    if (parts.length > 0) {
      parts.push(activity.description);
    } else {
      return activity.description;
    }
  }
  return parts.join(" ");
}

function ActivityItemComponent({ activity }: { activity: ActivityItem }) {
  const description = getContextualDescription(activity);

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-b-0">
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            activity.iconType === "green" && "bg-green-100",
            activity.iconType === "amber" && "bg-amber-100",
            activity.iconType === "blue" && "bg-blue-100"
          )}
        >
          <ActivityIcon type={activity.type} iconType={activity.iconType} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {activity.title}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {description}
            </p>
          </div>
          
          <div className="flex-shrink-0 text-right">
            {activity.amount !== undefined && (
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency(activity.amount)}
              </p>
            )}
            <p className="text-xs text-gray-400">
              {formatRelativeTime(activity.timestamp)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonItem() {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-b-0">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
      </div>
      <div className="flex-shrink-0 space-y-1">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-20" />
      </div>
    </div>
  );
}

export function RecentActivityFeed({
  activities,
  isLoading = false,
  affiliateStatus,
}: RecentActivityFeedProps) {
  const isPendingReview = affiliateStatus === "pending";

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Recent Activity
        </h3>
        {isPendingReview && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            <Hourglass className="w-3 h-3" />
            Pending review
          </span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonItem key={i} />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="divide-y">
              {activities.map((activity) => (
                <ActivityItemComponent key={activity._id} activity={activity} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}