"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { CommissionPreview } from "@/components/dashboard/CommissionPreview";
import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import { AffiliatesByCampaignTable } from "@/components/dashboard/AffiliatesByCampaignTable";
import { DEFAULT_REDUCED_RATE_PERCENTAGE, getRecurringRateDescription } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  Save,
  Pause,
  Play,
  Archive,
  DollarSign,
  Users,
  Zap,
  Settings,
  Copy,
  Check,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPeso(amount: number): string {
  if (amount >= 1_000_000) {
    return `₱${(amount / 1_000_000).toFixed(1)}m`;
  }
  if (amount >= 1_000) {
    return `₱${(amount / 1_000).toFixed(1)}k`;
  }
  return `₱${amount.toLocaleString()}`;
}

function StatusDot({ status }: { status: string }) {
  const config: Record<string, { dot: string; bg: string; text: string }> = {
    active: { dot: "bg-emerald-500", bg: "bg-emerald-100", text: "text-emerald-800" },
    paused: { dot: "bg-amber-500", bg: "bg-amber-100", text: "text-amber-800" },
    archived: { dot: "bg-gray-400", bg: "bg-gray-100", text: "text-gray-600" },
  };
  const c = config[status] ?? config.archived;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function CampaignDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Topbar skeleton */}
      <PageTopbar
        actions={
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        }
      >
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-48" />
        </div>
      </PageTopbar>

      {/* Content skeleton */}
      <div className="px-8 pt-6 pb-8 space-y-6">
        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-[#e5e7eb] rounded-xl p-5">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>

        {/* Info cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-[#e5e7eb] rounded-xl p-5">
              <Skeleton className="h-5 w-32 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e7eb]">
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Content ─────────────────────────────────────────────────────────────

function CampaignDetailContent() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const campaign = useQuery(api.campaigns.getCampaign, {
    campaignId: campaignId as Id<"campaigns">,
  });
  const allCardStats = useQuery(api.campaigns.getCampaignCardStats);
  const updateCampaign = useMutation(api.campaigns.updateCampaign);
  const pauseCampaign = useMutation(api.campaigns.pauseCampaign);
  const resumeCampaign = useMutation(api.campaigns.resumeCampaign);
  const archiveCampaign = useMutation(api.campaigns.archiveCampaign);

  // Per-campaign stats from the map
  const campaignStats = useMemo(() => {
    if (!allCardStats || !campaign) return null;
    return allCardStats[campaign._id as string] ?? null;
  }, [allCardStats, campaign]);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signupUrlCopied, setSignupUrlCopied] = useState(false);

  // Signup URL query
  const signupUrlData = useQuery(api.campaigns.getCampaignSignupUrl, {
    campaignId: campaignId as Id<"campaigns">,
  });

  // Confirmation dialogs
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionType, setActionType] = useState<"pause" | "resume" | "archive" | null>(null);

  // Edit form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [commissionType, setCommissionType] = useState<"percentage" | "flatFee">("percentage");
  const [commissionRate, setCommissionRate] = useState("");
  const [cookieDuration, setCookieDuration] = useState("");
  const [recurringCommissions, setRecurringCommissions] = useState(false);
  const [recurringRate, setRecurringRate] = useState("");
  const [recurringRateType, setRecurringRateType] = useState<"same" | "reduced" | "custom">("same");
  const [autoApproveCommissions, setAutoApproveCommissions] = useState(true);
  const [approvalThreshold, setApprovalThreshold] = useState("");

  // Form validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when campaign loads
  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setDescription(campaign.description || "");
      setCommissionType(campaign.commissionType as "percentage" | "flatFee");
      setCommissionRate(String(campaign.commissionRate));
      setCookieDuration(String(campaign.cookieDuration || 30));
      setRecurringCommissions(campaign.recurringCommissions || false);
      setRecurringRate(campaign.recurringRate ? String(campaign.recurringRate) : "");
      setRecurringRateType((campaign.recurringRateType || "same") as "same" | "reduced" | "custom");
      setAutoApproveCommissions(campaign.autoApproveCommissions ?? true);
      setApprovalThreshold(campaign.approvalThreshold ? String(campaign.approvalThreshold) : "");
    }
  }, [campaign]);

  // Handle recurring rate type changes - calculate default reduced rate
  useEffect(() => {
    if (recurringCommissions && recurringRateType === "reduced") {
      const initialRate = Number(commissionRate) || 0;
      const reducedRate =
        Math.round(initialRate * (DEFAULT_REDUCED_RATE_PERCENTAGE / 100) * 100) / 100;
      if (reducedRate > 0 && !recurringRate) {
        setRecurringRate(String(reducedRate));
      }
    }
  }, [recurringRateType, recurringCommissions, commissionRate]);

  if (campaign === undefined) {
    return <CampaignDetailSkeleton />;
  }

  if (campaign === null) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)]">
        <PageTopbar>
          <Link
            href="/campaigns"
            className="text-[13px] text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Campaigns
          </Link>
        </PageTopbar>
        <div className="px-8 pt-6 pb-8">
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-12 text-center">
            <p className="text-[15px] font-semibold text-[var(--text-heading)] mb-2">
              Campaign not found
            </p>
            <p className="text-[13px] text-[var(--text-muted)] mb-4">
              The campaign you&apos;re looking for doesn&apos;t exist.
            </p>
            <Button size="sm" asChild>
              <Link href="/campaigns">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Campaigns
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form validation ──────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Campaign name is required";
    } else if (name.trim().length < 2) {
      newErrors.name = "Campaign name must be at least 2 characters";
    } else if (name.trim().length > 100) {
      newErrors.name = "Campaign name must be less than 100 characters";
    }

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

    if (cookieDuration) {
      const duration = Number(cookieDuration);
      if (isNaN(duration)) {
        newErrors.cookieDuration = "Cookie duration must be a number";
      } else if (duration < 1 || duration > 365) {
        newErrors.cookieDuration = "Cookie duration must be between 1 and 365 days";
      }
    }

    if (recurringCommissions && recurringRateType !== "same" && recurringRate) {
      const rate = Number(recurringRate);
      if (isNaN(rate)) {
        newErrors.recurringRate = "Recurring rate must be a number";
      } else if (rate < 1 || rate > 100) {
        newErrors.recurringRate = "Recurring rate must be between 1 and 100";
      }
    }

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

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      await updateCampaign({
        campaignId: campaign._id,
        name,
        description: description || undefined,
        commissionType,
        commissionRate: Number(commissionRate),
        cookieDuration: Number(cookieDuration),
        recurringCommissions,
        recurringRate:
          recurringCommissions && recurringRate && recurringRateType !== "same"
            ? Number(recurringRate)
            : undefined,
        recurringRateType: recurringCommissions ? recurringRateType : undefined,
        autoApproveCommissions,
        approvalThreshold: approvalThreshold ? Number(approvalThreshold) : undefined,
      });
      toast.success("Campaign updated successfully");
      setIsEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update campaign";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handlePauseResume = () => {
    if (campaign.status === "active") {
      setShowPauseConfirm(true);
    } else if (campaign.status === "paused") {
      setShowResumeConfirm(true);
    }
  };

  const confirmPause = async () => {
    setActionLoading(true);
    setActionType("pause");
    try {
      await pauseCampaign({ campaignId: campaign._id });
      toast.success("Campaign paused");
      setShowPauseConfirm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to pause campaign";
      toast.error(message);
    } finally {
      setActionLoading(false);
      setActionType(null);
    }
  };

  const confirmResume = async () => {
    setActionLoading(true);
    setActionType("resume");
    try {
      await resumeCampaign({ campaignId: campaign._id });
      toast.success("Campaign resumed");
      setShowResumeConfirm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resume campaign";
      toast.error(message);
    } finally {
      setActionLoading(false);
      setActionType(null);
    }
  };

  const confirmArchive = async () => {
    setActionLoading(true);
    setActionType("archive");
    try {
      await archiveCampaign({ campaignId: campaign._id });
      toast.success("Campaign archived");
      setShowArchiveConfirm(false);
      router.push("/campaigns");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to archive campaign";
      toast.error(message);
    } finally {
      setActionLoading(false);
      setActionType(null);
    }
  };

  // ── Computed values for view mode ──────────────────────────────────────

  const formatCommission = () => {
    if (campaign.commissionType === "percentage") {
      return `${campaign.commissionRate}%`;
    }
    return `₱${campaign.commissionRate.toLocaleString()}`;
  };

  const getCommissionSub = () => {
    if (campaign.commissionType === "percentage") {
      return "per sale";
    }
    return "flat fee per referral";
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* ── Sticky Top Bar ───────────────────────────────────────────────── */}
      <PageTopbar
        description="Manage campaign details, track performance, and monitor affiliate enrollments"
        actions={
          campaign.status !== "archived" ? (
            <>
              <Button
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-1.5 bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-secondary)]"
              >
                <Settings className="w-3.5 h-3.5" />
                Edit
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePauseResume}
                className="gap-1.5 border-[#d1d5db] text-[#4b5563] hover:bg-gray-50 hover:text-[#1f2937]"
              >
                {campaign.status === "active" ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Resume
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchiveConfirm(true)}
                className="gap-1.5 text-[#9ca3af] hover:text-destructive hover:bg-red-50"
              >
                <Archive className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <span className="text-[12px] font-medium text-[var(--text-muted)] px-2.5 py-1 rounded-full bg-gray-100">
              Archived
            </span>
          )
        }
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/campaigns"
            className="text-[13px] text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Campaigns
          </Link>
          <span className="text-[13px] text-[var(--text-muted)]">/</span>
          <span className="text-[15px] font-semibold text-[var(--text-heading)] truncate max-w-[280px]">
            {campaign.name}
          </span>
          <StatusDot status={campaign.status} />
        </div>
      </PageTopbar>

      {/* ── Page Content ─────────────────────────────────────────────────── */}
      <div className="px-8 pt-6 pb-8 space-y-6">
        {/* ── Campaign Stats Bar ─────────────────────────────────────────── */}
        <FadeIn className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Affiliates"
            numericValue={campaignStats?.affiliates ?? 0}
            variant="blue"
            isLoading={!campaignStats}
            icon={<Users className="w-4 h-4" />}
          />
          <MetricCard
            label="Conversions"
            numericValue={campaignStats?.conversions ?? 0}
            variant="yellow"
            isLoading={!campaignStats}
            icon={<Zap className="w-4 h-4" />}
          />
          <MetricCard
            label="Paid Out"
            numericValue={campaignStats?.paidOut ?? 0}
            formatValue={formatPeso}
            variant="green"
            isLoading={!campaignStats}
            icon={<DollarSign className="w-4 h-4" />}
          />
        </FadeIn>

        {/* ── Campaign Details — compact horizontal bar ───────────────────── */}
        <div className="bg-white border border-[#e5e7eb] rounded-xl px-5 py-3.5">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Commission */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-[#1c2260] tabular-nums">
                {formatCommission()}
              </span>
              <span className="text-[12px] text-[var(--text-muted)]">
                {getCommissionSub()}
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-[#e5e7eb]" />

            {/* Recurring */}
            {campaign.recurringCommissions && campaign.recurringRateType !== "same" && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-[var(--text-muted)]">Recurring:</span>
                  <span className="text-[12px] font-semibold text-[#1a1a1a]">
                    {getRecurringRateDescription(
                      campaign.recurringRateType as "same" | "reduced" | "custom",
                      campaign.recurringRate,
                      campaign.commissionRate
                    )}
                  </span>
                </div>
                <div className="w-px h-4 bg-[#e5e7eb]" />
              </>
            )}

            {/* Cookie */}
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[var(--text-muted)]">Cookie:</span>
              <span className="text-[12px] font-semibold text-[#1a1a1a]">
                {campaign.cookieDuration || 30} days
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-[#e5e7eb]" />

            {/* Approval */}
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[var(--text-muted)]">Approval:</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  campaign.autoApproveCommissions
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {campaign.autoApproveCommissions ? "Auto" : "Manual"}
              </span>
              {campaign.autoApproveCommissions && campaign.approvalThreshold && (
                <span className="text-[12px] text-[var(--text-muted)]">
                  (₱{campaign.approvalThreshold.toLocaleString()})
                </span>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Signup URL Copy */}
            {signupUrlData && (
              <div className="flex items-center gap-2">
                <div className="max-w-[280px] sm:max-w-[350px] lg:max-w-[450px] bg-gray-50 border border-[#e5e7eb] rounded-md px-2.5 py-1.5 text-[11px] text-gray-600 font-mono truncate">
                  {signupUrlData.signupUrl}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(signupUrlData.signupUrl);
                      setSignupUrlCopied(true);
                      toast.success("Link copied!");
                      setTimeout(() => setSignupUrlCopied(false), 2000);
                    } catch {
                      toast.error("Failed to copy");
                    }
                  }}
                  className="h-7 px-2.5 gap-1"
                >
                  {signupUrlCopied ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Description (if present) - below the compact bar */}
          {campaign.description && (
            <div className="mt-3 pt-3 border-t border-[#f3f4f6]">
              <p className="text-[13px] text-[var(--text-body)] leading-relaxed">
                {campaign.description}
              </p>
            </div>
          )}
        </div>

        {/* ── Affiliates Table ───────────────────────────────────────────── */}
        {/* Added top spacing (mt-8) for better section rhythm */}
        <div className="mt-8">
          <AffiliatesByCampaignTable
            campaignId={campaign._id}
            campaignName={campaign.name}
          />
        </div>
      </div>

      {/* ── Edit Campaign Sheet (Side Drawer) ─────────────────────────────── */}
      <Sheet open={isEditing} onOpenChange={setIsEditing}>
        <SheetContent
          side="right"
          className="sm:max-w-lg w-full flex flex-col p-0 overflow-hidden"
        >
          <SheetHeader className="px-6 pt-6 pb-0 flex-shrink-0">
            <SheetTitle className="text-[17px] font-bold text-[#1a1a1a]">
              Edit Campaign
            </SheetTitle>
            <SheetDescription className="text-[13px] text-[var(--text-muted)]">
              Update your campaign configuration
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-[13px] font-medium text-[var(--text-heading)]">
                Campaign Name <span className="text-[var(--danger)]">*</span>
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                }}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name ? (
                <p className="text-[11px] text-red-500">{errors.name}</p>
              ) : (
                <p className="text-[11px] text-[var(--text-muted)]">2-100 characters</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-description" className="text-[13px] font-medium text-[var(--text-heading)]">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Divider */}
            <div className="border-t border-[#e5e7eb]" />

            {/* Commission Type */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-commissionType" className="text-[13px] font-medium text-[var(--text-heading)]">
                Commission Type
              </Label>
              <Select
                value={commissionType}
                onValueChange={(value: "percentage" | "flatFee") => {
                  const newType = value;
                  setCommissionType(newType);
                  if (newType === "percentage") {
                    const currentRate = Number(commissionRate);
                    if (!commissionRate || currentRate > 100) {
                      setCommissionRate("10");
                    }
                  }
                  if (newType === "flatFee") {
                    const currentRate = Number(commissionRate);
                    if (!commissionRate || currentRate < 0) {
                      setCommissionRate("50");
                    }
                  }
                  if (errors.commissionRate) {
                    setErrors((prev) => ({ ...prev, commissionRate: "" }));
                  }
                }}
              >
                <SelectTrigger id="edit-commissionType" className="w-full">
                  <SelectValue placeholder="Select commission type" />
                </SelectTrigger>
                <SelectContent className="w-[240px]">
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="flatFee">Flat Fee</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-[var(--text-muted)]">
                {commissionType === "percentage"
                  ? "Affiliates earn a percentage of each sale"
                  : "Affiliates earn a fixed amount per conversion (regardless of sale value)"}
              </p>
            </div>

            {/* Commission Rate */}
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-commissionRate"
                className="text-[13px] font-medium text-[var(--text-heading)]"
              >
                {commissionType === "percentage"
                  ? "Commission Percentage"
                  : "Commission Amount"}{" "}
                <span className="text-[var(--danger)]">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="edit-commissionRate"
                  type="number"
                  value={commissionRate}
                  onChange={(e) => {
                    setCommissionRate(e.target.value);
                    if (errors.commissionRate) {
                      setErrors((prev) => ({ ...prev, commissionRate: "" }));
                    }
                  }}
                  className={errors.commissionRate ? "border-red-500 pr-10" : "pr-10"}
                  min={commissionType === "percentage" ? 1 : 0}
                  max={commissionType === "percentage" ? 100 : undefined}
                  step={commissionType === "percentage" ? 0.01 : 1}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[13px] pointer-events-none">
                  {commissionType === "percentage" ? "%" : "₱"}
                </span>
              </div>
              {errors.commissionRate ? (
                <p className="text-[11px] text-red-500">{errors.commissionRate}</p>
              ) : (
                <p className="text-[11px] text-[var(--text-muted)]">
                  {commissionType === "percentage"
                    ? "Percentage of sale amount affiliates earn (1-100%)"
                    : "Fixed PHP amount affiliates earn per conversion (₱0 - ₱10,000+)"}
                </p>
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

            {/* Cookie Duration */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-cookieDuration" className="text-[13px] font-medium text-[var(--text-heading)]">
                Cookie Duration (days)
              </Label>
              <Input
                id="edit-cookieDuration"
                type="number"
                value={cookieDuration}
                onChange={(e) => {
                  setCookieDuration(e.target.value);
                  if (errors.cookieDuration) {
                    setErrors((prev) => ({ ...prev, cookieDuration: "" }));
                  }
                }}
                className={errors.cookieDuration ? "border-red-500" : ""}
                min={1}
                max={365}
              />
              {errors.cookieDuration ? (
                <p className="text-[11px] text-red-500">{errors.cookieDuration}</p>
              ) : (
                <p className="text-[11px] text-[var(--text-muted)]">
                  How long to track referrals after a click (1-365 days)
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-[#e5e7eb]" />

            {/* Recurring Commissions Toggle */}
            <div className="flex items-center justify-between">
              <Label
                htmlFor="edit-recurringCommissions"
                className="text-[13px] font-medium text-[var(--text-heading)]"
              >
                Recurring Commissions
              </Label>
              <Switch
                id="edit-recurringCommissions"
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

            {recurringCommissions && (
              <div className="space-y-4 pl-4 border-l-2 border-[var(--brand-light)]">
                {/* Rate Type Selector */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-recurringRateType"
                    className="text-[13px] font-medium text-[var(--text-heading)]"
                  >
                    Recurring Rate Type
                  </Label>
                  <Select
                    value={recurringRateType}
                    onValueChange={(value: "same" | "reduced" | "custom") => {
                      setRecurringRateType(value);
                      if (value === "same") {
                        setRecurringRate("");
                      }
                    }}
                  >
                    <SelectTrigger id="edit-recurringRateType">
                      <SelectValue placeholder="Select rate type" />
                    </SelectTrigger>
                    <SelectContent className="w-[240px]">
                      <SelectItem value="same">Same as Initial</SelectItem>
                      <SelectItem value="reduced">Reduced Rate</SelectItem>
                      <SelectItem value="custom">Custom Rate</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {recurringRateType === "same" &&
                      "Recurring commission equals initial rate"}
                    {recurringRateType === "reduced" &&
                      "Recurring commission is reduced (default: 50% of initial)"}
                    {recurringRateType === "custom" &&
                      "Specify a custom recurring rate"}
                  </p>
                </div>

                {/* Rate Input - Only show for reduced or custom */}
                {(recurringRateType === "reduced" || recurringRateType === "custom") && (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="edit-recurringRate"
                      className="text-[13px] font-medium text-[var(--text-heading)]"
                    >
                      {recurringRateType === "reduced"
                        ? "Reduced Rate (%)"
                        : "Custom Rate (%)"}
                    </Label>
                    <div className="relative">
                      <Input
                        id="edit-recurringRate"
                        type="number"
                        placeholder={recurringRateType === "reduced" ? "5" : "10"}
                        value={recurringRate}
                        onChange={(e) => {
                          setRecurringRate(e.target.value);
                          if (errors.recurringRate) {
                            setErrors((prev) => ({ ...prev, recurringRate: "" }));
                          }
                        }}
                        className={errors.recurringRate ? "border-red-500 pr-8" : "pr-8"}
                        min={1}
                        max={100}
                        step={0.01}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[13px] pointer-events-none">
                        %
                      </span>
                    </div>
                    {errors.recurringRate && (
                      <p className="text-[11px] text-red-500">{errors.recurringRate}</p>
                    )}
                    {recurringRateType === "reduced" && !errors.recurringRate && (
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Default: {DEFAULT_REDUCED_RATE_PERCENTAGE}% of initial rate ={" "}
                        {(Number(commissionRate) * (DEFAULT_REDUCED_RATE_PERCENTAGE / 100)).toFixed(
                          1
                        )}
                        % (initial: {commissionRate}%)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[#e5e7eb]" />

            {/* Auto-approve Toggle */}
            <div className="flex items-center justify-between">
              <Label
                htmlFor="edit-autoApproveCommissions"
                className="text-[13px] font-medium text-[var(--text-heading)]"
              >
                Auto-approve Commissions
              </Label>
              <Switch
                id="edit-autoApproveCommissions"
                checked={autoApproveCommissions}
                onCheckedChange={setAutoApproveCommissions}
              />
            </div>

            {autoApproveCommissions && (
              <div className="space-y-1.5 pl-4 border-l-2 border-[var(--brand-light)]">
                <Label
                  htmlFor="edit-approvalThreshold"
                  className="text-[13px] font-medium text-[var(--text-heading)]"
                >
                  Approval Threshold (PHP)
                </Label>
                <Input
                  id="edit-approvalThreshold"
                  type="number"
                  value={approvalThreshold}
                  onChange={(e) => {
                    setApprovalThreshold(e.target.value);
                    if (errors.approvalThreshold) {
                      setErrors((prev) => ({ ...prev, approvalThreshold: "" }));
                    }
                  }}
                  className={errors.approvalThreshold ? "border-red-500" : ""}
                  min={0}
                  max={10000000}
                />
                {errors.approvalThreshold ? (
                  <p className="text-[11px] text-red-500">{errors.approvalThreshold}</p>
                ) : (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Leave empty for &quot;Auto-approve all&quot; mode
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sticky footer with Save / Cancel */}
          <SheetFooter className="px-6 py-4 border-t border-[#e5e7eb] flex-shrink-0 flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-secondary)]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}

      {/* Pause Confirmation Dialog */}
      <AlertDialog open={showPauseConfirm} onOpenChange={setShowPauseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Pausing this campaign will stop new commission generation. Existing pending
              commissions will be preserved. You can resume the campaign at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPause}
              disabled={actionLoading && actionType === "pause"}
            >
              {actionLoading && actionType === "pause" ? "Pausing..." : "Pause Campaign"}
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
              Resuming this campaign will allow new commission generation. Existing pending
              commissions will be processed normally.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmResume}
              disabled={actionLoading && actionType === "resume"}
            >
              {actionLoading && actionType === "resume" ? "Resuming..." : "Resume Campaign"}
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
              Archiving this campaign will:
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
              disabled={actionLoading && actionType === "archive"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading && actionType === "archive" ? "Archiving..." : "Archive Campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Page Export (with Suspense) ────────────────────────────────────────────────

export default function CampaignDetailPage() {
  return (
    <Suspense fallback={<CampaignDetailSkeleton />}>
      <CampaignDetailContent />
    </Suspense>
  );
}
