"use client";

import { AlertCircle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLimitStatusText } from "@/lib/tierConfig";
import { Button } from "@/components/ui/button";

/**
 * Props for TierLimitBlocked component.
 * Use this to wrap action buttons when tier limits are reached.
 */
export interface TierLimitBlockedProps {
  /** Whether the limit is blocked (allowed === false from useCanCreateResource) */
  blocked: boolean;
  /** Resource type being checked (for display) */
  resourceType: string;
  /** Current usage count */
  current: number;
  /** Maximum allowed */
  limit: number;
  /** The button or action to wrap */
  children: React.ReactNode;
  /** Optional className for the wrapper */
  className?: string;
  /** Callback when upgrade is clicked */
  onUpgradeClick?: () => void;
}

/**
 * TierLimitBlocked - A wrapper component that blocks actions when tier limits are reached.
 * 
 * Use this to wrap action buttons (Create, Add, etc.) to prevent users from performing
 * actions when they've reached their plan limits.
 * 
 * @example
 * ```tsx
 * const { allowed, current, limit } = useCanCreateResource(tenantId, "campaigns");
 * 
 * <TierLimitBlocked
 *   blocked={!allowed}
 *   resourceType="campaigns"
 *   current={current}
 *   limit={limit}
 *   onUpgradeClick={() => router.push("/settings/billing")}
 * >
 *   <Button>Create Campaign</Button>
 * </TierLimitBlocked>
 * ```
 */
export function TierLimitBlocked({
  blocked,
  resourceType,
  current,
  limit,
  children,
  className,
  onUpgradeClick,
}: TierLimitBlockedProps) {
  if (!blocked) {
    return <>{children}</>;
  }

  const formatLimit = (val: number) => {
    return val === -1 ? "Unlimited" : val.toString();
  };

  return (
    <div className={cn("relative", className)}>
      {/* Overlay that blocks interaction */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 rounded-md flex items-center justify-center">
        <div className="text-center p-4">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm font-medium text-destructive">
            {getLimitStatusText("blocked")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {resourceType}: {current} / {formatLimit(limit)}
          </p>
          {onUpgradeClick && (
            <Button
              size="sm"
              onClick={onUpgradeClick}
              className="mt-3 gap-1"
            >
              <ArrowUpRight className="h-4 w-4" />
              Upgrade Plan
            </Button>
          )}
        </div>
      </div>
      {/* Original content (visually hidden but maintains layout) */}
      <div className="opacity-30 pointer-events-none">
        {children}
      </div>
    </div>
  );
}

/**
 * Props for TierLimitGuard component - simpler version that just disables the button.
 */
export interface TierLimitGuardProps {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Reason why it's not allowed (optional, for tooltip) */
  reason?: string;
  /** The button or action to wrap */
  children: React.ReactNode;
  /** Optional className */
  className?: string;
  /** Callback when the blocked button is clicked */
  onBlockedClick?: () => void;
}

/**
 * TierLimitGuard - A simpler guard that just disables buttons when limits are reached.
 * 
 * @example
 * ```tsx
 * const { allowed, reason } = useCanCreateResource(tenantId, "affiliates");
 * 
 * <TierLimitGuard
 *   allowed={allowed}
 *   reason={reason}
 *   onBlockedClick={() => toast.error(reason)}
 * >
 *   <Button>Add Affiliate</Button>
 * </TierLimitGuard>
 * ```
 */
export function TierLimitGuard({
  allowed,
  reason,
  children,
  className,
  onBlockedClick,
}: TierLimitGuardProps) {
  if (allowed) {
    return <>{children}</>;
  }

  // Clone the child element and add disabled prop
  return (
    <div 
      className={className} 
      onClick={(e) => {
        if (!allowed && onBlockedClick) {
          e.preventDefault();
          e.stopPropagation();
          onBlockedClick();
        }
      }}
    >
      {children}
    </div>
  );
}
