"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, AlertTriangle } from "lucide-react";
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

const FEATURE_FIELDS = [
  { key: "customDomain" as const, label: "Custom Domain" },
  { key: "advancedAnalytics" as const, label: "Advanced Analytics" },
  { key: "prioritySupport" as const, label: "Priority Support" },
] as const;

interface EditTierConfigModalProps {
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

export function EditTierConfigModal({ tierConfig, onClose }: EditTierConfigModalProps) {
  // Form state
  const [price, setPrice] = useState(String(tierConfig.price));
  const [limits, setLimits] = useState<Record<string, string>>({
    maxAffiliates: String(tierConfig.maxAffiliates),
    maxCampaigns: String(tierConfig.maxCampaigns),
    maxTeamMembers: String(tierConfig.maxTeamMembers),
    maxPayoutsPerMonth: String(tierConfig.maxPayoutsPerMonth),
    maxApiCalls: String(tierConfig.maxApiCalls),
  });
  const [features, setFeatures] = useState(tierConfig.features);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [impactWarning, setImpactWarning] = useState<{
    affectedTenants: number;
    severity: "warning" | "critical";
    breakdownByLimit: Record<string, { oldValue: number; newValue: number; affectedCount: number }>;
    proposedValues: Record<string, number>;
  } | null>(null);
  
  // Impact assessment query args - when set, triggers the query
  const [impactQueryArgs, setImpactQueryArgs] = useState<{
    tier: string;
    proposedValues: Record<string, number>;
  } | null>(null);

  // Mutations and Queries
  const updateMutation = useMutation(api.admin.tierConfigs.updateTierConfig);

  // Query impact assessment when args are set
  const impactAssessment = useQuery(
    api.admin.tierConfigs.assessTierChangeImpact,
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

  // Subtask 6.5: Client-side validation
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

  // Subtask 6.6: On submit, first check impact
  const handleSubmit = async (forceApply = false) => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const priceNum = Number(price);
      const limitValues: Record<string, number> = {};
      for (const field of LIMIT_FIELDS) {
        limitValues[field.key] = Number(limits[field.key]);
      }

      // Subtask 6.8: Call mutation with forceApply
      const result = await updateMutation({
        tier: tierConfig.tier,
        price: priceNum,
        maxAffiliates: limitValues.maxAffiliates,
        maxCampaigns: limitValues.maxCampaigns,
        maxTeamMembers: limitValues.maxTeamMembers,
        maxPayoutsPerMonth: limitValues.maxPayoutsPerMonth,
        maxApiCalls: limitValues.maxApiCalls,
        features,
        forceApply,
      });

      if (result.success) {
        // Subtask 6.9: Success toast
        toast.success(`${tierConfig.tier.charAt(0).toUpperCase() + tierConfig.tier.slice(1)} tier updated successfully`);
        onClose();
      } else if (result.impactReport) {
        // Subtask 6.7: Trigger impact assessment query to get detailed breakdown
        // The useEffect will update impactWarning when data is available
        setImpactQueryArgs({
          tier: tierConfig.tier,
          proposedValues: limitValues,
        });
        // Don't set isSubmitting to false here - wait for the query to complete
        return;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update tier configuration");
    } finally {
      // Only set submitting to false if we're not waiting for impact assessment
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
        features,
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

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit {tierConfig.tier.charAt(0).toUpperCase() + tierConfig.tier.slice(1)} Tier
            </DialogTitle>
            <DialogDescription>
              Modify pricing, limits, and feature gates for this tier. Changes take effect immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-red-800 text-sm font-medium mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  Validation Errors
                </div>
                <ul className="list-disc list-inside text-red-700 text-sm space-y-0.5">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pricing Section */}
            <div>
              <h3 className="text-sm font-medium text-[#333333] mb-3">Pricing</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
            </div>

            {/* Limits Section */}
            <div>
              <h3 className="text-sm font-medium text-[#333333] mb-3">Limits</h3>
              <div className="space-y-3">
                {LIMIT_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <label className="text-sm text-muted-foreground min-w-[140px]">{label}</label>
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
                      />
                      {Number(limits[key]) === -1 && (
                        <span className="text-xs text-green-600 whitespace-nowrap">Unlimited</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Enter -1 for unlimited
              </p>
            </div>

            {/* Feature Gates Section */}
            <div>
              <h3 className="text-sm font-medium text-[#333333] mb-3">Feature Gates</h3>
              <div className="space-y-3">
                {FEATURE_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <Switch
                      checked={features[key]}
                      onCheckedChange={(checked) =>
                        setFeatures((prev) => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subtask 6.7: Impact Warning Modal */}
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
