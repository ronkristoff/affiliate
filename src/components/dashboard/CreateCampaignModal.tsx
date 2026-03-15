"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CommissionPreview } from "./CommissionPreview";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import { DEFAULT_REDUCED_RATE_PERCENTAGE } from "@/lib/utils";

interface CreateCampaignModalProps {
  trigger?: React.ReactNode;
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function CreateCampaignModal({ trigger, children, onSuccess }: CreateCampaignModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [commissionType, setCommissionType] = useState<"percentage" | "flatFee">("percentage");
  const [commissionRate, setCommissionRate] = useState("");
  const [cookieDuration, setCookieDuration] = useState("30");
  const [recurringCommissions, setRecurringCommissions] = useState(false);
  const [recurringRate, setRecurringRate] = useState("");
  const [recurringRateType, setRecurringRateType] = useState<"same" | "reduced" | "custom">("same");
  const [autoApproveCommissions, setAutoApproveCommissions] = useState(true);
  const [approvalThreshold, setApprovalThreshold] = useState("");

  // Get campaign limit status
  const campaignLimit = useQuery(api.campaigns.checkCampaignLimit);
  
  const createCampaign = useMutation(api.campaigns.createCampaign);

  // Form validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = "Campaign name is required";
    } else if (name.trim().length < 2) {
      newErrors.name = "Campaign name must be at least 2 characters";
    } else if (name.trim().length > 100) {
      newErrors.name = "Campaign name must be less than 100 characters";
    }

    // Validate commission rate
    if (!commissionRate) {
      newErrors.commissionRate = "Commission rate is required";
    } else {
      const rate = Number(commissionRate);
      if (isNaN(rate)) {
        newErrors.commissionRate = "Commission rate must be a number";
      } else if (commissionType === "percentage") {
        if (rate < 1 || rate > 100) {
          newErrors.commissionRate = "Percentage must be between 1 and 100";
        }
      } else {
        if (rate < 0) {
          newErrors.commissionRate = "Flat fee must be 0 or greater";
        }
      }
    }

    // Validate cookie duration
    if (cookieDuration) {
      const duration = Number(cookieDuration);
      if (isNaN(duration)) {
        newErrors.cookieDuration = "Cookie duration must be a number";
      } else if (duration < 1 || duration > 365) {
        newErrors.cookieDuration = "Cookie duration must be between 1 and 365 days";
      }
    }

    // Validate recurring rate
    if (recurringCommissions && recurringRateType !== "same" && recurringRate) {
      const rate = Number(recurringRate);
      if (isNaN(rate)) {
        newErrors.recurringRate = "Recurring rate must be a number";
      } else if (rate < 1 || rate > 100) {
        newErrors.recurringRate = "Recurring rate must be between 1 and 100";
      }
    }

