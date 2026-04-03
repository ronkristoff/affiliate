"use client";

import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/MetricCard";
import {
  DollarSign,
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import { SubscriptionStatusBadge } from "@/app/(admin)/tenants/_components/SubscriptionStatusBadge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevenueMetrics {
  totalMRR: number;
  activeMRR: number;
  pastDueMRR: number;
  trialCount: number;
  activeCount: number;
  pastDueCount: number;
  cancelledCount: number;
  churnedMRR: number;
  trialConversionRate: number;
  starterCount: number;
  growthCount: number;
  scaleCount: number;
  growthMRR: number;
  scaleMRR: number;
}

interface RecentActivity {
  _id: Id<"billingHistory">;
  timestamp: number;
  event: string;
  tenantId: Id<"tenants">;
  tenantName: string;
  plan?: string;
  newPlan?: string;
  previousPlan?: string;
  amount?: number;
  actorId?: Id<"users">;
  actorName?: string;
}

interface RevenueDashboardProps {
  metrics: RevenueMetrics | undefined;
  isLoading: boolean;
  recentActivity: RecentActivity[] | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const eventColors: Record<string, { bg: string; text: string }> = {
  upgrade: { bg: "#d1fae5", text: "#065f46" },
  downgrade: { bg: "#ffedd5", text: "#9a3412" },
  cancel: { bg: "#fee2e2", text: "#991b1b" },
  renew: { bg: "#dbeafe", text: "#1e40af" },
  trial_conversion: { bg: "#f3e8ff", text: "#6b21a8" },
  admin_plan_change: { bg: "#e0e7ff", text: "#3730a3" },
  admin_trial_extension: { bg: "#cffafe", text: "#155e75" },
  admin_cancel: { bg: "#fee2e2", text: "#991b1b" },
  admin_reactivate: { bg: "#d1fae5", text: "#065f46" },
};

const eventLabels: Record<string, string> = {
  upgrade: "Upgraded",
  downgrade: "Downgraded",
  cancel: "Cancelled",
  renew: "Renewed",
  trial_conversion: "Trial Converted",
  admin_plan_change: "Plan Changed",
  admin_trial_extension: "Trial Extended",
  admin_cancel: "Cancelled",
  admin_reactivate: "Reactivated",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RevenueDashboard({
  metrics,
  isLoading,
  recentActivity,
}: RevenueDashboardProps) {
  if (isLoading || !metrics) {
    return <RevenueDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total MRR"
          numericValue={metrics.totalMRR}
          formatValue={formatCurrency}
          subtext="Monthly Recurring Revenue"
          isLoading={isLoading}
          variant="green"
          icon={<DollarSign className="w-4 h-4" />}
        />
        <MetricCard
          label="Active Subscriptions"
          numericValue={metrics.activeCount}
          subtext="Paying customers"
          isLoading={isLoading}
          variant="blue"
          icon={<Users className="w-4 h-4" />}
        />
        <MetricCard
          label="Trial Accounts"
          numericValue={metrics.trialCount}
          subtext="Free trial"
          isLoading={isLoading}
          variant="blue"
          icon={<Clock className="w-4 h-4" />}
        />
        <MetricCard
          label="Past Due"
          numericValue={metrics.pastDueCount}
          subtext={metrics.pastDueCount > 0 ? "Requires attention" : "All good"}
          isLoading={isLoading}
          variant={metrics.pastDueCount > 0 ? "yellow" : "green"}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
      </div>

      {/* Two-column: Subscription Breakdown + Plan Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Subscription Breakdown */}
        <Card className="border-[#e5e7eb]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#374151]">
              Subscription Breakdown
            </CardTitle>
            <CardDescription>Active, trial, past due, and cancelled tenants</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Active */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-sm text-[#374151]">Active</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#111827]">
                    {metrics.activeCount}
                  </span>
                  <span className="ml-2 text-xs text-[#6b7280]">
                    {formatCurrency(metrics.activeMRR)}
                  </span>
                </div>
              </div>

              {/* Trial */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-sm text-[#374151]">Trial</span>
                </div>
                <span className="text-sm font-semibold text-[#111827]">
                  {metrics.trialCount}
                </span>
              </div>

              {/* Past Due */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <span className="text-sm text-[#374151]">Past Due</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#111827]">
                    {metrics.pastDueCount}
                  </span>
                  <span className="ml-2 text-xs text-[#6b7280]">
                    {formatCurrency(metrics.pastDueMRR)}
                  </span>
                </div>
              </div>

              {/* Cancelled */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="text-sm text-[#374151]">Cancelled</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#111827]">
                    {metrics.cancelledCount}
                  </span>
                  <span className="ml-2 text-xs text-[#6b7280]">
                    {formatCurrency(metrics.churnedMRR)} churned
                  </span>
                </div>
              </div>

              {/* Trial Conversion Rate */}
              <div className="pt-3 border-t border-[#e5e7eb]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9ca3af]">Trial Conversion Rate</span>
                  <span className="text-sm font-semibold text-[#1c2260]">
                    {metrics.trialConversionRate}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card className="border-[#e5e7eb]">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#374151]">
              Plan Distribution
            </CardTitle>
            <CardDescription>Tenants per plan tier with revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Starter */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                  <span className="text-sm text-[#374151]">Starter</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#111827]">
                    {metrics.starterCount}
                  </span>
                  <span className="ml-2 text-xs text-[#6b7280]">Free</span>
                </div>
              </div>

              {/* Growth */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-sm text-[#374151]">Growth</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#111827]">
                    {metrics.growthCount}
                  </span>
                  <span className="ml-2 text-xs text-[#6b7280]">
                    {formatCurrency(metrics.growthMRR)}
                  </span>
                </div>
              </div>

              {/* Scale */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="text-sm text-[#374151]">Scale</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#111827]">
                    {metrics.scaleCount}
                  </span>
                  <span className="ml-2 text-xs text-[#6b7280]">
                    {formatCurrency(metrics.scaleMRR)}
                  </span>
                </div>
              </div>

              {/* Total paying */}
              <div className="pt-3 border-t border-[#e5e7eb]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9ca3af]">Total Paying</span>
                  <span className="text-sm font-semibold text-[#1c2260]">
                    {metrics.growthCount + metrics.scaleCount}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Subscription Activity */}
      <Card className="border-[#e5e7eb]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#374151]">
            Recent Subscription Activity
          </CardTitle>
          <CardDescription>
            Latest billing events across all tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!recentActivity || recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-8 w-8 text-[#d1d5db] mx-auto mb-2" />
              <p className="text-sm text-[#9ca3af]">No recent activity</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f3f4f6]">
              {recentActivity.map((activity) => {
                const colorConfig = eventColors[activity.event] || {
                  bg: "#f3f4f6",
                  text: "#374151",
                };
                return (
                  <div
                    key={activity._id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    {/* Event badge */}
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
                      style={{
                        backgroundColor: colorConfig.bg,
                        color: colorConfig.text,
                      }}
                    >
                      {eventLabels[activity.event] || activity.event}
                    </span>

                    {/* Tenant name (link) */}
                    <Link
                      href={`/tenants/${activity.tenantId}`}
                      className="text-sm font-medium text-[#1c2260] hover:text-[#1fb5a5] hover:underline truncate min-w-0"
                    >
                      {activity.tenantName}
                    </Link>

                    {/* Plan transition */}
                    {activity.previousPlan && activity.newPlan && (
                      <span className="text-xs text-[#6b7280] shrink-0">
                        {activity.previousPlan.charAt(0).toUpperCase() +
                          activity.previousPlan.slice(1)}{" "}
                        →{" "}
                        {activity.newPlan.charAt(0).toUpperCase() +
                          activity.newPlan.slice(1)}
                      </span>
                    )}

                    {/* Amount */}
                    {activity.amount !== undefined && activity.amount > 0 && (
                      <span className="text-xs font-medium text-[#111827] shrink-0 ml-auto">
                        {formatCurrency(activity.amount)}
                      </span>
                    )}

                    {/* Timestamp */}
                    <span className="text-xs text-[#9ca3af] shrink-0 ml-auto">
                      {timeAgo(activity.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function RevenueDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI Card Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[#e5e7eb] bg-[var(--bg-surface)] p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-24 bg-[#e5e7eb] rounded" />
              <div className="h-4 w-4 bg-[#e5e7eb] rounded" />
            </div>
            <div className="h-7 w-32 bg-[#e5e7eb] rounded" />
            <div className="h-3 w-40 bg-[#e5e7eb] rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Detail Card Skeletons */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#e5e7eb] bg-white p-5">
            <div className="h-4 w-40 bg-[#e5e7eb] rounded mb-1" />
            <div className="h-3 w-56 bg-[#e5e7eb] rounded mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 bg-[#e5e7eb] rounded-full" />
                    <div className="h-3 w-16 bg-[#e5e7eb] rounded" />
                  </div>
                  <div className="h-3 w-20 bg-[#e5e7eb] rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Activity Skeleton */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
        <div className="h-4 w-48 bg-[#e5e7eb] rounded mb-1" />
        <div className="h-3 w-60 bg-[#e5e7eb] rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-5 w-24 bg-[#e5e7eb] rounded-full" />
              <div className="h-3 w-32 bg-[#e5e7eb] rounded" />
              <div className="h-3 w-16 bg-[#e5e7eb] rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
