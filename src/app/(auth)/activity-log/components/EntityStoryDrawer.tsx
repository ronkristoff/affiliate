"use client";

import { Suspense, useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { Copy, Check, ArrowRight, Info, User, MousePointerClick, ShoppingCart, DollarSign, Users, Package, AlertTriangle, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { isExceptionAction, getAuditActionLabel } from "@/lib/audit-constants";

interface EntityStoryDrawerProps {
  open: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
}

/**
 * Get a user-friendly display label for an entity based on its type.
 * Used in the drawer header.
 */
function getEntityDrawerLabel(entityType: string): string {
  switch (entityType) {
    case "affiliate":
      return "Affiliate";
    case "commission":
      return "Commission";
    case "conversion":
      return "Conversion";
    case "click":
      return "Click";
    case "payouts":
      return "Payout";
    case "payoutBatches":
      return "Payout Batch";
    case "campaign":
      return "Campaign";
    case "user":
      return "User";
    case "tenant":
      return "Account";
    default:
      return entityType.replace(/([A-Z])/g, " $1").trim();
  }
}

/**
 * Resolution guidance for common issues.
 * Returns null if no guidance needed (success state).
 */
interface ResolutionGuidance {
  type: "success" | "warning" | "error" | "info";
  title: string;
  message: string;
  action?: {
    label: string;
    href?: string;
  };
}

function getResolutionGuidance(
  entityType: string,
  entries: Array<{ action: string; metadata?: Record<string, any> }>
): ResolutionGuidance | null {
  if (!entries || entries.length === 0) return null;

  const latestEntry = entries[entries.length - 1];
  const latestAction = latestEntry.action;

  // Commission issues
  if (entityType === "commission") {
    if (latestAction === "COMMISSION_DECLINED") {
      const reason = latestEntry.metadata?.rejectionReason ?? latestEntry.metadata?.declineReason ?? "Unknown reason";
      return {
        type: "error",
        title: "Commission Declined",
        message: `This commission was declined: ${reason}. Review the affiliate's traffic source or contact them for clarification.`,
        action: { label: "View Affiliates", href: "/affiliates" },
      };
    }
    if (latestAction === "COMMISSION_REVERSED") {
      return {
        type: "error",
        title: "Commission Reversed",
        message: "This commission was reversed after approval. Check for chargebacks, disputes, or fraud signals.",
      };
    }
    if (latestAction === "commission_rejected_payment_failed") {
      return {
        type: "error",
        title: "Payment Failed",
        message: "The payout for this commission failed. Check the affiliate's payment method and retry the payout.",
        action: { label: "View Payouts", href: "/payouts" },
      };
    }
    if (latestAction === "COMMISSION_APPROVED") {
      return {
        type: "success",
        title: "Commission Approved",
        message: "This commission has been approved and will be included in the next payout batch.",
      };
    }
  }

  // Affiliate issues
  if (entityType === "affiliate") {
    if (latestAction === "affiliate_suspended") {
      return {
        type: "error",
        title: "Affiliate Suspended",
        message: "This affiliate has been suspended. They cannot generate new commissions until reactivated.",
        action: { label: "Manage Affiliates", href: "/affiliates" },
      };
    }
    if (latestAction === "affiliate_rejected") {
      return {
        type: "warning",
        title: "Application Rejected",
        message: "This affiliate's application was rejected. They cannot participate in the program.",
      };
    }
  }

  // Payout issues
  if (entityType === "payouts" || entityType === "payoutBatches") {
    if (latestAction === "payout_failed") {
      return {
        type: "error",
        title: "Payout Failed",
        message: "This payout could not be processed. Check the payment gateway status and affiliate payment details.",
        action: { label: "View Payouts", href: "/payouts" },
      };
    }
  }

  // Fraud signals
  if (latestAction === "self_referral_detected" || latestAction === "FRAUD_SIGNAL_ADDED") {
    return {
      type: "warning",
      title: "Fraud Signal Detected",
      message: "A potential fraud signal was detected. Review the affiliate's activity and consider investigating further.",
    };
  }

  // Attribution issues
  if (latestAction.startsWith("attribution_")) {
    if (latestAction === "attribution_no_matching_click") {
      return {
        type: "warning",
        title: "No Matching Click",
        message: "A conversion was recorded but no matching click was found. This may be an organic conversion or a tracking issue.",
      };
    }
    if (latestAction === "attribution_affiliate_invalid") {
      return {
        type: "warning",
        title: "Invalid Affiliate",
        message: "The affiliate linked to this event is invalid or inactive. Check the affiliate's status.",
      };
    }
  }

  return null;
}

function EntityStoryContent({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const story = useQuery(api.audit.getEntityStory, { entityType, entityId });

  // Compute resolution guidance from entries
  const guidance = useMemo(() => {
    if (!story?.entries) return null;
    return getResolutionGuidance(entityType, story.entries);
  }, [story?.entries, entityType]);

  if (story === undefined) {
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-4 w-4 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (story === null || story.entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-page)]">
          <Info className="h-6 w-6 text-[var(--text-muted)]" />
        </div>
        <p className="text-[13px] font-medium text-[var(--text-heading)]">
          No activity found
        </p>
        <p className="mt-1 text-[12px] text-[var(--text-muted)] max-w-[240px]">
          No audit log entries exist for this entity yet.
        </p>
      </div>
    );
  }

  const chain = story.chain ?? [];

  // Guidance color mapping
  const guidanceStyles = {
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  const guidanceIcons = {
    success: CheckCircle,
    warning: AlertTriangle,
    error: XCircle,
    info: HelpCircle,
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Resolution Guidance Card */}
      {guidance && (
        <div className={cn(
          "rounded-lg border p-3",
          guidanceStyles[guidance.type]
        )}>
          <div className="flex items-start gap-2">
            {(() => {
              const Icon = guidanceIcons[guidance.type];
              return <Icon className="h-4 w-4 mt-0.5 shrink-0" />;
            })()}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold">{guidance.title}</p>
              <p className="text-[12px] mt-0.5 opacity-90">{guidance.message}</p>
              {guidance.action && guidance.action.href && (
                <a
                  href={guidance.action.href}
                  className="inline-flex items-center gap-1 mt-2 text-[12px] font-medium underline hover:no-underline"
                >
                  {guidance.action.label} →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {chain.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {chain.map((item: any, index: number) => {
            const isCurrent =
              item.entityType === entityType && item.entityId === entityId;
            return (
              <div key={`${item.entityType}-${item.entityId}-${index}`} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {}}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap",
                    isCurrent
                      ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                      : "bg-muted text-[var(--text-muted)] border-[var(--border)] hover:bg-muted/80"
                  )}
                >
                  {item.entityType.replace(/([A-Z])/g, " $1").trim()}
                </button>
                {index < chain.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {story.notes && story.notes.length > 0 && (
        <div className="space-y-2">
          {story.notes.map((note: string, index: number) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[12px] text-amber-800"
            >
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-[var(--border-light)] pt-4">
        <h4 className="text-[12px] font-medium text-[var(--text-muted)] mb-3">Activity Timeline</h4>
        <ActivityTimeline activities={story.entries} />
      </div>
    </div>
  );
}

export function EntityStoryDrawer({
  open,
  onClose,
  entityType,
  entityId,
}: EntityStoryDrawerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entityId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const entityLabel = getEntityDrawerLabel(entityType);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[15px] font-bold text-[var(--text-heading)]">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[11px] font-medium"
              >
                {entityLabel}
              </Badge>
              <span className="text-[12px] text-[var(--text-muted)]">
                Activity Timeline
              </span>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Activity timeline for this {entityLabel.toLowerCase()}
          </SheetDescription>
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 text-[11px] text-[var(--text-muted)]"
              title="Copy entity ID to clipboard"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied!" : "Copy ID"}
            </Button>
          </div>
        </SheetHeader>

        <Suspense
          fallback={
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-7 w-16 rounded-full" />
                ))}
              </div>
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }
        >
          <EntityStoryContent entityType={entityType} entityId={entityId} />
        </Suspense>
      </SheetContent>
    </Sheet>
  );
}
