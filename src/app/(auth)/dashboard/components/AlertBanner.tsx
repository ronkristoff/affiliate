"use client";

import { AlertCircle } from "lucide-react";
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
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--warning-bg)] border border-[#fcd34d] rounded-lg text-[13px] text-[var(--warning-text)] w-full">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Tracking snippet not yet verified.</strong> Install the JS snippet on your website to track referrals.
          </span>
          <Link 
            href="/settings/tracking" 
            className="text-[var(--brand-link)] font-semibold underline hover:no-underline whitespace-nowrap"
          >
            View Setup Guide →
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
