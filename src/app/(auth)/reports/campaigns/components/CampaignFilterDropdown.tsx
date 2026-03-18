"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Filter } from "lucide-react";

interface Campaign {
  _id: Id<"campaigns">;
  name: string;
  status: string;
}

interface CampaignFilterDropdownProps {
  selectedCampaignId?: string;
  onCampaignSelect: (campaignId?: string) => void;
  className?: string;
}

export function CampaignFilterDropdown({
  selectedCampaignId,
  onCampaignSelect,
  className,
}: CampaignFilterDropdownProps) {
  // Fetch campaigns for the current user's tenant
  const campaigns = useQuery(
    api.campaigns.listCampaigns,
    {}
  );

  const [selectedValue, setSelectedValue] = useState<string>("all");

  useEffect(() => {
    if (selectedCampaignId) {
      setSelectedValue(selectedCampaignId);
    } else {
      setSelectedValue("all");
    }
  }, [selectedCampaignId]);

  const handleSelect = (campaignId: string | undefined) => {
    setSelectedValue(campaignId ?? "all");
    onCampaignSelect(campaignId);
  };

  const selectedCampaign = campaigns?.find((c) => c._id === selectedValue);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("gap-2 min-w-[180px] justify-between", className)}
        >
          <span className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            {selectedValue === "all"
              ? "All Campaigns"
              : selectedCampaign?.name ?? "Select Campaign"}
          </span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto">
        <DropdownMenuItem
          onClick={() => handleSelect(undefined)}
          className={cn(
            "cursor-pointer",
            selectedValue === "all" && "bg-accent"
          )}
        >
          All Campaigns
        </DropdownMenuItem>
        {campaigns?.map((campaign) => (
          <DropdownMenuItem
            key={campaign._id}
            onClick={() => handleSelect(campaign._id)}
            className={cn(
              "cursor-pointer flex items-center justify-between",
              selectedValue === campaign._id && "bg-accent"
            )}
          >
            <span className="truncate">{campaign.name}</span>
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded ml-2",
                campaign.status === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : campaign.status === "paused"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-700"
              )}
            >
              {campaign.status}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
