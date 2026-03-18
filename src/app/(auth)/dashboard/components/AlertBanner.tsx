"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface AlertItem {
  key: string;
  message: string;
  href: string;
  cta: string;
}

export function AlertBanner({ setupStatus, onDismiss }: AlertBannerProps) {
  if (!setupStatus) return null;

  const alerts: AlertItem[] = [];

  if (!setupStatus.trackingSnippetInstalled) {
    alerts.push({
      key: "tracking",
      message: "Tracking snippet not verified on your website",
      href: "/settings/tracking",
      cta: "Verify Setup",
    });
  }

  if (!setupStatus.saligPayConnected) {
    alerts.push({
      key: "saligpay",
      message: "Connect SaligPay to process affiliate payouts",
      href: "/settings/billing",
      cta: "Connect",
    });
  }

  if (!setupStatus.firstCampaignCreated) {
    alerts.push({
      key: "campaign",
      message: "Create your first campaign to start accepting affiliates",
      href: "/campaigns/new",
      cta: "Create Campaign",
    });
  }

  if (!setupStatus.firstAffiliateApproved) {
    alerts.push({
      key: "affiliate",
      message: "No approved affiliates yet. Review pending applications.",
      href: "/affiliates",
      cta: "Review",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.key}
          className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm">{alert.message}</p>
          </div>
          <Link href={alert.href}>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-7 text-amber-700 hover:text-amber-800 hover:bg-amber-100"
            >
              {alert.cta}
            </Button>
          </Link>
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-7 w-7 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
              onClick={() => onDismiss(alert.key)}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
