"use client";

import { Card, CardContent } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "@/app/(admin)/tenants/_components/SubscriptionStatusBadge";
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

  return (
    <Card className="border-[#e5e7eb]">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#374151]">Subscription</h3>
          <SubscriptionStatusBadge status={tenant.subscriptionStatus} />
        </div>

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

          {/* Deletion Scheduled */}
          <div>
            <dt className="text-xs text-[#9ca3af]">Deletion Scheduled</dt>
            <dd className="text-sm font-medium text-[#111827]">
              {tenant.deletionScheduledDate
                ? `${formatDate(tenant.deletionScheduledDate)}${formatDaysRemaining(tenant.deletionScheduledDate)}`
                : "N/A"}
            </dd>
          </div>

          {/* Subscription ID */}
          <div className="sm:col-span-2">
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
