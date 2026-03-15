"use client";

import { Clock, UserCheck, UserX, ShieldAlert, Mail, UserPlus } from "lucide-react";

interface ActivityItem {
  _id: string;
  _creationTime: number;
  action: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorType: string;
  previousValue?: { status?: string };
  newValue?: { status?: string; reason?: string };
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
}

const actionIcons: Record<string, React.ReactNode> = {
  affiliate_approved: <UserCheck className="h-4 w-4 text-emerald-500" />,
  affiliate_rejected: <UserX className="h-4 w-4 text-red-500" />,
  affiliate_suspended: <ShieldAlert className="h-4 w-4 text-amber-500" />,
  affiliate_reactivated: <UserCheck className="h-4 w-4 text-emerald-500" />,
  affiliate_registered: <UserPlus className="h-4 w-4 text-blue-500" />,
  affiliate_bulk_approved: <UserCheck className="h-4 w-4 text-emerald-500" />,
  affiliate_bulk_rejected: <UserX className="h-4 w-4 text-red-500" />,
  email_send_failed: <Mail className="h-4 w-4 text-red-400" />,
  permission_denied: <ShieldAlert className="h-4 w-4 text-red-600" />,
};

const actionLabels: Record<string, string> = {
  affiliate_approved: "Application Approved",
  affiliate_rejected: "Application Rejected",
  affiliate_suspended: "Affiliate Suspended",
  affiliate_reactivated: "Affiliate Reactivated",
  affiliate_registered: "New Affiliate Registered",
  affiliate_bulk_approved: "Bulk Approved",
  affiliate_bulk_rejected: "Bulk Rejected",
  email_send_failed: "Email Delivery Failed",
  permission_denied: "Access Denied",
  affiliate_status_updated: "Status Updated",
};

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        No activity recorded yet
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => {
        const icon = actionIcons[activity.action] || <Clock className="h-4 w-4 text-gray-500" />;
        const label = actionLabels[activity.action] || activity.action.replace(/_/g, " ");
        const isLast = index === activities.length - 1;

        return (
          <div key={activity._id} className="relative flex gap-4">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[7px] top-6 h-full w-px bg-border" />
            )}

            {/* Icon */}
            <div className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center">
              {icon}
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  
                  {/* Status change info */}
                  {activity.previousValue?.status && activity.newValue?.status && (
                    <p className="text-xs text-muted-foreground">
                      Status changed from{" "}
                      <span className="font-medium capitalize">
                        {activity.previousValue.status}
                      </span>{" "}
                      to{" "}
                      <span className="font-medium capitalize">
                        {activity.newValue.status}
                      </span>
                    </p>
                  )}

                  {/* Rejection reason */}
                  {activity.newValue?.reason && (
                    <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      <span className="font-medium">Reason:</span> {activity.newValue.reason}
                    </div>
                  )}

                  {/* Actor info */}
                  {activity.actorId && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      by {activity.actorType === "user" ? "Staff" : "System"}
                    </p>
                  )}
                </div>

                {/* Timestamp */}
                <time className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(activity._creationTime)}
                </time>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
