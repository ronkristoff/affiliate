"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RemoveOverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: Id<"tenants">;
  overrideId: Id<"tierOverrides">;
  /** Current usage vs plan limits for impact summary */
  currentUsage: {
    affiliates: number;
    campaigns: number;
    teamMembers: number;
    payouts: number;
  };
  /** Plan default limits (what tenant reverts to) */
  planLimits: {
    maxAffiliates: number;
    maxCampaigns: number;
    maxTeamMembers: number;
    maxPayoutsPerMonth: number;
  };
  /** Called after successful removal */
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function willExceedLimit(current: number, limit: number): boolean {
  if (limit === -1) return false; // Unlimited
  return current > limit;
}

// ---------------------------------------------------------------------------
// RemoveOverrideModal Component
// ---------------------------------------------------------------------------

export function RemoveOverrideModal({
  open,
  onOpenChange,
  tenantId,
  overrideId,
  currentUsage,
  planLimits,
  onSuccess,
}: RemoveOverrideModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const removeOverride = useMutation(
    api.admin.tier_overrides.removeTierOverride
  );

  const handleConfirm = async () => {
    setIsLoading(true);

    try {
      await removeOverride({ overrideId });

      toast.success("Override removed", {
        description: "The tenant has reverted to plan default limits.",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to remove override";
      toast.error("Removal failed", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const exceedAffiliates = willExceedLimit(currentUsage.affiliates, planLimits.maxAffiliates);
  const exceedCampaigns = willExceedLimit(currentUsage.campaigns, planLimits.maxCampaigns);
  const exceedTeam = willExceedLimit(currentUsage.teamMembers, planLimits.maxTeamMembers);
  const exceedPayouts = willExceedLimit(currentUsage.payouts, planLimits.maxPayoutsPerMonth);
  const hasExceedances = exceedAffiliates || exceedCampaigns || exceedTeam || exceedPayouts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-red-50 border-2 border-red-200 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <DialogTitle className="text-lg">Remove Override?</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            This will revert the tenant to their plan&apos;s default limits. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Impact summary */}
        <div className="rounded-lg bg-[#f9fafb] border border-[#e5e7eb] p-3 text-xs space-y-1.5">
          <div className="font-medium text-[#111827] mb-2">
            Impact Summary
          </div>
          <div className="grid grid-cols-3 gap-1 text-[#6b7280]">
            <span className="font-medium">Resource</span>
            <span className="text-center font-medium">Current</span>
            <span className="text-right font-medium">Plan Limit</span>
          </div>

          <div className={cn(
            "grid grid-cols-3 gap-1",
            exceedAffiliates && "text-red-700"
          )}>
            <span>Affiliates</span>
            <span className="text-center">{currentUsage.affiliates}</span>
            <span className="text-right">{planLimits.maxAffiliates}</span>
          </div>

          <div className={cn(
            "grid grid-cols-3 gap-1",
            exceedCampaigns && "text-red-700"
          )}>
            <span>Campaigns</span>
            <span className="text-center">{currentUsage.campaigns}</span>
            <span className="text-right">{planLimits.maxCampaigns}</span>
          </div>

          <div className={cn(
            "grid grid-cols-3 gap-1",
            exceedTeam && "text-red-700"
          )}>
            <span>Team Members</span>
            <span className="text-center">{currentUsage.teamMembers}</span>
            <span className="text-right">{planLimits.maxTeamMembers}</span>
          </div>

          <div className={cn(
            "grid grid-cols-3 gap-1",
            exceedPayouts && "text-red-700"
          )}>
            <span>Monthly Payouts</span>
            <span className="text-center">{currentUsage.payouts}</span>
            <span className="text-right">{planLimits.maxPayoutsPerMonth}</span>
          </div>
        </div>

        {/* Warning about exceeded limits */}
        {hasExceedances && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            <strong className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Warning:
            </strong>{" "}
            Current usage exceeds plan default limits for some resources. The
            tenant may be restricted from creating new resources until usage
            decreases below plan limits.
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Remove Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
