"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

interface CampaignComparisonSelectorProps {
  campaigns: Array<{ _id: string; name: string }>;
  selectedIds: [string, string, string]; // 3 slots, empty string = not selected
  onSelectionChange: (index: 0 | 1 | 2, campaignId: string) => void;
  onClear: () => void;
}

const slotLabels = ["Campaign 1", "Campaign 2", "Campaign 3 (optional)"] as const;

export function CampaignComparisonSelector({
  campaigns,
  selectedIds,
  onSelectionChange,
  onClear,
}: CampaignComparisonSelectorProps) {
  const hasAnySelection = selectedIds.some((id) => id !== "");

  // Filter out already-selected campaigns from the options for each slot
  const getOptionsForSlot = (slotIndex: number) => {
    const otherSelectedIds = new Set<string>();
    selectedIds.forEach((id, i) => {
      if (i !== slotIndex && id !== "") {
        otherSelectedIds.add(id);
      }
    });
    return campaigns.filter((c) => !otherSelectedIds.has(c._id));
  };

  const currentCampaign = (id: string) =>
    campaigns.find((c) => c._id === id);

  return (
    <FadeIn className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Compare Campaigns
        </p>
        {hasAnySelection && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="w-3.5 h-3.5 mr-1" />
            Clear comparison
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([0, 1, 2] as const).map((index) => (
          <div key={index} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {slotLabels[index]}
            </label>
            <Select
              value={selectedIds[index] || "__placeholder__"}
              onValueChange={(value) =>
                onSelectionChange(index, value === "__none__" ? "" : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    currentCampaign(selectedIds[index])?.name ??
                    "Select campaign"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {getOptionsForSlot(index).map((campaign) => (
                  <SelectItem key={campaign._id} value={campaign._id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </FadeIn>
  );
}
