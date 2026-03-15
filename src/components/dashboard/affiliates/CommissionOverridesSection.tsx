"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Percent,
  PhilippinePeso,
} from "lucide-react";
import { SetOverrideDialog } from "./SetOverrideDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CommissionOverridesSectionProps {
  affiliateId: Id<"affiliates">;
}

export function CommissionOverridesSection({
  affiliateId,
}: CommissionOverridesSectionProps) {
  const [isSetDialogOpen, setIsSetDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState<{
    campaignId: Id<"campaigns">;
    campaignName: string;
    rate: number;
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const affiliate = useQuery(api.affiliates.getAffiliateWithOverrides, {
    affiliateId,
  });
  const campaigns = useQuery(api.campaigns.listCampaigns, {
    includeArchived: false,
  });

  const removeOverride = useMutation(api.affiliates.removeCommissionOverride);

  const handleEditOverride = (override: {
    campaignId: Id<"campaigns">;
    campaignName: string;
    overrideRate: number;
  }) => {
    setSelectedOverride({
      campaignId: override.campaignId,
      campaignName: override.campaignName,
      rate: override.overrideRate,
    });
    setIsSetDialogOpen(true);
  };

  const handleRemoveClick = (override: {
    campaignId: Id<"campaigns">;
    campaignName: string;
    overrideRate: number;
  }) => {
    setSelectedOverride({
      campaignId: override.campaignId,
      campaignName: override.campaignName,
      rate: override.overrideRate,
    });
    setIsRemoveDialogOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!selectedOverride) return;

    setIsRemoving(true);
    try {
      await removeOverride({
        affiliateId,
        campaignId: selectedOverride.campaignId,
      });
      toast.success("Commission override removed successfully");
      setIsRemoveDialogOpen(false);
      setSelectedOverride(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove commission override"
      );
    } finally {
      setIsRemoving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            Active
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            Paused
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRateDisplay = (
    type: "percentage" | "flatFee",
    rate: number
  ) => {
    if (type === "percentage") {
      return (
        <span className="flex items-center gap-1">
          {rate}%
          <Percent className="h-3 w-3 text-muted-foreground" />
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1">
        <PhilippinePeso className="h-3 w-3 text-muted-foreground" />
        {rate}
      </span>
    );
  };

  // Get campaigns that don't have overrides yet (for the "Add" button)
  const campaignsWithoutOverrides =
    campaigns?.filter(
      (campaign) =>
        campaign.status === "active" &&
        !affiliate?.commissionOverrides?.some(
          (o) => o.campaignId === campaign._id
        )
    ) || [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Commission Overrides</CardTitle>
          {campaignsWithoutOverrides.length > 0 && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedOverride(null);
                setIsSetDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Override
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!affiliate ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : affiliate.commissionOverrides.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">
                No commission overrides set for this affiliate.
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                They will use the default rates for all campaigns.
              </p>
              {campaignsWithoutOverrides.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSelectedOverride(null);
                    setIsSetDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Override
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Default Rate</TableHead>
                  <TableHead>Override Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliate.commissionOverrides.map((override) => (
                  <TableRow key={override.campaignId}>
                    <TableCell className="font-medium">
                      {override.campaignName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getRateDisplay(
                        override.commissionType,
                        override.defaultRate
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {getRateDisplay(
                        override.commissionType,
                        override.overrideRate
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(override.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditOverride(override)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveClick(override)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Set/Edit Override Dialog */}
      <SetOverrideDialog
        affiliateId={affiliateId}
        open={isSetDialogOpen}
        onOpenChange={setIsSetDialogOpen}
        preselectedCampaignId={
          selectedOverride?.campaignId as Id<"campaigns">
        }
        existingOverride={
          selectedOverride
            ? {
                campaignId: selectedOverride.campaignId,
                rate: selectedOverride.rate,
              }
            : undefined
        }
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Commission Override</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the commission override for{" "}
              <strong>{selectedOverride?.campaignName}</strong>? This affiliate
              will revert to using the default campaign rate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
