"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Layers, DollarSign, SlidersHorizontal, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ImpactWarningModal } from "./ImpactWarningModal";

// Input field definitions
const LIMIT_FIELDS = [
  { key: "maxAffiliates", label: "Max Affiliates" },
  { key: "maxCampaigns", label: "Max Campaigns" },
  { key: "maxTeamMembers", label: "Max Team Members" },
  { key: "maxPayoutsPerMonth", label: "Max Payouts/Month" },
  { key: "maxApiCalls", label: "Max API Calls" },
] as const;

// Feature gates (customDomain removed)
const FEATURE_FIELDS = [
  { key: "advancedAnalytics" as const, label: "Advanced Analytics" },
  { key: "prioritySupport" as const, label: "Priority Support" },
] as const;

interface EditTierConfigSheetProps {
  tierConfig: {
    _id: string;
    tier: string;
    price: number;
    maxAffiliates: number;
    maxCampaigns: number;
    maxTeamMembers: number;
    maxPayoutsPerMonth: number;
    maxApiCalls: number;
    features: {
      customDomain: boolean;
      advancedAnalytics: boolean;
      prioritySupport: boolean;
    };
  };
  onClose: () => void;
}

export function EditTierConfigSheet({ tierConfig, onClose }: EditTierConfigSheetProps) {
  // Form state
  const [price, setPrice] = useState(String(tierConfig.price));
  const [limits, setLimits] = useState<Record<string, string>>({
    maxAffiliates: String(tierConfig.maxAffiliates),
    maxCampaigns: String(tierConfig.maxCampaigns),
    maxTeamMembers: String(tierConfig.maxTeamMembers),
    maxPayoutsPerMonth: String(tierConfig.maxPayoutsPerMonth),
    maxApiCalls: String(tierConfig.maxApiCalls),
  });
  const [features, setFeatures] = useState({
    advancedAnalytics: tierConfig.features.advancedAnalytics,
    prioritySupport: tierConfig.features.prioritySupport,
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [impactWarning, setImpactWarning] = useState<{
    affectedTenants: number;
    severity: "none" | "warning" | "critical";
    breakdownByLimit: Record<string, { oldValue: number; newValue: number; affectedCount: number }>;
    proposedValues: Record<string, number>;
  } | null>(null);
  
  // Impact assessment query args - when set, triggers the query
  const [impactQueryArgs, setImpactQueryArgs] = useState<{
    tier: string;
    proposedValues: Record<string, number>;
  } | null>(null);

  // Mutations and Queries
  const updateMutation = useAction(api.tierConfigActions.updateTierConfigWithStripe);

  // Query impact assessment when args are set
  const impactAssessment = useQuery(
    api.admin.tier_configs.assessTierChangeImpact,
    impactQueryArgs ? {
      tier: impactQueryArgs.tier,
      proposedValues: {
        maxAffiliates: impactQueryArgs.proposedValues.maxAffiliates,
        maxCampaigns: impactQueryArgs.proposedValues.maxCampaigns,
        maxTeamMembers: impactQueryArgs.proposedValues.maxTeamMembers,
        maxPayoutsPerMonth: impactQueryArgs.proposedValues.maxPayoutsPerMonth,
        maxApiCalls: impactQueryArgs.proposedValues.maxApiCalls,
      }
    } : "skip"
  );

  // Handle impact assessment result
  useEffect(() => {
    if (impactAssessment && impactQueryArgs) {
      setImpactWarning({
        affectedTenants: impactAssessment.affectedTenants,
        severity: impactAssessment.severity,
        breakdownByLimit: impactAssessment.breakdownByLimit,
        proposedValues: impactQueryArgs.proposedValues,
      });
      setIsSubmitting(false);
      setImpactQueryArgs(null);
    }
  }, [impactAssessment, impactQueryArgs]);

  // Client-side validation
  const validate = useCallback((): boolean => {
    const errors: string[] = [];

    // Price validation
    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      errors.push("Price must be >= 0");
    }
    if (priceNum > 100000) {
      errors.push("Price cannot exceed 100,000");
    }

    // Limit validation
    for (const field of LIMIT_FIELDS) {
      const val = limits[field.key];
      const num = Number(val);

      if (val === "" || isNaN(num)) {
        errors.push(`${field.label} is required`);
      } else if (num !== -1 && num <= 0) {
        errors.push(`${field.label} must be > 0 or -1 (Unlimited)`);
      } else if (num > 100000) {
        errors.push(`${field.label} cannot exceed 100,000`);
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [price, limits]);

  // On submit, first check impact
  const handleSubmit = async (forceApply = false) => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const priceNum = Number(price);
      const limitValues: Record<string, number> = {};
      for (const field of LIMIT_FIELDS) {
        limitValues[field.key] = Number(limits[field.key]);
      }

      // Call mutation with forceApply
      const result = await updateMutation({
        tier: tierConfig.tier,
        price: priceNum,
        maxAffiliates: limitValues.maxAffiliates,
        maxCampaigns: limitValues.maxCampaigns,
        maxTeamMembers: limitValues.maxTeamMembers,
        maxPayoutsPerMonth: limitValues.maxPayoutsPerMonth,
        maxApiCalls: limitValues.maxApiCalls,
        features: {
          customDomain: false,
          ...features,
        },
        forceApply,
      });

      if (result.success) {
        toast.success(`${tierConfig.tier.charAt(0).toUpperCase() + tierConfig.tier.slice(1)} tier updated successfully`);
        onClose();
      } else if (result.impactReport) {
        setImpactQueryArgs({
          tier: tierConfig.tier,
          proposedValues: limitValues,
        });
        return;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update tier configuration");
    } finally {
      if (!impactQueryArgs) {
        setIsSubmitting(false);
      }
    }
  };

  // Handle impact confirmation
  const handleImpactConfirm = async () => {
    if (!impactWarning) return;

    setIsSubmitting(true);
    try {
      const priceNum = Number(price);
      const result = await updateMutation({
        tier: tierConfig.tier,
        price: priceNum,
        maxAffiliates: Number(limits.maxAffiliates),
        maxCampaigns: Number(limits.maxCampaigns),
        maxTeamMembers: Number(limits.maxTeamMembers),
        maxPayoutsPerMonth: Number(limits.maxPayoutsPerMonth),
        maxApiCalls: Number(limits.maxApiCalls),
        features: {
          customDomain: false,
          ...features,
        },
        forceApply: true,
      });

      if (result.success) {
        toast.success(`${tierConfig.tier.charAt(0).toUpperCase() + tierConfig.tier.slice(1)} tier updated successfully`);
        setImpactWarning(null);
        onClose();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update tier configuration");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tierLabel = tierConfig.tier.charAt(0).toUpperCase() + tierConfig.tier.slice(1);

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
          <SheetHeader className="px-6 py-5 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--brand-primary)] flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <SheetTitle className="text-base font-bold text-[var(--text-heading)]">
                  Edit {tierLabel} Tier
                </SheetTitle>
                <SheetDescription>
                  Modify pricing, limits, and feature gates. Changes take effect immediately.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] p-3">
                  <div className="flex items-center gap-2 text-[var(--danger-text)] text-sm font-medium mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Validation Errors
                  </div>
                  <ul className="list-disc list-inside text-[var(--danger-text)] text-sm space-y-0.5">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pricing Section */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  Pricing
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-muted)]">₱</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="max-w-[140px]"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-[var(--text-muted)]">/month</span>
                </div>
              </div>

              {/* Limits Section */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  Limits
                </Label>
                <div className="space-y-3">
                  {LIMIT_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <label className="text-sm text-[var(--text-muted)] min-w-[140px]">{label}</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={-1}
                          step={1}
                          value={limits[key]}
                          onChange={(e) =>
                            setLimits((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className="w-[100px]"
                          disabled={isSubmitting}
                        />
                        {Number(limits[key]) === -1 && (
                          <span className="text-xs text-[var(--success)] whitespace-nowrap">Unlimited</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Enter -1 for unlimited
                </p>
              </div>

              {/* Feature Gates Section */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  Feature Gates
                </Label>
                <div className="space-y-3">
                  {FEATURE_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text-muted)]">{label}</span>
                      <Switch
                        checked={features[key]}
                        onCheckedChange={(checked) =>
                          setFeatures((prev) => ({ ...prev, [key]: checked }))
                        }
                        disabled={isSubmitting}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[var(--border)] flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              className="bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)]"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Impact Warning Modal */}
      {impactWarning && (
        <ImpactWarningModal
          tierName={tierConfig.tier}
          affectedTenants={impactWarning.affectedTenants}
          severity={impactWarning.severity}
          currentValues={{
            maxAffiliates: tierConfig.maxAffiliates,
            maxCampaigns: tierConfig.maxCampaigns,
            maxTeamMembers: tierConfig.maxTeamMembers,
            maxPayoutsPerMonth: tierConfig.maxPayoutsPerMonth,
            maxApiCalls: tierConfig.maxApiCalls,
          }}
          proposedValues={impactWarning.proposedValues}
          breakdownByLimit={impactWarning.breakdownByLimit}
          onConfirm={handleImpactConfirm}
          onCancel={() => setImpactWarning(null)}
          isLoading={isSubmitting}
        />
      )}
    </>
  );
}
