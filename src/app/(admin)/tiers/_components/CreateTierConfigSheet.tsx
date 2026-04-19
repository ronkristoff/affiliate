"use client";

import { useState, useCallback } from "react";
import { useAction } from "convex/react";
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

interface CreateTierConfigSheetProps {
  onClose: () => void;
}

export function CreateTierConfigSheet({ onClose }: CreateTierConfigSheetProps) {
  // Form state
  const [tierName, setTierName] = useState("");
  const [price, setPrice] = useState("0");
  const [limits, setLimits] = useState<Record<string, string>>({
    maxAffiliates: "100",
    maxCampaigns: "3",
    maxTeamMembers: "5",
    maxPayoutsPerMonth: "10",
    maxApiCalls: "1000",
  });
  const [features, setFeatures] = useState({
    advancedAnalytics: false,
    prioritySupport: false,
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const createMutation = useAction(api.tierConfigActions.createTierConfigWithStripe);

  // Client-side validation
  const validate = useCallback((): boolean => {
    const errors: string[] = [];

    // Tier name validation
    if (!tierName || tierName.trim().length === 0) {
      errors.push("Tier name is required");
    } else if (tierName.length > 30) {
      errors.push("Tier name must be 30 characters or less");
    } else if (!/^[a-z][a-z0-9-]*$/.test(tierName)) {
      errors.push("Tier name must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens");
    }

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
  }, [tierName, price, limits]);

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await createMutation({
        tier: tierName.trim().toLowerCase(),
        price: Number(price),
        maxAffiliates: Number(limits.maxAffiliates),
        maxCampaigns: Number(limits.maxCampaigns),
        maxTeamMembers: Number(limits.maxTeamMembers),
        maxPayoutsPerMonth: Number(limits.maxPayoutsPerMonth),
        maxApiCalls: Number(limits.maxApiCalls),
        features: {
          customDomain: false,
          ...features,
        },
      });

      toast.success(`${tierName.trim().charAt(0).toUpperCase() + tierName.trim().slice(1)} tier created successfully`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create tier");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <SheetTitle className="text-base font-bold text-[var(--text-heading)]">
                Create New Tier
              </SheetTitle>
              <SheetDescription>
                Add a new pricing tier with custom limits and feature gates.
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

            {/* Tier Name */}
            <div className="space-y-2">
              <Label htmlFor="tier-name" className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                Tier Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tier-name"
                placeholder="e.g. professional"
                value={tierName}
                onChange={(e) => setTierName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                disabled={isSubmitting}
              />
              <p className="text-[11px] text-[var(--text-muted)]">
                Lowercase letters, numbers, and hyphens only (e.g. &quot;professional&quot;, &quot;enterprise&quot;)
              </p>
            </div>

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
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Tier"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
