"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowUpDown, Clock, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { TenantDetail } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminSubscriptionActionsProps {
  tenantId: Id<"tenants">;
  tenant: Pick<TenantDetail, "plan" | "subscriptionStatus" | "trialEndsAt">;
}

type PlanOption = "starter" | "growth" | "scale";

const PLAN_OPTIONS: { value: PlanOption; label: string; price: string }[] = [
  { value: "starter", label: "Starter", price: "Free" },
  { value: "growth", label: "Growth", price: "₱2,499/mo" },
  { value: "scale", label: "Scale", price: "₱4,999/mo" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminSubscriptionActions({
  tenantId,
  tenant,
}: AdminSubscriptionActionsProps) {
  const subscription = useQuery(api.admin.subscriptions.getTenantSubscription, {
    tenantId,
  });
  const adminChangePlan = useMutation(api.admin.subscriptions.adminChangePlan);
  const adminExtendTrial = useMutation(api.admin.subscriptions.adminExtendTrial);
  const adminCancelSubscription = useMutation(api.admin.subscriptions.adminCancelSubscription);
  const adminReactivateSubscription = useMutation(api.admin.subscriptions.adminReactivateSubscription);

  // Dialog states
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [extendTrialOpen, setExtendTrialOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);

  // Form states
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>("growth");
  const [extendDays, setExtendDays] = useState("14");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = tenant.subscriptionStatus ?? subscription?.subscriptionStatus;
  const currentPlan = tenant.plan;

  // Reset form state on dialog open
  const openChangePlan = () => {
    setSelectedPlan(currentPlan === "growth" ? "scale" : "growth");
    setReason("");
    setChangePlanOpen(true);
  };

  const openExtendTrial = () => {
    setExtendDays("14");
    setReason("");
    setExtendTrialOpen(true);
  };

  const openCancel = () => {
    setReason("");
    setCancelOpen(true);
  };

  const openReactivate = () => {
    setReason("");
    setReactivateOpen(true);
  };

  const handlePlanChange = async () => {
    if (!reason.trim()) {
      toast.error("A reason is required for this action");
      return;
    }
    setIsSubmitting(true);
    try {
      await adminChangePlan({
        tenantId,
        targetPlan: selectedPlan,
        reason: reason.trim(),
      });
      toast.success(`Plan changed to ${selectedPlan}`);
      setChangePlanOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to change plan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExtendTrial = async () => {
    const days = parseInt(extendDays, 10);
    if (isNaN(days) || days < 1 || days > 90) {
      toast.error("Days must be between 1 and 90");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required for this action");
      return;
    }
    setIsSubmitting(true);
    try {
      await adminExtendTrial({
        tenantId,
        additionalDays: days,
        reason: reason.trim(),
      });
      toast.success(`Trial extended by ${days} days`);
      setExtendTrialOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to extend trial");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!reason.trim()) {
      toast.error("A reason is required for this action");
      return;
    }
    setIsSubmitting(true);
    try {
      await adminCancelSubscription({
        tenantId,
        reason: reason.trim(),
      });
      toast.success("Subscription cancelled");
      setCancelOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel subscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivate = async () => {
    if (!reason.trim()) {
      toast.error("A reason is required for this action");
      return;
    }
    setIsSubmitting(true);
    try {
      await adminReactivateSubscription({
        tenantId,
        reason: reason.trim(),
      });
      toast.success("Subscription reactivated");
      setReactivateOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to reactivate subscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="border-[#e5e7eb]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#374151]">
            Subscription Actions
          </CardTitle>
          <CardDescription>
            Administrative actions for this tenant&apos;s subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Change Plan — visible except when cancelled */}
          {status !== "cancelled" && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={openChangePlan}
            >
              <ArrowUpDown className="h-4 w-4" />
              Change Plan
            </Button>
          )}

          {/* Extend Trial — visible only when on trial */}
          {status === "trial" && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-[#155e75] border-cyan-200 hover:bg-cyan-50"
              onClick={openExtendTrial}
            >
              <Clock className="h-4 w-4" />
              Extend Trial
            </Button>
          )}

          {/* Cancel Subscription — visible when active or trial */}
          {(status === "active" || status === "trial") && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-[#991b1b] border-red-200 hover:bg-red-50"
              onClick={openCancel}
            >
              <XCircle className="h-4 w-4" />
              Cancel Subscription
            </Button>
          )}

          {/* Reactivate — visible only when cancelled */}
          {status === "cancelled" && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-[#065f46] border-green-200 hover:bg-green-50"
              onClick={openReactivate}
            >
              <RefreshCw className="h-4 w-4" />
              Reactivate Subscription
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ─── Change Plan Dialog ─── */}
      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Tenant Plan</DialogTitle>
            <DialogDescription>
              Current plan: <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong>.
              Select the new plan below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-sm font-medium">Select Plan</Label>
            <div className="grid gap-2">
              {PLAN_OPTIONS.filter((p) => p.value !== currentPlan).map((plan) => (
                <button
                  key={plan.value}
                  type="button"
                  onClick={() => setSelectedPlan(plan.value)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    selectedPlan === plan.value
                      ? "border-[#1c2260] bg-[#eff6ff]"
                      : "border-[#e5e7eb] hover:border-[#9ca3af]"
                  }`}
                >
                  <span className="text-sm font-medium">{plan.label}</span>
                  <span className="text-xs text-[#6b7280]">{plan.price}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-reason" className="text-sm font-medium">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Input
              id="plan-reason"
              placeholder="Enter reason for plan change..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {!reason.trim() && (
              <p className="text-xs text-red-500">Reason is required</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePlanChange} disabled={isSubmitting || !reason.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Change Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Extend Trial Dialog ─── */}
      <Dialog open={extendTrialOpen} onOpenChange={setExtendTrialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Trial Period</DialogTitle>
            <DialogDescription>
              Add additional days to this tenant&apos;s trial period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="extend-days" className="text-sm font-medium">
              Additional Days
            </Label>
            <Input
              id="extend-days"
              type="number"
              min={1}
              max={90}
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
            />
            <p className="text-xs text-[#9ca3af]">Between 1 and 90 days</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trial-reason" className="text-sm font-medium">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Input
              id="trial-reason"
              placeholder="Enter reason for trial extension..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {!reason.trim() && (
              <p className="text-xs text-red-500">Reason is required</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendTrialOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExtendTrial} disabled={isSubmitting || !reason.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Extend Trial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Subscription Dialog ─── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              This will cancel the tenant&apos;s subscription and schedule data deletion.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Warning: Data Deletion Scheduled</p>
              <p className="mt-1 text-amber-700">
                The tenant&apos;s data will be scheduled for deletion 30 days after their current
                billing cycle ends. They will retain access until then.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason" className="text-sm font-medium">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cancel-reason"
              placeholder="Enter reason for cancellation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {!reason.trim() && (
              <p className="text-xs text-red-500">Reason is required</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Cancel Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reactivate Subscription Dialog ─── */}
      <Dialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactivate Subscription</DialogTitle>
            <DialogDescription>
              Restore this tenant&apos;s subscription to active status. Any scheduled
              data deletion will be cancelled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reactivate-reason" className="text-sm font-medium">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Input
              id="reactivate-reason"
              placeholder="Enter reason for reactivation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {!reason.trim() && (
              <p className="text-xs text-red-500">Reason is required</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReactivate} disabled={isSubmitting || !reason.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Reactivate Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
