"use client";

import { Suspense } from "react";
import { CampaignOverview } from "@/components/dashboard/CampaignOverview";
import { CampaignStatsBar } from "@/components/dashboard/CampaignStatsBar";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { Button } from "@/components/ui/button";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";

function CampaignsContent() {
  return (
    <>
      <CampaignStatsBar />
      <CampaignOverview />
    </>
  );
}

function CampaignOverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Status summary chips */}
      <div className="flex gap-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>

      {/* Top Campaigns section */}
      <div>
        <Skeleton className="h-5 w-44 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[220px] rounded-xl" />
          ))}
        </div>
      </div>

      {/* Needs Attention section */}
      <div>
        <Skeleton className="h-5 w-44 mb-4" />
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar>
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Campaigns</h1>
        <div className="flex items-center gap-3">
          <CreateCampaignModal
            trigger={
              <Button size="sm">
                <Plus className="w-3.5 h-3.5" />
                New Campaign
              </Button>
            }
          />
        </div>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        <Suspense fallback={<CampaignOverviewSkeleton />}>
          <CampaignsContent />
        </Suspense>
      </div>
    </div>
  );
}
