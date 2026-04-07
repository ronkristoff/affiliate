"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";

interface SetupStatus {
  trackingSnippetInstalled: boolean;
  billingProviderConnected: boolean;
  referralTrackingActive: boolean;
  firstCampaignCreated: boolean;
  firstAffiliateApproved: boolean;
}

interface AlertBannerProps {
  setupStatus: SetupStatus | null | undefined;
  onDismiss?: (key: string) => void;
}

export function AlertBanner({ setupStatus, onDismiss }: AlertBannerProps) {
  if (!setupStatus) return null;

  // Priority 1: Tracking snippet not installed (most critical)
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

  // Priority 2: Billing provider connected but referral tracking not active
  if (setupStatus.billingProviderConnected && !setupStatus.referralTrackingActive) {
    return (
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950 border border-blue-300 dark:border-blue-700 rounded-lg text-[13px] text-blue-800 dark:text-blue-200 w-full">
          <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>
            <strong>Referral tracking not configured.</strong> Commissions won&apos;t be created until you add one line to your signup form.
          </span>
          <Link 
            href="/settings/tracking" 
            className="text-blue-600 dark:text-blue-400 font-semibold underline hover:no-underline whitespace-nowrap"
          >
            Go to Setup →
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