    // Validate approval threshold
    if (autoApproveCommissions && approvalThreshold) {
      const threshold = Number(approvalThreshold);
      if (isNaN(threshold)) {
        newErrors.approvalThreshold = "Approval threshold must be a number";
      } else if (threshold < 0) {
        newErrors.approvalThreshold = "Approval threshold must be 0 or greater";
      } else if (threshold > 10000000) {
        newErrors.approvalThreshold = "Approval threshold must be less than ₱10,000,000";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setCommissionType("percentage");
      setCommissionRate("10"); // Default 10% for percentage commission (AC #1)
      setCookieDuration("30");
      setRecurringCommissions(false);
      setRecurringRate("");
      setRecurringRateType("same");
      setAutoApproveCommissions(true);
      setApprovalThreshold("");
    }
  }, [open]);

  // Handle commission type changes (AC #5)
  useEffect(() => {
    // When switching to percentage, set default to 10% if empty or was flat fee
    if (commissionType === "percentage") {
      const currentRate = Number(commissionRate);
      if (!commissionRate || currentRate > 100) {
        setCommissionRate("10");
      }
    }
    // When switching to flat fee, set default to ₱50 (AC #1)
    if (commissionType === "flatFee") {
      const currentRate = Number(commissionRate);
      if (!commissionRate || currentRate < 0) {
        setCommissionRate("50");
      }
    }
    // Clear validation errors when switching types
    if (errors.commissionRate) {
      setErrors((prev) => ({ ...prev, commissionRate: "" }));
    }
  }, [commissionType]);

  // Handle recurring rate type changes - calculate default reduced rate
  useEffect(() => {
    if (recurringCommissions && recurringRateType === "reduced") {
      // Calculate default reduced percentage of initial commission rate
      const initialRate = Number(commissionRate) || 0;
      const reducedRate = Math.round(initialRate * (DEFAULT_REDUCED_RATE_PERCENTAGE / 100) * 100) / 100;
      if (reducedRate > 0) {
        setRecurringRate(String(reducedRate));
      }
    }
  }, [recurringRateType, recurringCommissions, commissionRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Frontend validation
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      const result = await createCampaign({
        name,
        description: description || undefined,
        commissionType,
        commissionRate: Number(commissionRate),
        cookieDuration: Number(cookieDuration),
        recurringCommissions,
        recurringRate: recurringCommissions && recurringRate && recurringRateType !== "same" ? Number(recurringRate) : undefined,
        recurringRateType: recurringCommissions ? recurringRateType : undefined,
        autoApproveCommissions,
        approvalThreshold: approvalThreshold ? Number(approvalThreshold) : undefined,
      });

      toast.success("Campaign created successfully!");
      setOpen(false);
      onSuccess?.();
      
      // Navigate to the new campaign (result is the campaign ID)
      router.push(`/campaigns/${result}`);
      router.refresh();
    } catch (error) {
      console.error("Failed to create campaign:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };



  // Check if limit is reached
  const isLimitReached = campaignLimit && !campaignLimit.allowed;
  const isWarning = campaignLimit && campaignLimit.status === "warning";
  const isCritical = campaignLimit && campaignLimit.status === "critical";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || children || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Campaign
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Set up a new affiliate campaign to track referrals and commissions.
          </DialogDescription>
        </DialogHeader>

        {/* Limit Warning */}
        {campaignLimit === undefined ? (
          <div className="p-3 rounded-lg bg-muted animate-pulse">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking campaign limits...</span>
            </div>
          </div>
        ) : (
          <div 
            className={`p-3 rounded-lg ${
              isCritical 
                ? "bg-red-50 border border-red-200 text-red-700" 
                : isWarning 
                  ? "bg-amber-50 border border-amber-200 text-amber-700"
                  : "bg-muted"
            }`}
          >
            <div className="flex items-center gap-2 text-sm">
              {isLimitReached || isCritical ? (
                <AlertTriangle className="h-4 w-4" />
              ) : null}
              <span>
                {isLimitReached 
                  ? `Campaign limit reached (${campaignLimit.current}/${campaignLimit.limit})`
                  : `Campaigns: ${campaignLimit.current}/${campaignLimit.limit} (${campaignLimit.percentage}%)`
                }
              </span>
            </div>
            {isLimitReached && (
              <p className="text-xs mt-1 text-red-600">
                Upgrade your plan to create more campaigns.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campaign Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Summer Sale 2024"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) {
                  setErrors(prev => ({ ...prev, name: "" }));
                }
              }}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name ? (
              <p className="text-xs text-red-500">{errors.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                2-100 characters
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your campaign goals and terms..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Commission Type */}
          <div className="space-y-2">
            <Label htmlFor="commissionType">Commission Type *</Label>
            <Select
              value={commissionType}
              onValueChange={(value) => setCommissionType(value as "percentage" | "flatFee")}
            >
              <SelectTrigger id="commissionType">
                <SelectValue placeholder="Select commission type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="flatFee">Flat Fee</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {commissionType === "percentage"
                ? "Affiliates earn a percentage of each sale"
                : "Affiliates earn a fixed amount per conversion (regardless of sale value)"}
            </p>
          </div>

          {/* Commission Rate */}
          <div className="space-y-2">
            <Label htmlFor="commissionRate">
              {commissionType === "percentage" ? "Commission Percentage" : "Commission Amount"} *
            </Label>
            <div className="relative">
              <Input
                id="commissionRate"
                type="number"
                placeholder={commissionType === "percentage" ? "10" : "100"}
                value={commissionRate}
                onChange={(e) => {
                  setCommissionRate(e.target.value);
                  if (errors.commissionRate) {
                    setErrors(prev => ({ ...prev, commissionRate: "" }));
                  }
                }}
                className={errors.commissionRate ? "border-red-500 pr-10" : "pr-10"}
                min={commissionType === "percentage" ? 1 : 0}
                max={commissionType === "percentage" ? 100 : undefined}
                step={commissionType === "percentage" ? 0.01 : 1}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                {commissionType === "percentage" ? "%" : "₱"}
              </span>
            </div>
            {errors.commissionRate ? (
              <p className="text-xs text-red-500">{errors.commissionRate}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {commissionType === "percentage" 
                  ? "Percentage of sale amount affiliates earn (1-100%)" 
                  : "Fixed PHP amount affiliates earn per conversion (₱0 - ₱10,000+)"}
              </p>
            )}
          </div>

          {/* Cookie Duration */}
          <div className="space-y-2">
            <Label htmlFor="cookieDuration">Cookie Duration (days)</Label>
            <Input
              id="cookieDuration"
              type="number"
              value={cookieDuration}
              onChange={(e) => {
                setCookieDuration(e.target.value);
                if (errors.cookieDuration) {
                  setErrors(prev => ({ ...prev, cookieDuration: "" }));
                }
              }}
              className={errors.cookieDuration ? "border-red-500" : ""}
            />
            {errors.cookieDuration ? (
              <p className="text-xs text-red-500">{errors.cookieDuration}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                How long to track referrals after a click (1-365 days)
              </p>
            )}
          </div>

          {/* Recurring Commissions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="recurringCommissions" className="cursor-pointer">
                Recurring Commissions
              </Label>
              <Switch
                id="recurringCommissions"
                checked={recurringCommissions}
                onCheckedChange={(checked) => {
                  setRecurringCommissions(checked);
                  if (!checked) {
                    setRecurringRateType("same");
                    setRecurringRate("");
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Earn commission on recurring subscriptions
            </p>
            
            {recurringCommissions && (
              <div className="space-y-3 pl-4 border-l-2 border-muted">
                {/* Rate Type Selector */}
                <div className="space-y-2">
                  <Label htmlFor="recurringRateType">Recurring Rate Type</Label>
                  <Select
                    value={recurringRateType}
                    onValueChange={(value: "same" | "reduced" | "custom") => {
                      setRecurringRateType(value);
                      if (value === "same") {
                        setRecurringRate("");
                      }
                    }}
                  >
                    <SelectTrigger id="recurringRateType">
                      <SelectValue placeholder="Select rate type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="same">Same as Initial</SelectItem>
                      <SelectItem value="reduced">Reduced Rate</SelectItem>
                      <SelectItem value="custom">Custom Rate</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {recurringRateType === "same" && "Recurring commission equals initial rate"}
                    {recurringRateType === "reduced" && "Recurring commission is reduced (default: 50% of initial)"}
                    {recurringRateType === "custom" && "Specify a custom recurring rate"}
                  </p>
                </div>

                {/* Rate Input - Only show for reduced or custom */}
                {(recurringRateType === "reduced" || recurringRateType === "custom") && (
                  <div className="space-y-2">
                    <Label htmlFor="recurringRate">
                      {recurringRateType === "reduced" ? "Reduced Rate (%)" : "Custom Rate (%)"}
                    </Label>
                    <div className="relative">
                      <Input
                        id="recurringRate"
                        type="number"
                        placeholder={recurringRateType === "reduced" ? "5" : "10"}
                        value={recurringRate}
                        onChange={(e) => {
                          setRecurringRate(e.target.value);
                          if (errors.recurringRate) {
                            setErrors(prev => ({ ...prev, recurringRate: "" }));
                          }
                        }}
                        className={errors.recurringRate ? "border-red-500 pr-8" : "pr-8"}
                        min={1}
                        max={100}
                        step={0.01}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                        %
                      </span>
                    </div>
                    {errors.recurringRate && (
                      <p className="text-xs text-red-500">{errors.recurringRate}</p>
                    )}
                    {recurringRateType === "reduced" && !errors.recurringRate && (
                      <p className="text-xs text-muted-foreground">
                        Default: {DEFAULT_REDUCED_RATE_PERCENTAGE}% of initial rate = {(Number(commissionRate) * (DEFAULT_REDUCED_RATE_PERCENTAGE / 100)).toFixed(1)}% (initial: {commissionRate}%)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Auto-approve */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="autoApproveCommissions" className="cursor-pointer">
                Auto-approve Commissions
              </Label>
              <Switch
                id="autoApproveCommissions"
                checked={autoApproveCommissions}
                onCheckedChange={setAutoApproveCommissions}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically approve commissions below threshold
            </p>
            
            {autoApproveCommissions && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <Label htmlFor="approvalThreshold">Approval Threshold (PHP)</Label>
                <Input
                  id="approvalThreshold"
                  type="number"
                  placeholder="500"
                  value={approvalThreshold}
                  onChange={(e) => {
                    setApprovalThreshold(e.target.value);
                    if (errors.approvalThreshold) {
                      setErrors(prev => ({ ...prev, approvalThreshold: "" }));
                    }
                  }}
                  className={errors.approvalThreshold ? "border-red-500" : ""}
                  min={0}
                  max={10000000}
                />
                {errors.approvalThreshold ? (
                  <p className="text-xs text-red-500">{errors.approvalThreshold}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Leave empty for "Auto-approve all" mode
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Commission Preview */}
          <CommissionPreview
            commissionType={commissionType}
            commissionRate={Number(commissionRate) || 0}
            recurringCommissions={recurringCommissions}
            recurringRateType={recurringRateType}
            recurringRate={recurringRate ? Number(recurringRate) : undefined}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || isLimitReached}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Campaign"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
