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

interface OverrideLimitsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: Id<"tenants">;
  /** Current plan limits (defaults) */
  currentLimits: {
    maxAffiliates: number;
    maxCampaigns: number;
    maxTeamMembers: number;
    maxPayoutsPerMonth: number;
  };
  /** Current plan name */
  planName: string;
  /** Current usage counts */
  currentUsage?: {
    affiliates: number;
    campaigns: number;
    teamMembers: number;
    payouts: number;
  };
  /** Called after successful override creation */
  onSuccess?: () => void;
}

interface FormData {
  maxAffiliates: string;
  maxCampaigns: string;
  maxTeamMembers: string;
  maxPayoutsPerMonth: string;
  expiresAt: string;
  reason: string;
}

interface FormErrors {
  maxAffiliates?: string;
  maxCampaigns?: string;
  maxTeamMembers?: string;
  maxPayoutsPerMonth?: string;
  expiresAt?: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_FORM: FormData = {
  maxAffiliates: "",
  maxCampaigns: "",
  maxTeamMembers: "",
  maxPayoutsPerMonth: "",
  expiresAt: "",
  reason: "",
};

function parseNumberInput(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// OverrideLimitsModal Component
// ---------------------------------------------------------------------------

export function OverrideLimitsModal({
  open,
  onOpenChange,
  tenantId,
  currentLimits,
  planName,
  currentUsage,
  onSuccess,
}: OverrideLimitsModalProps) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const createOverride = useMutation(
    api.admin.tierOverrides.createTierOverride
  );

  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};

    // Validate numeric fields (they're optional but must be positive if provided)
    const fields = [
      "maxAffiliates",
      "maxCampaigns",
      "maxTeamMembers",
      "maxPayoutsPerMonth",
    ] as const;

    for (const field of fields) {
      const value = form[field].trim();
      if (value !== "") {
        const num = parseNumberInput(value);
        if (num === null) {
          newErrors[field] = "Must be a valid number";
        } else if (num < 0) {
          newErrors[field] = "Must be a positive number";
        } else if (
          currentUsage &&
          field === "maxAffiliates" &&
          num < currentUsage.affiliates
        ) {
          newErrors[field] = `Warning: Current usage (${currentUsage.affiliates}) exceeds this value`;
        } else if (
          currentUsage &&
          field === "maxCampaigns" &&
          num < currentUsage.campaigns
        ) {
          newErrors[field] = `Warning: Current usage (${currentUsage.campaigns}) exceeds this value`;
        } else if (
          currentUsage &&
          field === "maxTeamMembers" &&
          num < currentUsage.teamMembers
        ) {
          newErrors[field] = `Warning: Current usage (${currentUsage.teamMembers}) exceeds this value`;
        } else if (
          currentUsage &&
          field === "maxPayoutsPerMonth" &&
          num < currentUsage.payouts
        ) {
          newErrors[field] = `Warning: Current usage (${currentUsage.payouts}) exceeds this value`;
        }
      }
    }

    // At least one override value must be provided
    const hasAnyOverride = fields.some((f) => form[f].trim() !== "");
    if (!hasAnyOverride) {
      newErrors.maxAffiliates = "At least one limit override is required";
    }

    // Validate expiration date
    if (form.expiresAt.trim() !== "") {
      const dateValue = new Date(form.expiresAt).getTime();
      if (isNaN(dateValue)) {
        newErrors.expiresAt = "Invalid date format";
      } else if (dateValue < Date.now()) {
        newErrors.expiresAt = "Expiration date cannot be in the past";
      }
    }

    // Validate reason (required, minimum 10 characters)
    if (form.reason.trim().length < 10) {
      newErrors.reason = "Reason is required (minimum 10 characters)";
    }

