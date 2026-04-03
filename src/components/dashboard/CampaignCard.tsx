"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pencil, Pause, Play, Archive, EllipsisVertical } from "lucide-react";

function formatPeso(amount: number): string {
  if (amount >= 1_000_000) {
    return `₱${(amount / 1_000_000).toFixed(1)}m`;
  }
  if (amount >= 1_000) {
    return `₱${(amount / 1_000).toFixed(1)}k`;
  }
  return `₱${amount.toLocaleString()}`;
}

interface Campaign {
  _id: Id<"campaigns">;
  _creationTime: number;
  tenantId: Id<"tenants">;
  name: string;
  description?: string;
  commissionType: string;
  commissionRate: number;
  cookieDuration?: number;
  recurringCommissions?: boolean;
  recurringRate?: number;
  recurringRateType?: string;
  autoApproveCommissions?: boolean;
  approvalThreshold?: number;
  status: string;
}

interface CampaignStats {
  affiliates: number;
  conversions: number;
  paidOut: number;
}

interface CampaignCardProps {
  campaign: Campaign;
  stats?: CampaignStats;
  onUpdate?: () => void;
}

export function CampaignCard({ campaign, stats, onUpdate }: CampaignCardProps) {
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<"pause" | "resume" | "archive" | null>(null);

  const pauseCampaign = useMutation(api.campaigns.pauseCampaign);
  const resumeCampaign = useMutation(api.campaigns.resumeCampaign);
  const archiveCampaign = useMutation(api.campaigns.archiveCampaign);

  const handlePauseResume = () => {
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

  const formatCommission = () => {
    if (campaign.commissionType === "percentage") {
      return `${campaign.commissionRate}%`;
    }
    return `₱${campaign.commissionRate.toLocaleString()}`;
  };

  const getCommissionSub = () => {
    if (campaign.commissionType === "percentage") {
      const recurring = campaign.recurringCommissions ? " · recurring" : "";
      return `per sale${recurring}`;
    }
    return "flat fee per referral · one-time";
  };

  const getTypeLabel = () => {
    if (campaign.commissionType === "percentage") {
      return `Recurring % — all plans`;
    }
    return "Flat fee";
  };

  const isActive = campaign.status === "active";
  const isPaused = campaign.status === "paused";
  const isArchived = campaign.status === "archived";

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      <Link
        href={`/campaigns/${campaign._id}`}
        className={`bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3.5 transition-shadow cursor-pointer hover:shadow-md ${
          isArchived ? "opacity-65" : ""
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span
              className="text-[15px] font-bold text-gray-800 hover:text-primary transition-colors"
            >
              {campaign.name}
            </span>
            <div className="text-xs text-gray-500 mt-0.5">{getTypeLabel()}</div>
          </div>
          {isActive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          )}
          {isPaused && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Paused
            </span>
          )}
          {isArchived && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Archived
            </span>
          )}
        </div>

        {/* Commission Rate */}
        <div className="bg-blue-50 rounded-lg px-3.5 py-3">
          <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
            Commission Rate
          </div>
          <div className="text-[22px] font-bold text-[#1c2260] mt-0.5 tabular-nums">
            {formatCommission()}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{getCommissionSub()}</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-base font-bold text-gray-800 tabular-nums">
              {stats ? stats.affiliates.toLocaleString() : "—"}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">
              Affiliates
            </div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-gray-800 tabular-nums">
              {stats ? stats.conversions.toLocaleString() : "—"}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">
              Conversions
            </div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-gray-800 tabular-nums">
              {stats ? formatPeso(stats.paidOut) : "—"}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">
              Paid Out
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
          <div className="text-[11px] text-gray-500">
            Created {formatDate(campaign._creationTime)}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.preventDefault()}
                className="w-7 h-7 rounded-md border border-gray-200 bg-transparent flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors text-sm"
                aria-label="Campaign actions"
              >
                <EllipsisVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={(e) => e.preventDefault()}
                className="gap-2 cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                Edit details
              </DropdownMenuItem>
              {!isArchived && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    handlePauseResume();
                  }}
                  disabled={loading && actionType === "pause"}
                  className="gap-2 cursor-pointer"
                >
                  {isActive ? (
                    <>
                      <Pause className="w-4 h-4" />
                      Pause campaign
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Resume campaign
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {!isArchived && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    handleArchive();
                  }}
                  disabled={loading && actionType === "archive"}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <Archive className="w-4 h-4" />
                  Archive campaign
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Link>

      {/* Pause Confirmation Dialog */}
      <AlertDialog open={showPauseConfirm} onOpenChange={setShowPauseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Pausing &quot;{campaign.name}&quot; will stop new commission generation. Existing
              pending commissions will be preserved. You can resume the campaign at any time.
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
              Resuming &quot;{campaign.name}&quot; will allow new commission generation. Existing
              pending commissions will be processed normally.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmResume}
              disabled={loading && actionType === "resume"}
            >
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
              <span className="font-medium text-destructive">
                Warning: This action cannot be easily undone.
              </span>
              <br />
              <br />
              Archiving &quot;{campaign.name}&quot; will:
              <ul className="list-disc pl-4 mt-2 space-y-1">
                <li>Hide it from your active campaigns list</li>
                <li>Make referral links return 404</li>
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
    </>
  );
}
