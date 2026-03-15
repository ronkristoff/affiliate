"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Percent, PhilippinePeso } from "lucide-react";

interface SetOverrideDialogProps {
  affiliateId: Id<"affiliates">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCampaignId?: Id<"campaigns">;
  existingOverride?: {
    campaignId: Id<"campaigns">;
    rate: number;
  };
}

export function SetOverrideDialog({
  affiliateId,
  open,
  onOpenChange,
  preselectedCampaignId,
  existingOverride,
}: SetOverrideDialogProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    preselectedCampaignId || existingOverride?.campaignId || ""
  );
  const [rate, setRate] = useState<string>(
    existingOverride?.rate?.toString() || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const campaigns = useQuery(api.campaigns.listCampaigns, {
    includeArchived: false,
  });

  const setOverride = useMutation(api.affiliates.setCommissionOverride);

  const selectedCampaign = campaigns?.find(
    (c) => c._id === selectedCampaignId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCampaignId) {
      toast.error("Please select a campaign");
      return;
    }

    const rateValue = parseFloat(rate);
    if (isNaN(rateValue) || rateValue < 0) {
      toast.error("Please enter a valid rate");
      return;
    }

    // Validate rate based on campaign type
    if (selectedCampaign) {
      if (selectedCampaign.commissionType === "percentage" && rateValue > 100) {
        toast.error("Percentage rate cannot exceed 100%");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await setOverride({
        affiliateId,
        campaignId: selectedCampaignId as Id<"campaigns">,
        rate: rateValue,
      });

      toast.success(
        existingOverride
          ? "Commission override updated successfully"
          : "Commission override set successfully"
      );

      // Reset and close
      if (!existingOverride) {
        setSelectedCampaignId("");
        setRate("");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to set commission override"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRateSuffix = () => {
    if (!selectedCampaign) return null;
    return selectedCampaign.commissionType === "percentage" ? (
      <Percent className="h-4 w-4 text-muted-foreground" />
    ) : (
      <PhilippinePeso className="h-4 w-4 text-muted-foreground" />
    );
  };

  const getRateLabel = () => {
    if (!selectedCampaign) return "Rate";
    return selectedCampaign.commissionType === "percentage"
      ? "Commission Rate (%)"
      : "Commission Rate (₱)";
  };

  const getPlaceholder = () => {
    if (!selectedCampaign) return "Enter rate";
    return selectedCampaign.commissionType === "percentage"
      ? `e.g., ${selectedCampaign.commissionRate}% (default)`
      : `e.g., ₱${selectedCampaign.commissionRate} (default)`;
  };

  // Calculate preview commission (example on ₱1000 sale)
  const getPreviewCommission = () => {
    const rateValue = parseFloat(rate);
    if (isNaN(rateValue) || !selectedCampaign) return null;

    const exampleAmount = 1000;
    if (selectedCampaign.commissionType === "percentage") {
      return (exampleAmount * (rateValue / 100)).toFixed(2);
    }
    return rateValue.toFixed(2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {existingOverride
                ? "Update Commission Override"
                : "Set Commission Override"}
            </DialogTitle>
            <DialogDescription>
              {existingOverride
                ? "Update the custom commission rate for this affiliate on the selected campaign."
                : "Set a custom commission rate for this affiliate on a specific campaign."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Campaign Selector */}
            <div className="grid gap-2">
              <Label htmlFor="campaign">Campaign</Label>
              {preselectedCampaignId || existingOverride ? (
                <Input
                  value={selectedCampaign?.name || "Loading..."}
                  disabled
                  className="bg-muted"
                />
              ) : (
                <Select
                  value={selectedCampaignId}
                  onValueChange={setSelectedCampaignId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns?.map((campaign) => (
                      <SelectItem key={campaign._id} value={campaign._id}>
                        {campaign.name} (
                        {campaign.commissionType === "percentage"
                          ? `${campaign.commissionRate}%`
                          : `₱${campaign.commissionRate}`}
                        )
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Rate Input */}
            <div className="grid gap-2">
              <Label htmlFor="rate">{getRateLabel()}</Label>
              <div className="relative">
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedCampaign?.commissionType === "percentage" ? 100 : undefined}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder={getPlaceholder()}
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {getRateSuffix()}
                </div>
              </div>
              {selectedCampaign && (
                <p className="text-xs text-muted-foreground">
                  Default rate: {selectedCampaign.commissionType === "percentage" ? `${selectedCampaign.commissionRate}%` : `₱${selectedCampaign.commissionRate}`}
                </p>
              )}
            </div>

            {/* Preview */}
            {getPreviewCommission() && selectedCampaign && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm font-medium">Preview</p>
                <p className="text-sm text-muted-foreground">
                  On a ₱1,000 sale, this affiliate would earn: {" "}
                  <span className="font-semibold text-foreground">
                    ₱{getPreviewCommission()}
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedCampaignId || !rate}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existingOverride ? "Update Override" : "Set Override"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