    return newErrors;
  };

  const handleSubmit = async () => {
    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsLoading(true);

    try {
      const overrides: {
        maxAffiliates?: number;
        maxCampaigns?: number;
        maxTeamMembers?: number;
        maxPayoutsPerMonth?: number;
      } = {};

      const fields = [
        "maxAffiliates",
        "maxCampaigns",
        "maxTeamMembers",
        "maxPayoutsPerMonth",
      ] as const;

      for (const field of fields) {
        const num = parseNumberInput(form[field]);
        if (num !== null) {
          overrides[field] = num;
        }
      }

      const expiresAt = form.expiresAt.trim()
        ? new Date(form.expiresAt).getTime()
        : undefined;

      await createOverride({
        tenantId,
        overrides,
        reason: form.reason.trim(),
        expiresAt,
      });

      toast.success("Tier override applied", {
        description: "The tenant's limits have been updated with the override values.",
      });

      // Reset form and close
      setForm(EMPTY_FORM);
      setErrors({});
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create override";
      toast.error("Override failed", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    onOpenChange(false);
  };

  const handleFieldChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const tierLabel = planName.charAt(0).toUpperCase() + planName.slice(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <DialogTitle className="text-lg">Override Tier Limits</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Apply custom limits for this tenant. Override the default{" "}
            <strong className="text-foreground">{tierLabel}</strong> plan
            limits below. Leave a field empty to keep the plan default.
          </DialogDescription>
        </DialogHeader>

        {/* Current plan info */}
        <div className="rounded-lg bg-[#f9fafb] border border-[#e5e7eb] p-3 text-xs">
          <div className="font-medium text-[#111827] mb-2">
            {tierLabel} Plan Defaults
          </div>
          <div className="grid grid-cols-2 gap-1 text-[#6b7280]">
            <span>Affiliates: {currentLimits.maxAffiliates}</span>
            <span>Campaigns: {currentLimits.maxCampaigns}</span>
            <span>Team Members: {currentLimits.maxTeamMembers}</span>
            <span>Monthly Payouts: {currentLimits.maxPayoutsPerMonth}</span>
          </div>
        </div>

        {/* Override input fields */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Max Affiliates */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#374151]">
                Max Affiliates
                {currentUsage && (
                  <span className="text-[#6b7280] font-normal ml-1">
                    (current: {currentUsage.affiliates})
                  </span>
                )}
              </label>
              <input
                type="number"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                  "focus:border-[#10409a] focus:ring-1 focus:ring-[#10409a]",
                  errors.maxAffiliates
                    ? "border-[#ef4444] bg-red-50"
                    : "border-[#d1d5db] bg-white"
                )}
                placeholder={String(currentLimits.maxAffiliates)}
                value={form.maxAffiliates}
                onChange={(e) => handleFieldChange("maxAffiliates", e.target.value)}
                min="0"
              />
              {errors.maxAffiliates && (
                <p className="text-xs text-[#ef4444]">{errors.maxAffiliates}</p>
              )}
            </div>

            {/* Max Campaigns */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#374151]">
                Max Campaigns
                {currentUsage && (
                  <span className="text-[#6b7280] font-normal ml-1">
                    (current: {currentUsage.campaigns})
                  </span>
                )}
              </label>
              <input
                type="number"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                  "focus:border-[#10409a] focus:ring-1 focus:ring-[#10409a]",
                  errors.maxCampaigns
                    ? "border-[#ef4444] bg-red-50"
                    : "border-[#d1d5db] bg-white"
                )}
                placeholder={String(currentLimits.maxCampaigns)}
                value={form.maxCampaigns}
                onChange={(e) => handleFieldChange("maxCampaigns", e.target.value)}
                min="0"
              />
              {errors.maxCampaigns && (
                <p className="text-xs text-[#ef4444]">{errors.maxCampaigns}</p>
              )}
            </div>

            {/* Max Team Members */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#374151]">
                Max Team Members
                {currentUsage && (
                  <span className="text-[#6b7280] font-normal ml-1">
                    (current: {currentUsage.teamMembers})
                  </span>
                )}
              </label>
              <input
                type="number"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                  "focus:border-[#10409a] focus:ring-1 focus:ring-[#10409a]",
                  errors.maxTeamMembers
                    ? "border-[#ef4444] bg-red-50"
                    : "border-[#d1d5db] bg-white"
                )}
                placeholder={String(currentLimits.maxTeamMembers)}
                value={form.maxTeamMembers}
                onChange={(e) => handleFieldChange("maxTeamMembers", e.target.value)}
                min="0"
              />
              {errors.maxTeamMembers && (
                <p className="text-xs text-[#ef4444]">{errors.maxTeamMembers}</p>
              )}
            </div>

            {/* Max Payouts Per Month */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#374151]">
                Monthly Payouts
                {currentUsage && (
                  <span className="text-[#6b7280] font-normal ml-1">
                    (current: {currentUsage.payouts})
                  </span>
                )}
              </label>
              <input
                type="number"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                  "focus:border-[#10409a] focus:ring-1 focus:ring-[#10409a]",
                  errors.maxPayoutsPerMonth
                    ? "border-[#ef4444] bg-red-50"
                    : "border-[#d1d5db] bg-white"
                )}
                placeholder={String(currentLimits.maxPayoutsPerMonth)}
                value={form.maxPayoutsPerMonth}
                onChange={(e) =>
                  handleFieldChange("maxPayoutsPerMonth", e.target.value)
                }
                min="0"
              />
              {errors.maxPayoutsPerMonth && (
                <p className="text-xs text-[#ef4444]">
                  {errors.maxPayoutsPerMonth}
                </p>
              )}
            </div>
          </div>

          {/* Expiration date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#374151]">
              Expiration Date{" "}
              <span className="text-[#6b7280] font-normal">(optional)</span>
            </label>
            <input
              type="date"
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                "focus:border-[#10409a] focus:ring-1 focus:ring-[#10409a]",
                errors.expiresAt
                  ? "border-[#ef4444] bg-red-50"
                  : "border-[#d1d5db] bg-white"
              )}
              min={getTodayDateString()}
              value={form.expiresAt}
              onChange={(e) => handleFieldChange("expiresAt", e.target.value)}
            />
            {errors.expiresAt && (
              <p className="text-xs text-[#ef4444]">{errors.expiresAt}</p>
            )}
            <p className="text-xs text-[#9ca3af]">
              Leave empty for a permanent override.
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#374151]">
              Reason <span className="text-[#ef4444]">*</span>
            </label>
            <textarea
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors resize-none",
                "focus:border-[#10409a] focus:ring-1 focus:ring-[#10409a]",
                errors.reason
                  ? "border-[#ef4444] bg-red-50"
                  : "border-[#d1d5db] bg-white"
              )}
              rows={3}
              placeholder="Explain why this override is needed (minimum 10 characters)..."
              value={form.reason}
              onChange={(e) => handleFieldChange("reason", e.target.value)}
            />
            {errors.reason && (
              <p className="text-xs text-[#ef4444]">{errors.reason}</p>
            )}
            <p className="text-xs text-[#9ca3af]">
              This will be recorded in the audit log.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            className="bg-amber-800 hover:bg-amber-900 text-white"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


