"use client";

import { useState, useEffect } from "react";
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
import { getErrorMessage } from "@/lib/utils";
import { Loader2, Percent, PhilippinePeso } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";

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

// Zod schema
const overrideSchema = z.object({
  campaignId: z.string().min(1, "Please select a campaign"),
  rate: z.string().min(1, "Please enter a rate").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Rate must be 0 or greater",
  }),
});

type OverrideFormData = z.infer<typeof overrideSchema>;

export function SetOverrideDialog({
  affiliateId,
  open,
  onOpenChange,
  preselectedCampaignId,
  existingOverride,
}: SetOverrideDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OverrideFormData>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      campaignId: preselectedCampaignId?.toString() || existingOverride?.campaignId?.toString() || "",
      rate: existingOverride?.rate?.toString() || "",
    },
  });

  const { register, watch, setValue, formState: { errors }, reset } = form;

  const campaigns = useQuery(api.campaigns.listCampaigns, {
    includeArchived: false,
  });

  const setOverride = useMutation(api.affiliates.setCommissionOverride);

  const campaignId = watch("campaignId");
  const selectedCampaign = campaigns?.find(
    (c) => c._id === campaignId
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        campaignId: preselectedCampaignId?.toString() || existingOverride?.campaignId?.toString() || "",
        rate: existingOverride?.rate?.toString() || "",
      });
    }
  }, [open, preselectedCampaignId, existingOverride, reset]);

  const onSubmit = async (data: OverrideFormData) => {
    // Validate rate based on campaign type
    const rateValue = Number(data.rate);
    if (selectedCampaign && selectedCampaign.commissionType === "percentage" && rateValue > 100) {
      toast.error("Percentage rate cannot exceed 100%");
      return;
    }

    setIsSubmitting(true);

    try {
      await setOverride({
        affiliateId,
        campaignId: data.campaignId as Id<"campaigns">,
        rate: rateValue,
      });

      toast.success(
        existingOverride
          ? "Commission override updated successfully"
          : "Commission override set successfully"
      );

      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to set commission override"));
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
    const rateValue = parseFloat(watch("rate"));
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
        <form onSubmit={form.handleSubmit(onSubmit)}>
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
                  value={campaignId}
                  onValueChange={(value) => setValue("campaignId", value)}
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
              {errors.campaignId && (
                <p className="text-xs text-rose-500">{errors.campaignId.message}</p>
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
                  {...register("rate")}
                  placeholder={getPlaceholder()}
                  disabled={isSubmitting}
                  className={`pr-10 ${errors.rate ? "border-rose-500" : ""}`}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {getRateSuffix()}
                </div>
              </div>
              {errors.rate && (
                <p className="text-xs text-rose-500">{errors.rate.message}</p>
              )}
              {selectedCampaign && !errors.rate && (
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
            <Button type="submit" disabled={isSubmitting || !campaignId || !watch("rate")}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existingOverride ? "Update Override" : "Set Override"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
