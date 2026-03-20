"use client";

import { Suspense, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CampaignFilters, type FilterState, type ViewMode } from "@/components/dashboard/CampaignFilters";
import { CampaignListView } from "@/components/dashboard/CampaignListView";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowLeft } from "lucide-react";

function CampaignListingContent() {
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get("status");
  const validStatuses = ["active", "paused", "archived"] as const;
  const statusFromUrl = rawStatus && validStatuses.includes(rawStatus as typeof validStatuses[number])
    ? (rawStatus as typeof validStatuses[number])
    : null;

  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: "",
    statusFilter: statusFromUrl ?? undefined,
  });
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const handleFilterChange = useCallback((filters: FilterState) => {
    setFilterState(filters);
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  return (
    <>
      <CampaignFilters
        initialStatusFilter={statusFromUrl}
        onFilterChange={handleFilterChange}
        onViewModeChange={handleViewModeChange}
      />
      <CampaignListView viewMode={viewMode} filterState={filterState} />
    </>
  );
}

function CampaignListingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[220px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function CampaignListingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--border)] h-[60px] flex items-center px-8">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <Link
              href="/campaigns"
              className="text-[13px] text-[#6b7280] hover:text-[#1a1a1a] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Campaigns
            </Link>
            <span className="text-[#d1d5db]">/</span>
            <h1 className="text-[17px] font-bold text-[var(--text-heading)]">All Campaigns</h1>
          </div>
          <div className="flex items-center gap-3">
            <CreateCampaignModal
              trigger={
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-secondary)] transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  New Campaign
                </button>
              }
            />
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        <Suspense fallback={<CampaignListingSkeleton />}>
          <CampaignListingContent />
        </Suspense>
      </div>
    </div>
  );
}
