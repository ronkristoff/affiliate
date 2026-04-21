"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageTopbar } from "@/components/ui/PageTopbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Save, CalendarClock, Clock, DollarSign, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getSanitizedErrorMessage, reportClientError } from "@/lib/utils";

export default function PayoutSettingsPage() {
  const tenantId = useQuery(api.auth.getCurrentTenantId);

  const schedule = useQuery(
    api.tenants.getTenantPayoutSchedule,
    tenantId ? { tenantId } : "skip",
  );

  const hasStripeAccount = useQuery(
    api.tenants.getTenant,
    tenantId ? { tenantId } : "skip",
  );

  const updateSchedule = useMutation(api.tenants.updatePayoutSchedule);

  const [enabled, setEnabled] = useState(false);
  const [payoutDay, setPayoutDay] = useState(15);
  const [processingDays, setProcessingDays] = useState(7);
  const [minimumAmount, setMinimumAmount] = useState(500);
  const [scheduleNote, setScheduleNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);
  const [pendingEnable, setPendingEnable] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const isLoaded = schedule !== undefined && hasStripeAccount !== undefined;
  const isStripeConnected = !!hasStripeAccount?.stripeAccountId;

  if (schedule && !initialized) {
    setEnabled(!!schedule.payoutDayOfMonth);
    setPayoutDay(schedule.payoutDayOfMonth ?? 15);
    setProcessingDays(schedule.payoutProcessingDays ?? 7);
    setMinimumAmount(schedule.minimumPayoutAmount ?? 500);
    setScheduleNote(schedule.payoutScheduleNote ?? "");
    setInitialized(true);
  }

  const handleToggle = (checked: boolean) => {
    if (checked && !enabled) {
      setPendingEnable(true);
      setShowEnableConfirm(true);
    } else {
      setEnabled(false);
    }
  };

  const confirmEnable = () => {
    setEnabled(true);
    setShowEnableConfirm(false);
    setPendingEnable(false);
  };

  const cancelEnable = () => {
    setShowEnableConfirm(false);
    setPendingEnable(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSchedule({
        payoutSchedule: {
          payoutDayOfMonth: enabled ? payoutDay : undefined,
          payoutProcessingDays: enabled ? processingDays : undefined,
          minimumPayoutAmount: enabled ? minimumAmount : undefined,
          payoutScheduleNote: enabled ? (scheduleNote || undefined) : undefined,
        },
      });
      toast.success("Payout settings saved successfully");
    } catch (err) {
      toast.error(getSanitizedErrorMessage(err, "Failed to save payout settings"));
      reportClientError({ source: "PayoutSettingsPage", message: getSanitizedErrorMessage(err, "Failed to save payout settings") });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <PageTopbar description="Configure automatic affiliate payouts via Stripe Connect">
        <h1 className="text-lg font-semibold text-heading">Payout Settings</h1>
      </PageTopbar>

      {!isStripeConnected && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Stripe Connect not configured
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Auto-pay requires a connected Stripe account. Configure your Stripe integration first.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Auto-Pay Configuration</CardTitle>
          <CardDescription>
            Enable automatic payouts to your affiliates on a configured schedule.
            Affiliates must have Stripe Connect enabled to receive automatic payouts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-pay-toggle" className="text-sm font-medium">
                Enable Auto-Pay
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically pay affiliates on the configured schedule
              </p>
            </div>
            <Switch
              id="auto-pay-toggle"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={!isStripeConnected || isSaving}
            />
          </div>

          <div className="divider" />

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payout-day" className="flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Payout Day of Month
              </Label>
              <Input
                id="payout-day"
                type="number"
                min={1}
                max={28}
                value={payoutDay}
                onChange={(e) => setPayoutDay(parseInt(e.target.value) || 1)}
                disabled={!enabled || isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Day of month to run auto-pay (1-28). Providers don&apos;t support 29-31.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="processing-days" className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Processing Days
              </Label>
              <Input
                id="processing-days"
                type="number"
                min={0}
                max={90}
                value={processingDays}
                onChange={(e) => setProcessingDays(parseInt(e.target.value) || 0)}
                disabled={!enabled || isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Days to wait after commission approval before paying (default: 7)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-amount" className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Minimum Payout Amount
              </Label>
              <Input
                id="minimum-amount"
                type="number"
                min={0}
                step={100}
                value={minimumAmount}
                onChange={(e) => setMinimumAmount(parseFloat(e.target.value) || 0)}
                disabled={!enabled || isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Minimum total commission before an affiliate is included in auto-pay (default: &#8369;500)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-note" className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Schedule Note (Optional)
              </Label>
              <Textarea
                id="schedule-note"
                value={scheduleNote}
                onChange={(e) => setScheduleNote(e.target.value)}
                placeholder="Internal note about this payout schedule..."
                rows={3}
                disabled={!enabled || isSaving}
              />
            </div>
          </div>

          {enabled && schedule?.nextPayoutDate && (
            <div className="rounded-lg bg-muted/50 border p-3">
              <p className="text-xs text-muted-foreground">
                Next scheduled payout:{" "}
                <span className="font-medium text-foreground">
                  {new Date(schedule.nextPayoutDate).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showEnableConfirm} onOpenChange={setShowEnableConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable Auto-Pay?</AlertDialogTitle>
            <AlertDialogDescription>
              Affiliates will be paid automatically on the configured schedule.
              Make sure your Stripe Connect balance is sufficient to cover payouts.
              Insufficient balance will skip the payout cycle and notify you via email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelEnable}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnable}>Enable Auto-Pay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
