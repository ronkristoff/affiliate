"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowUpDown, Clock, XCircle, RefreshCw, AlertTriangle, CalendarDays, CalendarRange, CreditCard } from "lucide-react";
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

type PlanOption = string;

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
  const adminExtendBilling = useMutation(api.admin.subscriptions.adminExtendBilling);
  const adminResetToTrial = useMutation(api.admin.subscriptions.adminResetToTrial);
  const adminMarkAsPaid = useMutation(api.admin.subscriptions.adminMarkAsPaid);
  const adminEditBillingDates = useMutation(api.admin.subscriptions.adminEditBillingDates);

  // Dialog states
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [extendTrialOpen, setExtendTrialOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [extendBillingOpen, setExtendBillingOpen] = useState(false);
  const [resetToTrialOpen, setResetToTrialOpen] = useState(false);
  const [markAsPaidOpen, setMarkAsPaidOpen] = useState(false);
  const [editBillingDatesOpen, setEditBillingDatesOpen] = useState(false);

  // Form states
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>("growth");
  const [extendDays, setExtendDays] = useState("14");
  const [trialDays, setTrialDays] = useState("14");
  const [billingStartDate, setBillingStartDate] = useState("");
  const [billingEndDate, setBillingEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = tenant.subscriptionStatus ?? subscription?.subscriptionStatus;
  const currentPlan = tenant.plan;

  // Reset form state helpers
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

  const openExtendBilling = () => {
    setExtendDays("30");
    setReason("");
    setExtendBillingOpen(true);
  };

  const openResetToTrial = () => {
    setTrialDays("14");
    setReason("");
    setResetToTrialOpen(true);
  };

  const openMarkAsPaid = () => {
    setReason("");
    setMarkAsPaidOpen(true);
  };

  const openEditBillingDates = () => {
    const start = subscription?.billingStartDate
      ? new Date(subscription.billingStartDate).toISOString().split("T")[0]
      : "";
    const end = subscription?.billingEndDate
      ? new Date(subscription.billingEndDate).toISOString().split("T")[0]
      : "";
    setBillingStartDate(start);
    setBillingEndDate(end);
    setReason("");
    setEditBillingDatesOpen(true);
  };

  // ── Handlers ───────────────────────────────────────────────────────

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

  const handleExtendBilling = async () => {
    const days = parseInt(extendDays, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      toast.error("Additional days must be between 1 and 365");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required for this action");
      return;
    }
    setIsSubmitting(true);
    try {
      await adminExtendBilling({
        tenantId,
        additionalDays: days,
        reason: reason.trim(),
      });
      toast.success(`Billing extended by ${days} days`);
      setExtendBillingOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to extend billing");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToTrial = async () => {
    const days = parseInt(trialDays, 10);
    if (isNaN(days) || days < 1 || days > 90) {
      toast.error("Trial days must be between 1 and 90");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required for this action");
      return;
    }
    setIsSubmitting(true);
    try {
      await adminResetToTrial({
        tenantId,
        trialDays: days,
        reason: reason.trim(),
      });
      toast.success(`Tenant reset to ${days}-day trial`);
      setResetToTrialOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to reset to trial");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!reason.trim()) {
      toast.error("A reason is required for this action");
      return;
    }
    setIsSubmitting(true);
    try {
      await adminMarkAsPaid({
        tenantId,
        reason: reason.trim(),
      });
      toast.success("Tenant marked as paid");
      setMarkAsPaidOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to mark as paid");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditBillingDates = async () => {
    if (!billingStartDate || !billingEndDate) {
      toast.error("Both billing start and end dates are required");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required for this action");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await adminEditBillingDates({
        tenantId,
        billingStartDate: new Date(billingStartDate).getTime(),
        billingEndDate: new Date(billingEndDate).getTime(),
        reason: reason.trim(),
      });

      if (result.billingEndDateInPast) {
        toast.warning("Billing end date is in the past — this will trigger past_due on the next cron run.", {
          duration: 6000,
        });
      }
      toast.success("Billing dates updated");
      setEditBillingDatesOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to edit billing dates");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Reason input (shared across dialogs) ─────────────────────────

  const ReasonInput = ({ id }: { id: string }) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        Reason <span className="text-red-500">*</span>
      </Label>
      <Input
        id={id}
        placeholder="Enter reason for this action..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {!reason.trim() && (
        <p className="text-xs text-red-500">Reason is required</p>
      )}
    </div>
  );

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

          {/* Extend Billing — visible when active or past_due */}
          {(status === "active" || status === "past_due") && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-[#155e75] border-cyan-200 hover:bg-cyan-50"
              onClick={openExtendBilling}
            >
              <CalendarDays className="h-4 w-4" />
              Extend Billing
            </Button>
          )}

          {/* Edit Billing Dates — visible when active or past_due */}
          {(status === "active" || status === "past_due") && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-[#155e75] border-cyan-200 hover:bg-cyan-50"
              onClick={openEditBillingDates}
            >
              <CalendarRange className="h-4 w-4" />
              Edit Billing Dates
            </Button>
          )}

          {/* Mark as Paid — visible when past_due or cancelled */}
          {(status === "past_due" || status === "cancelled") && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-[#065f46] border-green-200 hover:bg-green-50"
              onClick={openMarkAsPaid}
            >
              <CreditCard className="h-4 w-4" />
              Mark as Paid
            </Button>
          )}

          {/* Reset to Trial — visible only when cancelled or past_due */}
          {(status === "cancelled" || status === "past_due") && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-[#155e75] border-cyan-200 hover:bg-cyan-50"
              onClick={openResetToTrial}
            >
              <Clock className="h-4 w-4" />
              Reset to Trial
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

          <ReasonInput id="plan-reason" />

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

          <ReasonInput id="trial-reason" />

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

      {/* ─── Extend Billing Dialog ─── */}
      <Dialog open={extendBillingOpen} onOpenChange={setExtendBillingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Billing</DialogTitle>
            <DialogDescription>
              Extend the billing cycle for this tenant. Max 365 days from now.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="extend-billing-days" className="text-sm font-medium">
              Additional Days
            </Label>
            <Input
              id="extend-billing-days"
              type="number"
              min={1}
              max={365}
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
            />
            <p className="text-xs text-[#9ca3af]">Between 1 and 365 days</p>
          </div>

          <ReasonInput id="extend-billing-reason" />

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendBillingOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExtendBilling} disabled={isSubmitting || !reason.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Extend Billing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Billing Dates Dialog ─── */}
      <Dialog open={editBillingDatesOpen} onOpenChange={setEditBillingDatesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Billing Dates</DialogTitle>
            <DialogDescription>
              Update the billing start and end dates. This does not change the subscription status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="billing-start" className="text-sm font-medium">
                Billing Start Date
              </Label>
              <Input
                id="billing-start"
                type="date"
                value={billingStartDate}
                onChange={(e) => setBillingStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-end" className="text-sm font-medium">
                Billing End Date
              </Label>
              <Input
                id="billing-end"
                type="date"
                value={billingEndDate}
                onChange={(e) => setBillingEndDate(e.target.value)}
              />
              {billingEndDate && new Date(billingEndDate) < new Date() && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  End date is in the past — will trigger past_due on next cron run
                </p>
              )}
            </div>
          </div>

          <ReasonInput id="edit-dates-reason" />

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBillingDatesOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditBillingDates} disabled={isSubmitting || !reason.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save Dates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Mark as Paid Dialog ─── */}
      <Dialog open={markAsPaidOpen} onOpenChange={setMarkAsPaidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Manually mark this tenant as paid. Sets a 30-day billing cycle starting now.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-start gap-2">
            <CreditCard className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <div className="text-sm text-green-800">
              <p className="font-medium">Manual Payment Record</p>
              <p className="mt-1 text-green-700">
                This will set the tenant to active with a new 30-day billing cycle.
                Paused campaigns will be resumed.
              </p>
            </div>
          </div>

          <ReasonInput id="mark-paid-reason" />

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkAsPaidOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkAsPaid} disabled={isSubmitting || !reason.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reset to Trial Dialog ─── */}
      <Dialog open={resetToTrialOpen} onOpenChange={setResetToTrialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to Trial</DialogTitle>
            <DialogDescription>
              Reset this tenant to a new trial period. All billing dates will be cleared.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reset-trial-days" className="text-sm font-medium">
              Trial Days
            </Label>
            <Input
              id="reset-trial-days"
              type="number"
              min={1}
              max={90}
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
            />
            <p className="text-xs text-[#9ca3af]">Between 1 and 90 days</p>
          </div>

          <ReasonInput id="reset-trial-reason" />

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetToTrialOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetToTrial} disabled={isSubmitting || !reason.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Reset to Trial
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
              This will cancel the tenant&apos;s subscription. Data is preserved — no deletion is scheduled.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Subscription Cancelled</p>
              <p className="mt-1 text-amber-700">
                The tenant&apos;s account will become read-only. All campaigns will be paused.
                Data is preserved indefinitely and can be reactivated at any time.
              </p>
            </div>
          </div>

          <ReasonInput id="cancel-reason" />

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
              Restore this tenant&apos;s subscription to active status with a new 30-day billing cycle.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-start gap-2">
            <RefreshCw className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <div className="text-sm text-green-800">
              <p className="font-medium">Full Access Restored</p>
              <p className="mt-1 text-green-700">
                The tenant will be set to active with a new 30-day billing cycle.
                Paused campaigns will be automatically resumed.
              </p>
            </div>
          </div>

          <ReasonInput id="reactivate-reason" />

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
