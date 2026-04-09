"use client";

import {
  Clock, UserCheck, UserX, ShieldAlert, Mail, UserPlus,
  PlusCircle, CheckCircle, XCircle, RotateCcw, RefreshCw,
  AlertTriangle, TrendingUp, TrendingDown, HelpCircle,
} from "lucide-react";

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
  affiliate_approved: <UserCheck className="h-4 w-4 text-[var(--success)]" />,
  affiliate_rejected: <UserX className="h-4 w-4 text-[var(--danger)]" />,
  affiliate_suspended: <ShieldAlert className="h-4 w-4 text-[var(--warning)]" />,
  affiliate_reactivated: <UserCheck className="h-4 w-4 text-[var(--success)]" />,
  affiliate_registered: <UserPlus className="h-4 w-4 text-[var(--info)]" />,
  affiliate_bulk_approved: <UserCheck className="h-4 w-4 text-[var(--success)]" />,
  affiliate_bulk_rejected: <UserX className="h-4 w-4 text-[var(--danger)]" />,
  email_send_failed: <Mail className="h-4 w-4 text-[var(--danger)]" />,
  permission_denied: <ShieldAlert className="h-4 w-4 text-[var(--danger)]" />,
  // Commission action types
  COMMISSION_CREATED: <PlusCircle className="h-4 w-4 text-[var(--info)]" />,
  COMMISSION_APPROVED: <CheckCircle className="h-4 w-4 text-[var(--success)]" />,
  COMMISSION_DECLINED: <XCircle className="h-4 w-4 text-[var(--danger)]" />,
  COMMISSION_REVERSED: <RotateCcw className="h-4 w-4 text-[var(--warning)]" />,
  COMMISSION_STATUS_CHANGE: <RefreshCw className="h-4 w-4 text-[var(--info)]" />,
  commission_rejected_payment_failed: <AlertTriangle className="h-4 w-4 text-[var(--danger)]" />,
  commission_adjusted_upgrade: <TrendingUp className="h-4 w-4 text-[var(--info)]" />,
  commission_adjusted_downgrade: <TrendingDown className="h-4 w-4 text-[var(--warning)]" />,
  self_referral_detected: <ShieldAlert className="h-4 w-4 text-[var(--danger)]" />,
  fraud_alert_email_failed: <Mail className="h-4 w-4 text-[var(--danger)]" />,
  commission_rejected_payment_pending: <Clock className="h-4 w-4 text-[var(--warning)]" />,
  commission_rejected_payment_unknown: <HelpCircle className="h-4 w-4 text-[var(--warning)]" />,
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
  // Commission action types
  COMMISSION_CREATED: "Commission Created",
  COMMISSION_APPROVED: "Commission Approved",
  COMMISSION_DECLINED: "Commission Declined",
  COMMISSION_REVERSED: "Commission Reversed",
  COMMISSION_STATUS_CHANGE: "Status Changed",
  commission_rejected_payment_failed: "Payment Failed",
  commission_adjusted_upgrade: "Commission Adjusted (Upgrade)",
  commission_adjusted_downgrade: "Commission Adjusted (Downgrade)",
  self_referral_detected: "Self-Referral Detected",
  fraud_alert_email_failed: "Fraud Alert Email Failed",
  commission_rejected_payment_pending: "Payment Pending",
  commission_rejected_payment_unknown: "Payment Unknown",
};

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-[13px] text-[var(--text-muted)]">
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
        const icon = actionIcons[activity.action] || <Clock className="h-4 w-4 text-[var(--text-muted)]" />;
        const label = actionLabels[activity.action] || activity.action.replace(/_/g, " ");
        const isLast = index === activities.length - 1;

        return (
          <div key={activity._id} className="relative flex gap-4">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[7px] top-6 h-full w-px bg-[var(--border-light)]" />
            )}

            {/* Icon */}
            <div className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center">
              {icon}
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-medium text-[var(--text-heading)]">{label}</p>
                  
                  {/* Status change info */}
                  {activity.previousValue?.status && activity.newValue?.status && (
                    <p className="text-[11px] text-[var(--text-muted)]">
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
                    <div className="mt-2 rounded-md bg-[var(--warning-bg)] p-2 text-[11px] text-[var(--warning-text)]">
                      <span className="font-medium">Reason:</span> {activity.newValue.reason}
                    </div>
                  )}

                  {/* Actor info */}
                  {activity.actorId && (
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      by {activity.actorType === "user" ? "Staff" : "System"}
                    </p>
                  )}
                </div>

                {/* Timestamp */}
                <time className="shrink-0 text-[11px] text-[var(--text-muted)]">
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
