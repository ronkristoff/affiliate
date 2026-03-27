"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertCircle } from "lucide-react";

interface DomainVerificationBannerProps {
  className?: string;
}

/**
 * Shared component to show domain verification warning
 * Used in affiliate-facing components when tenant domain is not verified
 */
export function DomainVerificationBanner({ className }: DomainVerificationBannerProps) {
  const verificationStatus = useQuery(api.tracking.checkSnippetInstallation);

  // If verification is pending or not set up yet
  if (verificationStatus?.isVerified) {
    return null;
  }

  return (
    <div className={`bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-medium text-amber-900 dark:text-amber-100 text-sm">
            Referral tracking not yet active
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            The merchant&apos;s website domain is pending verification. 
            Your referral links will be active once tracking is verified.
          </p>
        </div>
      </div>
    </div>
  );
}
