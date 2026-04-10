"use client";

import { Suspense, useState } from "react";
import { CampaignOverview } from "@/components/dashboard/CampaignOverview";
import { CampaignStatsBar } from "@/components/dashboard/CampaignStatsBar";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { Button } from "@/components/ui/button";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";

function CampaignsContent({ onCreateCampaign }: { onCreateCampaign: () => void }) {
  return (
    <>
      <CampaignStatsBar />
      <CampaignOverview onCreateCampaign={onCreateCampaign} />
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
        <div className="section-header">
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] overflow-hidden">
              <Skeleton className="h-[220px]" />
            </div>
          ))}
        </div>
      </div>

      {/* Needs Attention section */}
      <div>
        <div className="section-header">
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)]">
              <Skeleton className="h-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar
        description="Create and manage your affiliate campaigns with custom commission structures"
        actions={
          <Button size="sm" onClick={() => setIsCreateSheetOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            New Campaign
          </Button>
        }
      >
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Campaigns</h1>
      </PageTopbar>

      {/* Page Content */}
      <div className="page-content">
        <Suspense fallback={<CampaignOverviewSkeleton />}>
          <CampaignsContent onCreateCampaign={() => setIsCreateSheetOpen(true)} />
        </Suspense>
      </div>

      {/* Create Campaign Side Sheet */}
      <CreateCampaignModal
        isOpen={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
      />
    </div>
  );
}
