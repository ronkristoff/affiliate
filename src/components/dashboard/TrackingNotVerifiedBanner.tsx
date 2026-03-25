"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";

/**
 * Tracking Not Verified Banner Component
 * AC5: Skip Option - Shows reminder on dashboard when tracking is not verified
 *
 * If `isVerified` is provided and true, the banner is skipped entirely
 * without firing any query. Otherwise, falls back to checking via query.
 */
export function TrackingNotVerifiedBanner({ isVerified }: { isVerified?: boolean }) {
  // Short-circuit: if parent already knows tracking is verified, skip the query
  if (isVerified) {
    return null;
  }

  const verificationStatus = useQuery(api.tracking.checkSnippetInstallation);

  // Show loading state while fetching verification status
  if (verificationStatus === undefined) {
    return (
      <div className="bg-muted border border-border rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Checking tracking status...
          </span>
        </div>
      </div>
    );
  }

  // Don't show banner if tracking is verified
  if (verificationStatus?.isVerified) {
    return null;
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-medium text-amber-900 dark:text-amber-100">
            Tracking snippet not yet verified
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Install the tracking snippet to enable click and conversion attribution for your affiliate program.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/onboarding/snippet">
              View Setup Guide
              <ExternalLink className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
