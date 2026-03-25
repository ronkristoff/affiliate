"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CampaignCard } from "./CampaignCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorBoundary } from "@/components/ui/QueryErrorBoundary";
import { ArrowRight, Plus, AlertTriangle, UserX } from "lucide-react";

/**
 * CampaignOverview — dashboard overview for the 80% case (5-20 campaigns).
 * Shows: status summary, top 5 active campaigns, "Needs Attention" section, quick actions.
 * Query budget: 3 external + 1 internal round-trips (~290ms). ADR-3 compliant — no separate
 * getCampaignCardStats call from frontend; stats returned by getTopCampaigns internally.
 */
export function CampaignOverview({ onCreateCampaign }: { onCreateCampaign: () => void }) {
  return (
    <QueryErrorBoundary
      onError={(error) => {
        console.error("[CampaignOverview] QueryErrorBoundary caught:", error);
      }}
      fallback={
        <div className="text-center py-12 text-[#6b7280]">
          <p className="text-sm">Failed to load campaign overview.</p>
          <p className="text-xs mt-1 text-red-500">Check the browser console (F12) for details.</p>
        </div>
      }
    >
      <CampaignOverviewInner onCreateCampaign={onCreateCampaign} />
    </QueryErrorBoundary>
  );
}

function CampaignOverviewInner({ onCreateCampaign }: { onCreateCampaign: () => void }) {
  const campaignStats = useQuery(api.campaigns.getCampaignStats);
  const topCampaignsData = useQuery(api.campaigns.getTopCampaigns);
  const attentionData = useQuery(api.campaigns.getAttentionCampaigns);

  const isLoading = campaignStats === undefined || topCampaignsData === undefined || attentionData === undefined;

  if (isLoading) {
    return <CampaignOverviewLoadingSkeleton />;
  }

  // Destructure getTopCampaigns response
  const topCampaigns = topCampaignsData?.campaigns ?? [];

  // Determine if we're showing paused fallback (no active campaigns)
  const hasActiveCampaigns = topCampaigns.length > 0 && topCampaigns.some((c) => c.status === "active");

  // Zero-affiliate campaign IDs from getCampaignStats
  const zeroAffiliateIds = campaignStats?.zeroAffiliateCampaignIds ?? [];
  const hasAttention = (attentionData?.pausedTotal ?? 0) > 0 || zeroAffiliateIds.length > 0;

  return (
    <div className="space-y-6">
      {/* Status Summary Row */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <StatusChip
          label="Active"
          count={campaignStats.active}
          color="bg-emerald-50 text-emerald-700"
          dotColor="bg-emerald-500"
        />
        <StatusChip
          label="Paused"
          count={campaignStats.paused}
          color="bg-amber-50 text-amber-700"
          dotColor="bg-amber-500"
        />
        <StatusChip
          label="Archived"
          count={campaignStats.archived}
          color="bg-gray-100 text-gray-600"
          dotColor="bg-gray-400"
        />
      </div>

      {/* Top Campaigns Section */}
      {topCampaigns.length > 0 && (
        <div>
          <h2 className="text-[15px] font-bold text-gray-800 mb-3.5">
            {hasActiveCampaigns ? "Top Active Campaigns" : "Your Campaigns"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {topCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign._id}
                campaign={campaign}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state: 0 campaigns */}
      {campaignStats.total === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            onClick={onCreateCampaign}
            className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2.5 cursor-pointer min-h-[200px] transition-all hover:border-[#1659d6] hover:bg-blue-50/50"
          >
            <div className="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center text-[#10409a] text-2xl">
              <Plus className="w-5 h-5" />
            </div>
            <div className="text-sm font-semibold text-[#10409a]">
              Create New Campaign
            </div>
            <div className="text-xs text-gray-500 text-center">
              Set commission rules and start recruiting affiliates
            </div>
          </div>
        </div>
      )}

      {/* Needs Attention Section */}
      {hasAttention && (
        <div className="space-y-4">
          <h2 className="text-[15px] font-bold text-gray-800">Needs Attention</h2>

          {/* Paused campaigns */}
          {attentionData.pausedTotal > 0 && (
            <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#f3f4f6] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-[13px] font-semibold text-gray-700">
                    {attentionData.pausedTotal} Paused Campaign{attentionData.pausedTotal !== 1 ? "s" : ""}
                  </span>
                </div>
                {attentionData.pausedTotal > 5 && (
                  <Link
                    href="/campaigns/all?status=paused"
                    className="text-[12px] font-medium text-[#1659d6] hover:text-[#10409a] flex items-center gap-1 transition-colors"
                  >
                    View All <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {attentionData.pausedCampaigns.map((campaign) => (
                  <Link
                    key={campaign._id}
                    href={`/campaigns/${campaign._id}`}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-[13px] text-gray-700">{campaign.name}</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                      Paused
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Zero-affiliate campaigns */}
          {zeroAffiliateIds.length > 0 && (
            <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#f3f4f6] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-orange-500" />
                  <span className="text-[13px] font-semibold text-gray-700">
                    {zeroAffiliateIds.length} Campaign{zeroAffiliateIds.length !== 1 ? "s" : ""} With No Affiliates
                  </span>
                </div>
                {zeroAffiliateIds.length > 5 && (
                  <Link
                    href="/campaigns/all"
                    className="text-[12px] font-medium text-[#1659d6] hover:text-[#10409a] flex items-center gap-1 transition-colors"
                  >
                    View All <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
              <ZeroAffiliateList campaignIds={zeroAffiliateIds.slice(0, 5)} />
            </div>
          )}
        </div>
      )}

      {/* Quick Actions Row — button hierarchy (AC 24) */}
      <div className="flex items-center gap-3 pt-2">
        <Button size="sm" onClick={onCreateCampaign}>
          <Plus className="w-3.5 h-3.5" />
          New Campaign
        </Button>
        <Link
          href="/campaigns/all"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold border border-[#d1d5db] text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          View All {campaignStats.total} Campaign{campaignStats.total !== 1 ? "s" : ""}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatusChip({
  label,
  count,
  color,
  dotColor,
}: {
  label: string;
  count: number;
  color: string;
  dotColor: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {count} {label}
    </span>
  );
}

/**
 * Renders up to 5 zero-affiliate campaigns using a single batch query.
 * Avoids useQuery-in-loop violation (C2 fix).
 */
function ZeroAffiliateList({ campaignIds }: { campaignIds: Id<"campaigns">[] }) {
  const campaigns = useQuery(
    api.campaigns.getCampaignsByIds,
    campaignIds.length > 0 ? { campaignIds } : "skip"
  );

  if (campaigns === undefined) {
    return (
      <div className="divide-y divide-[#f3f4f6]">
        {[...Array(campaignIds.length)].map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#f3f4f6]">
      {campaigns.map((campaign) => (
        <Link
          key={campaign._id}
          href={`/campaigns/${campaign._id}`}
          className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <span className="text-[13px] text-gray-700">{campaign.name}</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700">
            No Affiliates
          </span>
        </Link>
      ))}
    </div>
  );
}

function CampaignOverviewLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div>
        <Skeleton className="h-5 w-44 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[220px] rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>
    </div>
  );
}
