"use client";

import Link from "next/link";

interface SetupStatus {
  trackingSnippetInstalled: boolean;
  saligPayConnected: boolean;
  firstCampaignCreated: boolean;
  firstAffiliateApproved: boolean;
}

interface AlertBannerProps {
  setupStatus: SetupStatus | null | undefined;
  onDismiss?: (key: string) => void;
}

export function AlertBanner({ setupStatus, onDismiss }: AlertBannerProps) {
  if (!setupStatus) return null;

  // Only show the most critical unverified item (tracking is most important)
  if (!setupStatus.trackingSnippetInstalled) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#fef3c7] border-b border-[#fcd34d] text-[13px] text-[#92400e]">
        <span>⚠️</span>
        <span>
          <strong>Tracking snippet not yet verified.</strong> Install the JS snippet on your website to track referrals.
        </span>
        <Link 
          href="/settings/tracking" 
          className="text-[var(--brand-link)] font-semibold underline hover:no-underline"
        >
          View Setup Guide →
        </Link>
      </div>
    );
  }

  return null;
}
