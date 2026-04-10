"use client";

import { Card, CardContent } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "@/app/(admin)/tenants/_components/SubscriptionStatusBadge";
import { AlertTriangle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TenantDetail } from "./types";

interface SubscriptionSummaryCardProps {
  tenant: TenantDetail;
}

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "N/A";
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDaysRemaining(timestamp: number | null | undefined): string {
  if (!timestamp) return "";
  const now = Date.now();
  const diff = Math.ceil((timestamp - now) / (24 * 60 * 60 * 1000));
  if (diff > 0) return ` (${diff}d remaining)`;
  if (diff === 0) return " (today)";
  return ` (${Math.abs(diff)}d ago)`;
}

const CANCELLED_REASON_LABELS: Record<string, string> = {
  grace_expired: "Grace Period Expired",
  trial_expired: "Trial Expired",
  admin_cancelled: "Admin Cancelled",
  owner_cancelled: "Owner Cancelled",
};

export function SubscriptionSummaryCard({ tenant }: SubscriptionSummaryCardProps) {
  const hasSubscriptionData =
    tenant.subscriptionStatus ||
    tenant.billingStartDate ||
    tenant.trialEndsAt ||
    tenant.cancellationDate ||
    tenant.subscriptionId;

  if (!hasSubscriptionData) {
    return (
      <Card className="border-[#e5e7eb]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#374151]">Subscription</h3>
            <span className="text-xs text-[#9ca3af]">No subscription data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const now = Date.now();

  // Compute effective status (mirrors list view logic + billing cron)
  // so the detail page always matches what the list shows, even between cron runs.
  const isTrialExpired = tenant.trialEndsAt != null
    && tenant.trialEndsAt < now
    && tenant.subscriptionStatus !== "active"
    && tenant.subscriptionStatus !== "cancelled";
  const isBillingOverdue = tenant.subscriptionStatus === "past_due" ||
    (tenant.billingEndDate != null && tenant.billingEndDate < now && tenant.subscriptionStatus === "active");

  // Derive the effective badge status
  let effectiveStatus = tenant.subscriptionStatus;
  if (isTrialExpired) {
    effectiveStatus = "cancelled"; // Will transition to cancelled on next cron run
  } else if (isBillingOverdue && tenant.subscriptionStatus === "active") {
    effectiveStatus = "past_due"; // Will transition to past_due on next cron run
  }

  const graceRemaining = tenant.pastDueSince
    ? Math.max(0, Math.ceil((7 * 86400000 - (now - tenant.pastDueSince)) / 86400000))
    : null;

  return (
    <Card className="border-[#e5e7eb]">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#374151]">Subscription</h3>
          <SubscriptionStatusBadge status={effectiveStatus} />
        </div>

        {/* Trial expired warning (cron hasn't transitioned yet) */}
        {isTrialExpired && tenant.subscriptionStatus !== "cancelled" && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-red-800">
                Trial Expired — pending cancellation
              </p>
              <p className="text-red-700">
                The billing cron will cancel this tenant shortly. Campaigns are still active until then.
              </p>
            </div>
          </div>
        )}

        {/* Billing overdue warning (cron hasn't transitioned yet) */}
        {isBillingOverdue && tenant.subscriptionStatus === "active" && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">
                Billing Overdue — pending transition
              </p>
              <p className="text-amber-700">
                The billing cycle ended {formatDaysRemaining(tenant.billingEndDate)}. Will transition to Past Due on the next cron run.
              </p>
            </div>
          </div>
        )}

        {/* Grace period countdown banner */}
        {graceRemaining !== null && tenant.subscriptionStatus === "past_due" && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">
                {graceRemaining} day{graceRemaining !== 1 ? "s" : ""} until cancellation
              </p>
              <p className="text-amber-700">
                Update payment to restore full access.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Billing Period */}
          <div>
            <dt className="text-xs text-[#9ca3af]">Billing Period</dt>
            <dd className="text-sm font-medium text-[#111827]">
              {tenant.billingStartDate && tenant.billingEndDate
                ? `${formatDate(tenant.billingStartDate)} – ${formatDate(tenant.billingEndDate)}`
                : "N/A"}
            </dd>
          </div>

          {/* Trial Ends */}
          <div>
            <dt className="text-xs text-[#9ca3af]">Trial Ends</dt>
            <dd className="text-sm font-medium text-[#111827]">
              {tenant.subscriptionStatus === "trial" && tenant.trialEndsAt
                ? `${formatDate(tenant.trialEndsAt)}${formatDaysRemaining(tenant.trialEndsAt)}`
                : formatDate(tenant.trialEndsAt)}
            </dd>
          </div>

          {/* Cancellation Date */}
          <div>
            <dt className="text-xs text-[#9ca3af]">Cancellation Date</dt>
            <dd className="text-sm font-medium text-[#111827]">
              {formatDate(tenant.cancellationDate)}
            </dd>
          </div>

          {/* Cancelled Reason */}
          {tenant.cancelledReason && (
            <div>
              <dt className="text-xs text-[#9ca3af]">Cancellation Reason</dt>
              <dd className="text-sm font-medium text-[#111827]">
                {CANCELLED_REASON_LABELS[tenant.cancelledReason] ?? tenant.cancelledReason}
              </dd>
            </div>
          )}

          {/* Overdue Since */}
          {tenant.pastDueSince && (
            <div>
              <dt className="text-xs text-[#9ca3af]">Overdue Since</dt>
              <dd className="text-sm font-medium text-[#111827]">
                {formatDate(tenant.pastDueSince)}
                <span className="text-amber-600 ml-1">
                  ({Math.ceil((now - tenant.pastDueSince) / 86400000)}d ago)
                </span>
              </dd>
            </div>
          )}

          {/* Subscription ID */}
          <div className={cn(
            !tenant.cancelledReason && !tenant.pastDueSince && "sm:col-span-2"
          )}>
            <dt className="text-xs text-[#9ca3af]">Subscription ID</dt>
            <dd className="text-sm font-mono text-[#6b7280] truncate">
              {tenant.subscriptionId || "N/A"}
            </dd>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
