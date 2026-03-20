"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { CampaignCard } from "./CampaignCard";
import { CreateCampaignModal } from "./CreateCampaignModal";
import { Loader2, Plus } from "lucide-react";

export function CampaignList() {
  const [showArchived] = useState(false);

  const campaigns = useQuery(api.campaigns.listCampaigns, {
    includeArchived: showArchived,
  });
  const statusStats = useQuery(api.campaigns.getCampaignStats);
  const cardStats = useQuery(api.campaigns.getCampaignCardStats);

  if (campaigns === undefined || statusStats === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Count active (non-archived) campaigns
  const activeCount = campaigns.filter((c) => c.status !== "archived").length;

  if (campaigns.length === 0) {
    return (
      <>
        <div className="text-[13px] font-bold text-gray-800 mb-3.5">
          Active Campaigns (0)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Create New Campaign CTA */}
          <CreateCampaignModal
            trigger={
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2.5 cursor-pointer min-h-[200px] transition-all hover:border-[#1659d6] hover:bg-blue-50/50">
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
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Section Label */}
      <div className="text-[13px] font-bold text-gray-800 mb-3.5">
        Active Campaigns ({activeCount})
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {campaigns.map((campaign: any) => (
          <CampaignCard
            key={campaign._id}
            campaign={campaign}
            stats={cardStats?.[campaign._id]}
          />
        ))}

        {/* Create New Campaign CTA */}
        <CreateCampaignModal
          trigger={
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2.5 cursor-pointer min-h-[200px] transition-all hover:border-[#1659d6] hover:bg-blue-50/50">
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
          }
        />
      </div>
    </>
  );
}
