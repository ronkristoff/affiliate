"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { CampaignCard } from "./CampaignCard";
import { CreateCampaignModal } from "./CreateCampaignModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Megaphone, Loader2, Eye, EyeOff } from "lucide-react";

export function CampaignList() {
  const [showArchived, setShowArchived] = useState(false);
  
  const campaigns = useQuery(api.campaigns.listCampaigns, { includeArchived: showArchived });
  const stats = useQuery(api.campaigns.getCampaignStats);

  if (campaigns === undefined || stats === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Campaigns are already filtered server-side based on showArchived toggle
  if (campaigns.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Megaphone className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
            Create your first affiliate campaign to start tracking referrals and earning commissions.
          </p>
          <CreateCampaignModal
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Campaign
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  // Check if there are only archived campaigns when not showing archived
  const hasActiveCampaigns = campaigns.some(c => c.status !== "archived");
  if (!showArchived && !hasActiveCampaigns) {
    return (
      <div className="space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Campaigns</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Paused</p>
              <p className="text-2xl font-bold text-amber-600">{stats.paused}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Archived</p>
              <p className="text-2xl font-bold text-gray-600">{stats.archived}</p>
            </CardContent>
          </Card>
        </div>

        {/* No Active Campaigns Message */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Megaphone className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No active campaigns</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              {stats.archived > 0 
                ? "You have archived campaigns. Toggle to view them."
                : "Create your first affiliate campaign to start tracking referrals and earning commissions."
              }
            </p>
            <CreateCampaignModal
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Campaign
                </Button>
              }
            />
          </CardContent>
        </Card>

        {/* Show Archived Toggle */}
        {stats.archived > 0 && (
          <div className="flex items-center justify-center gap-2">
            <Switch 
              id="showArchived" 
              checked={showArchived} 
              onCheckedChange={setShowArchived} 
            />
            <Label htmlFor="showArchived" className="text-sm text-muted-foreground cursor-pointer">
              Show Archived ({stats.archived})
            </Label>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Campaigns</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Paused</p>
            <p className="text-2xl font-bold text-amber-600">{stats.paused}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Archived</p>
            <p className="text-2xl font-bold text-gray-600">{stats.archived}</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign List */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Campaigns</h2>
        <div className="flex items-center gap-4">
          {stats.archived > 0 && (
            <div className="flex items-center gap-2">
              <Switch 
                id="showArchivedList" 
                checked={showArchived} 
                onCheckedChange={setShowArchived} 
              />
              <Label htmlFor="showArchivedList" className="text-sm text-muted-foreground cursor-pointer">
                Show Archived
              </Label>
            </div>
          )}
          <CreateCampaignModal
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Campaign
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign: any) => (
          <CampaignCard 
            key={campaign._id} 
            campaign={campaign}
          />
        ))}
      </div>
    </div>
  );
}
