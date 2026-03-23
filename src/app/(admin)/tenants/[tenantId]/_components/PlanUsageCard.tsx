"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Globe,
  History,
  Loader2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OverrideLimitsModal } from "./OverrideLimitsModal";
import { RemoveOverrideModal } from "./RemoveOverrideModal";
import { OverrideHistoryDrawer } from "./OverrideHistoryDrawer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WarningLevel = "normal" | "warning" | "critical";

interface UsageItem {
  current: number;
  limit: number;
  percentage: number;
  warningLevel: WarningLevel;
}

interface OverrideInfo {
  active: boolean;
  overrideId?: string;
  expiresAt?: number;
}

interface PlanUsageData {
  plan: {
    tier: string;
    price: number;
    maxAffiliates: number;
    maxCampaigns: number;
    maxTeamMembers: number;
    maxPayoutsPerMonth: number;
    features: {
      customDomain: boolean;
      advancedAnalytics: boolean;
      prioritySupport: boolean;
    };
  };
  usage: {
    affiliates: UsageItem;
    campaigns: UsageItem;
    teamMembers: UsageItem;
    payouts: UsageItem;
    customDomain?:
      | {
          configured: boolean;
          status?: string;
        }
      | undefined;
  };
  override?: OverrideInfo;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIMIT_ICONS: Record<string, string> = {
  affiliates: "👥",
  campaigns: "📢",
  teamMembers: "🧑‍🤝‍🧑",
  payouts: "💳",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(price);
}

function getBarColor(level: WarningLevel): string {
  switch (level) {
    case "warning":
      return "bg-[#f59e0b]";
    case "critical":
      return "bg-[#ef4444]";
    default:
      return "bg-[#10409a]";
  }
}

function getTextColor(level: WarningLevel): string {
  switch (level) {
    case "warning":
      return "text-[#92400e]";
    case "critical":
      return "text-[#991b1b]";
    default:
      return "text-[#333333]";
  }
}

function formatCountdown(expiresAt: number): string {
  const now = Date.now();
  const diff = expiresAt - now;

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d remaining`;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h remaining`;

  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}m remaining`;
}

// ---------------------------------------------------------------------------
// UsageBar Sub-component
// ---------------------------------------------------------------------------

interface UsageBarProps {
  label: string;
  icon?: string;
  current: number;
  limit: number;
  percentage: number;
  warningLevel: WarningLevel;
  expanded?: boolean;
  onToggle?: () => void;
  details?: {
    active: number;
    inactive: number;
    total: number;
  };
}

function UsageBar({
  label,
  icon,
  current,
  limit,
  percentage,
  warningLevel,
  expanded,
  onToggle,
  details,
}: UsageBarProps) {
  const isHighUsage = warningLevel === "warning" || warningLevel === "critical";

  return (
    <div className="space-y-1">
      {/* Label row */}
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex items-center gap-1 text-left",
            onToggle && "hover:text-[#10409a] transition-colors cursor-pointer"
          )}
        >
          {onToggle ? (
            expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : null}
          {icon && <span className="text-sm">{icon}</span>}
          <span className="text-[#6b7280]">{label}</span>
        </button>
        <span className={cn("font-medium", getTextColor(warningLevel))}>
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-[#f3f4f6]">
        <div
          className={cn("h-full rounded-full transition-all", getBarColor(warningLevel))}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Current / Limit + warning */}
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-medium", getTextColor(warningLevel))}>
          {current} / {limit}
        </span>
        {warningLevel === "warning" && (
          <div className="flex items-center text-[#92400e]">
            <AlertTriangle className="mr-1 h-3 w-3" />
            <span>Approaching limit</span>
          </div>
        )}
        {warningLevel === "critical" && (
          <div className="flex items-center text-[#991b1b] font-semibold">
            <AlertTriangle className="mr-1 h-3 w-3" />
            <span>At limit!</span>
          </div>
        )}
      </div>

      {/* Expandable details */}
      {expanded && details && (
        <div className="ml-4 mt-1 rounded-md bg-[#f9fafb] px-3 py-2 text-xs text-[#6b7280] space-y-0.5">
          <div className="flex justify-between">
            <span>Active / Total</span>
            <span className="font-medium text-[#333333]">
              {details.active} / {details.total}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Inactive / Archived</span>
            <span className="font-medium text-[#333333]">{details.inactive}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlanUsageCard (main component)
// ---------------------------------------------------------------------------

export interface PlanUsageCardProps {
  tenantId: Id<"tenants">;
}

export function PlanUsageCard({ tenantId }: PlanUsageCardProps) {
  const router = useRouter();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  const usage = useQuery(api.admin.tenants.getTenantPlanUsage, { tenantId });
  const isLoading = usage === undefined;

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#6b7280]" />
        </div>
      </div>
    );
  }

  // Error / no data state
  if (!usage) {
    return null;
  }

  const { plan, usage: u, override } = usage;
  const hasOverride = override?.active === true;

  const handleViewAllLimits = () => {
    router.push(`/tenants/${tenantId}/limits`);
  };

  const handleRemoveSuccess = () => {
    toast.success("Override removed successfully");
  };

  const tierLabel = plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1);

  return (
    <>
      <div
        className={cn(
          "rounded-xl border bg-white p-5 transition-colors",
          hasOverride
            ? "border-[#fbbf24] bg-amber-50/30"
            : "border-[#e5e7eb]"
        )}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#111827]">
              Plan &amp; Limits
            </h2>
            <span className="inline-flex items-center rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#10409a]">
              {tierLabel}
            </span>
            {/* AC4: Override Active badge */}
            {hasOverride && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3 w-3" />
                Override Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleViewAllLimits}
            >
              View All Limits
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Plan info badge */}
        <div className="mb-4 rounded-lg bg-[#f9fafb] px-3 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-[#10409a]">
            {tierLabel} Plan
          </span>
          <span className="text-sm font-semibold text-[#111827]">
            {formatPrice(plan.price)}/mo
          </span>
        </div>

        {/* Expiration countdown */}
        {hasOverride && override?.expiresAt && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-sm">
            <Clock className="h-4 w-4 text-amber-700" />
            <span className="text-amber-800 font-medium">
              Expires: {formatCountdown(override.expiresAt)}
            </span>
            <span className="text-xs text-amber-600 ml-auto">
              {new Date(override.expiresAt).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* Usage bars */}
        <div className="space-y-4">
          <UsageBar
            label="Affiliates"
            icon={LIMIT_ICONS.affiliates}
            current={u.affiliates.current}
            limit={u.affiliates.limit}
            percentage={u.affiliates.percentage}
            warningLevel={u.affiliates.warningLevel}
            expanded={expandedRows.has("affiliates")}
            onToggle={() => toggleRow("affiliates")}
          />

          <UsageBar
            label="Campaigns"
            icon={LIMIT_ICONS.campaigns}
            current={u.campaigns.current}
            limit={u.campaigns.limit}
            percentage={u.campaigns.percentage}
            warningLevel={u.campaigns.warningLevel}
            expanded={expandedRows.has("campaigns")}
            onToggle={() => toggleRow("campaigns")}
          />

          <UsageBar
            label="Team Members"
            icon={LIMIT_ICONS.teamMembers}
            current={u.teamMembers.current}
            limit={u.teamMembers.limit}
            percentage={u.teamMembers.percentage}
            warningLevel={u.teamMembers.warningLevel}
            expanded={expandedRows.has("teamMembers")}
            onToggle={() => toggleRow("teamMembers")}
          />

          <UsageBar
            label="Monthly Payouts"
            icon={LIMIT_ICONS.payouts}
            current={u.payouts.current}
            limit={u.payouts.limit}
            percentage={u.payouts.percentage}
            warningLevel={u.payouts.warningLevel}
            expanded={expandedRows.has("payouts")}
            onToggle={() => toggleRow("payouts")}
          />

          {/* Custom domain (Scale tier) */}
          {plan.tier === "scale" && (
            <div className="flex items-center gap-2 pt-2 border-t border-[#e5e7eb]">
              <Globe className="h-4 w-4 text-[#6b7280]" />
              <div className="flex-1">
                <p className="text-sm text-[#6b7280]">
                  Custom Domain:{" "}
                  {u.customDomain?.configured ? "Configured" : "Not configured"}
                </p>
                {u.customDomain?.configured && u.customDomain.status && (
                  <span className="text-xs font-medium text-[#10409a]">
                    {u.customDomain.status}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-4 border-t border-[#e5e7eb] pt-3 space-y-2">
          {hasOverride ? (
            <>
              {/* AC4: Remove Override button when override active */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2 bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-700"
                onClick={() => setRemoveModalOpen(true)}
              >
                <XCircle className="h-4 w-4" />
                Remove Override
              </Button>
            </>
          ) : (
            <>
              {/* Override Limits button */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2 bg-[#fef3c7] text-[#92400e] border-[#fde68a] hover:bg-[#fde68a] hover:text-[#92400e]"
                onClick={() => setOverrideModalOpen(true)}
              >
                <AlertTriangle className="h-4 w-4" />
                Override Limits
              </Button>
            </>
          )}

          {/* View History button */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-xs text-[#6b7280] hover:text-[#374151]"
            onClick={() => setHistoryDrawerOpen(true)}
          >
            <History className="h-4 w-4" />
            View Override History
          </Button>
        </div>
      </div>

      {/* Modals & Drawers */}
      <OverrideLimitsModal
        open={overrideModalOpen}
        onOpenChange={setOverrideModalOpen}
        tenantId={tenantId}
        currentLimits={{
          maxAffiliates: plan.maxAffiliates,
          maxCampaigns: plan.maxCampaigns,
          maxTeamMembers: plan.maxTeamMembers,
          maxPayoutsPerMonth: plan.maxPayoutsPerMonth,
        }}
        planName={plan.tier}
        currentUsage={{
          affiliates: u.affiliates.current,
          campaigns: u.campaigns.current,
          teamMembers: u.teamMembers.current,
          payouts: u.payouts.current,
        }}
      />

      <RemoveOverrideModal
        open={removeModalOpen}
        onOpenChange={setRemoveModalOpen}
        tenantId={tenantId}
        overrideId={(override?.overrideId ?? "") as Id<"tierOverrides">}
        currentUsage={{
          affiliates: u.affiliates.current,
          campaigns: u.campaigns.current,
          teamMembers: u.teamMembers.current,
          payouts: u.payouts.current,
        }}
        planLimits={{
          maxAffiliates: plan.maxAffiliates,
          maxCampaigns: plan.maxCampaigns,
          maxTeamMembers: plan.maxTeamMembers,
          maxPayoutsPerMonth: plan.maxPayoutsPerMonth,
        }}
        onSuccess={handleRemoveSuccess}
      />

      <OverrideHistoryDrawer
        open={historyDrawerOpen}
        onOpenChange={setHistoryDrawerOpen}
        tenantId={tenantId}
      />
    </>
  );
}
