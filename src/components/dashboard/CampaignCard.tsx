"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { cn, getSanitizedErrorMessage, reportClientError } from "@/lib/utils";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pencil,
  Pause,
  Play,
  Archive,
  EllipsisVertical,
  Users,
  ArrowRightLeft,
  Wallet,
  Clock,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

// ── Formatters ───────────────────────────────────────────────────────────────

function formatPeso(amount: number): string {
  if (amount >= 1_000_000) {
    return `₱${(amount / 1_000_000).toFixed(1)}m`;
  }
  if (amount >= 1_000) {
    return `₱${(amount / 1_000).toFixed(1)}k`;
  }
  return `₱${amount.toLocaleString()}`;
}

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Status Configuration ─────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active: {
    accentGradient: "linear-gradient(90deg, var(--success) 0%, #059669 100%)",
    badgeVariant: "success" as const,
    cardClass: "",
    dotClass: "bg-emerald-500",
  },
  paused: {
    accentGradient: "linear-gradient(90deg, var(--warning) 0%, #d97706 100%)",
    badgeVariant: "warning" as const,
    cardClass: "campaign-card--paused",
    dotClass: "bg-amber-500",
  },
  archived: {
    accentGradient: "linear-gradient(90deg, #9ca3af 0%, #6b7280 100%)",
    badgeVariant: "outline" as const,
    cardClass: "campaign-card--archived",
    dotClass: "bg-gray-400",
  },
} as const;

// ── Component ────────────────────────────────────────────────────────────────

export function CampaignCard({ campaign, stats, onUpdate }: CampaignCardProps) {
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<"pause" | "resume" | "archive" | null>(null);

  const pauseCampaign = useMutation(api.campaigns.pauseCampaign);
  const resumeCampaign = useMutation(api.campaigns.resumeCampaign);
  const archiveCampaign = useMutation(api.campaigns.archiveCampaign);

  // ── Status helpers ──

  const isActive = campaign.status === "active";
  const isPaused = campaign.status === "paused";
  const isArchived = campaign.status === "archived";
  const statusConfig = STATUS_CONFIG[campaign.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.archived;

  // ── Commission formatting ──

  const formatCommission = () => {
    if (campaign.commissionType === "percentage") {
      return `${campaign.commissionRate}%`;
    }
    return `₱${campaign.commissionRate.toLocaleString()}`;
  };

  const getCommissionLabel = () => {
    if (campaign.commissionType === "percentage") {
      return "per sale";
    }
    return "flat per referral";
  };

  const getTypeBadge = () => {
    if (campaign.commissionType === "percentage") {
      return "Percentage";
    }
    return "Flat Fee";
  };

  // ── Date formatting ──

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // ── Actions ──

  const handlePauseResume = () => {
    if (isActive) setShowPauseConfirm(true);
    else if (isPaused) setShowResumeConfirm(true);
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
      toast.error(getSanitizedErrorMessage(error, "Failed to pause campaign"))
      reportClientError({ source: "CampaignCard", message: getSanitizedErrorMessage(error, "Failed to pause campaign") });
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
      toast.error(getSanitizedErrorMessage(error, "Failed to resume campaign"));
      reportClientError({ source: "CampaignCard", message: getSanitizedErrorMessage(error, "Failed to resume campaign") });
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const handleArchive = () => setShowArchiveConfirm(true);

  const confirmArchive = async () => {
    try {
      setLoading(true);
      setActionType("archive");
      await archiveCampaign({ campaignId: campaign._id });
      toast.success("Campaign archived");
      setShowArchiveConfirm(false);
      onUpdate?.();
    } catch (error) {
      toast.error(getSanitizedErrorMessage(error, "Failed to archive campaign"))
      reportClientError({ source: "CampaignCard", message: getSanitizedErrorMessage(error, "Failed to archive campaign") });
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  return (
    <>
      <Link
        href={`/campaigns/${campaign._id}`}
        className={cn(
          "campaign-card group relative bg-[var(--bg-surface)] rounded-xl overflow-hidden",
          "border border-[var(--border-light)]",
          "transition-all duration-200 ease-out",
          "hover:shadow-lg hover:shadow-black/[0.06] hover:-translate-y-0.5",
          statusConfig.cardClass
        )}
      >
        <div className="p-5 flex flex-col gap-4">
          {/* ── Header: Name + Status ── */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-bold text-[var(--text-heading)] truncate tracking-[-0.01em] group-hover:text-[var(--brand-primary)] transition-colors">
                {campaign.name}
              </h3>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0 h-5 border-[var(--border)]">
                  {getTypeBadge()}
                </Badge>
                {campaign.recurringCommissions && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--brand-secondary)]">
                    <RefreshCw className="w-3 h-3" />
                    Recurring
                  </span>
                )}
                {campaign.autoApproveCommissions && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--success)]">
                    <CheckCircle2 className="w-3 h-3" />
                    Auto-approve
                  </span>
                )}
              </div>
            </div>
            <Badge variant={statusConfig.badgeVariant} className="shrink-0 text-[10px] font-bold px-2.5 py-0.5 h-6 gap-1">
              <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dotClass, isActive && "animate-pulse")} />
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </Badge>
          </div>

          {/* ── Commission Hero ── */}
          <div className="campaign-card-commission rounded-xl px-4 py-4 relative overflow-hidden">
            {/* Decorative gradient orb */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.07] bg-[var(--brand-primary)] blur-2xl" />

            <div className="relative z-10">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.12em] mb-1">
                Commission Rate
              </p>
              <p className="text-[28px] font-bold text-[var(--brand-primary)] leading-none tabular-nums tracking-tight">
                {formatCommission()}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                {getCommissionLabel()}
                {campaign.cookieDuration && (
                  <span className="inline-flex items-center gap-1 ml-2 text-[var(--brand-secondary)]">
                    <Clock className="w-3 h-3" />
                    {campaign.cookieDuration}d cookie
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-3 gap-0">
            <StatItem
              icon={<Users className="w-3.5 h-3.5" />}
              value={stats ? stats.affiliates.toLocaleString() : "—"}
              label="Affiliates"
            />
            <StatItem
              icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
              value={stats ? stats.conversions.toLocaleString() : "—"}
              label="Conversions"
            />
            <StatItem
              icon={<Wallet className="w-3.5 h-3.5" />}
              value={stats ? formatPeso(stats.paidOut) : "—"}
              label="Paid Out"
            />
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-light)]">
            <span className="text-[11px] text-[var(--text-muted)]">
              {formatDate(campaign._creationTime)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.preventDefault()}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-page)] hover:text-[var(--text-heading)] transition-colors"
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
        </div>
      </Link>

      {/* ── Confirmation Dialogs ── */}

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

// ── Stat Item Sub-component ──────────────────────────────────────────────────

function StatItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center text-center py-2 px-1 not-first:border-l not-first:border-[var(--border-light)]">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--bg-page)] text-[var(--text-muted)] mb-1.5">
        {icon}
      </div>
      <span className="text-[14px] font-bold text-[var(--text-heading)] tabular-nums leading-tight">
        {value}
      </span>
      <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-[0.06em] mt-0.5">
        {label}
      </span>
    </div>
  );
}
