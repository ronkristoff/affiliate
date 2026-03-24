"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
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

interface CreateTierConfigModalProps {
  onClose: () => void;
}

export function CreateTierConfigModal({ onClose }: CreateTierConfigModalProps) {
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

  const createMutation = useMutation(api.admin.tier_configs.createTierConfig);

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Tier</DialogTitle>
          <DialogDescription>
            Add a new pricing tier with custom limits and feature gates. Changes will be reflected on marketing pages immediately.
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

          {/* Tier Name */}
          <div>
            <h3 className="text-sm font-medium text-[#333333] mb-3">Tier Name</h3>
            <div className="flex items-center gap-2">
              <Input
                placeholder="e.g. professional"
                value={tierName}
                onChange={(e) => setTierName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="max-w-[200px]"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lowercase letters, numbers, and hyphens only (e.g. &quot;professional&quot;, &quot;enterprise&quot;)
            </p>
          </div>

          {/* Pricing Section */}
          <div>
            <h3 className="text-sm font-medium text-[#333333] mb-3">Pricing</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">₱</span>
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Tier"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
