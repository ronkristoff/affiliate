"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { 
  MoreHorizontal, 
  Pencil, 
  Pause, 
  Play, 
  Archive, 
  Trash2,
  Users,
  TrendingUp,
  DollarSign
} from "lucide-react";

interface Campaign {
  _id: Id<"campaigns">;
  _creationTime: number;
  tenantId: Id<"tenants">;
  name: string;
  description?: string;
  commissionType: "percentage" | "flatFee";
  commissionRate: number;
  cookieDuration?: number;
  recurringCommissions?: boolean;
  recurringRate?: number;
  autoApproveCommissions?: boolean;
  approvalThreshold?: number;
  status: string;
}

interface CampaignCardProps {
  campaign: Campaign;
  onUpdate?: () => void;
}

export function CampaignCard({ campaign, onUpdate }: CampaignCardProps) {
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<"pause" | "resume" | "archive" | null>(null);
  
  const pauseCampaign = useMutation(api.campaigns.pauseCampaign);
  const resumeCampaign = useMutation(api.campaigns.resumeCampaign);
  const archiveCampaign = useMutation(api.campaigns.archiveCampaign);

  const handlePauseResume = () => {
    // Show confirmation dialog without setting loading state
    if (campaign.status === "active") {
      setShowPauseConfirm(true);
    } else if (campaign.status === "paused") {
      setShowResumeConfirm(true);
    }
  };

  const confirmPause = async () => {
    try {
      setLoading(true);
      setActionType("pause");
      await pauseCampaign({ campaignId: campaign._id });
      toast.success("Campaign paused");
      setShowPauseConfirm(false);
      onUpdate?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to pause campaign";
      toast.error(message);
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const confirmResume = async () => {
    try {
      setLoading(true);
      setActionType("resume");
      await resumeCampaign({ campaignId: campaign._id });
      toast.success("Campaign resumed");
      setShowResumeConfirm(false);
      onUpdate?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resume campaign";
      toast.error(message);
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const handleArchive = () => {
    setShowArchiveConfirm(true);
  };

  const confirmArchive = async () => {
    try {
      setLoading(true);
      setActionType("archive");
      await archiveCampaign({ campaignId: campaign._id });
      toast.success("Campaign archived");
      setShowArchiveConfirm(false);
      onUpdate?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to archive campaign";
      toast.error(message);
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const getStatusBadge = () => {
    switch (campaign.status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
      case "paused":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Paused</Badge>;
      case "archived":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Archived</Badge>;
      default:
        return <Badge>{campaign.status}</Badge>;
    }
  };

  const getApprovalBadge = () => {
    // AC #2: Auto-approve all when autoApproveCommissions=true but no threshold set
    if (campaign.autoApproveCommissions) {
      if (campaign.approvalThreshold !== undefined && campaign.approvalThreshold !== null) {
        // AC #1: Show threshold value when set
        return (
          <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">
            Auto-approve &lt; ₱{campaign.approvalThreshold}
          </Badge>
        );
      }
      // AC #2: No threshold = auto-approve ALL commissions
      return (
        <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">
          Auto-approve all
        </Badge>
      );
    }
    // AC #3: autoApproveCommissions=false = manual review all
    return (
      <Badge variant="outline" className="text-xs border-amber-200 text-amber-700 bg-amber-50">
        Manual review all
      </Badge>
    );
  };

  const formatCommission = () => {
    if (campaign.commissionType === "percentage") {
      return `${campaign.commissionRate}%`;
    }
    return `₱${campaign.commissionRate}`;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Link 
              href={`/campaigns/${campaign._id}`}
              className="text-lg font-semibold hover:text-primary transition-colors"
            >
              {campaign.name}
            </Link>
            {campaign.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {campaign.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {getStatusBadge()}
            {getApprovalBadge()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3">
        <div className="grid grid-cols-2 gap-4">
          {/* Commission */}
          <div className="flex items-start gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Commission</p>
              <p className="font-medium">{formatCommission()}</p>
              <p className="text-xs text-muted-foreground">
                {campaign.commissionType === "percentage" ? "per sale" : "flat rate"}
              </p>
            </div>
          </div>

          {/* Cookie Duration */}
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Cookie Duration</p>
              <p className="font-medium">{campaign.cookieDuration || 30} days</p>
            </div>
          </div>

          {/* Recurring */}
          {campaign.recurringCommissions && (
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Recurring</p>
                <p className="font-medium">{campaign.recurringRate || 0}%</p>
              </div>
            </div>
          )}

          {/* Auto-approve */}
          {campaign.autoApproveCommissions && campaign.approvalThreshold && (
            <div className="flex items-start gap-2">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Auto-approve</p>
                <p className="font-medium">Up to ₱{campaign.approvalThreshold}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${campaign._id}`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </Link>
          
          {campaign.status !== "archived" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePauseResume}
            >
              {campaign.status === "active" ? (
                <>
                  <Pause className="h-3 w-3 mr-1" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Resume
                </>
              )}
            </Button>
          )}
        </div>

        {campaign.status !== "archived" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleArchive}
            className="text-muted-foreground hover:text-destructive"
          >
            <Archive className="h-3 w-3" />
          </Button>
        )}
      </CardFooter>

      {/* Pause Confirmation Dialog */}
      <AlertDialog open={showPauseConfirm} onOpenChange={setShowPauseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Pausing "{campaign.name}" will stop new commission generation. Existing pending commissions will be preserved. 
              You can resume the campaign at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPause} disabled={loading && actionType === "pause"}>
              {loading && actionType === "pause" ? "Pausing..." : "Pause Campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resume Confirmation Dialog */}
      <AlertDialog open={showResumeConfirm} onOpenChange={setShowResumeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Resuming "{campaign.name}" will allow new commission generation. 
              Existing pending commissions will be processed normally.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResume} disabled={loading && actionType === "resume"}>
              {loading && actionType === "resume" ? "Resuming..." : "Resume Campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-destructive">Warning: This action cannot be easily undone.</span>
              <br /><br />
              Archiving "{campaign.name}" will:
              <ul className="list-disc pl-4 mt-2 space-y-1">
                <li>Hide it from your active campaigns list</li>
                <li>Make referral links return 404 (visitors will see a not found page)</li>
                <li>Stop all commission tracking</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmArchive} 
              disabled={loading && actionType === "archive"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && actionType === "archive" ? "Archiving..." : "Archive Campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
