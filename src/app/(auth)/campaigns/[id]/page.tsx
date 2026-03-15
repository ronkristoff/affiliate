"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { CommissionPreview } from "@/components/dashboard/CommissionPreview";
import { DEFAULT_REDUCED_RATE_PERCENTAGE, getRecurringRateDescription } from "@/lib/utils";
import { 
  ArrowLeft, 
  Loader2, 
  Save, 
  Pause, 
  Play, 
  Archive,
  DollarSign,
  TrendingUp,
  Calendar,
  Settings
} from "lucide-react";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  
  const campaign = useQuery(api.campaigns.getCampaign, { campaignId: campaignId as Id<"campaigns"> });
  const updateCampaign = useMutation(api.campaigns.updateCampaign);
  const pauseCampaign = useMutation(api.campaigns.pauseCampaign);
  const resumeCampaign = useMutation(api.campaigns.resumeCampaign);
  const archiveCampaign = useMutation(api.campaigns.archiveCampaign);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

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
      // Calculate default reduced percentage of initial commission rate
      const initialRate = Number(commissionRate) || 0;
      const reducedRate = Math.round(initialRate * (DEFAULT_REDUCED_RATE_PERCENTAGE / 100) * 100) / 100;
      if (reducedRate > 0 && !recurringRate) {
        setRecurringRate(String(reducedRate));
      }
    }
  }, [recurringRateType, recurringCommissions, commissionRate]);

  if (campaign === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (campaign === null) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Campaign not found</h2>
          <p className="text-muted-foreground mt-2">The campaign you're looking for doesn't exist.</p>
          <Link href="/campaigns">
            <Button className="mt-4">Back to Campaigns</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Form validation function
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = "Campaign name is required";
    } else if (name.trim().length < 2) {
      newErrors.name = "Campaign name must be at least 2 characters";
    } else if (name.trim().length > 100) {
      newErrors.name = "Campaign name must be less than 100 characters";
    }

    // Validate commission rate
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

    // Validate cookie duration
    if (cookieDuration) {
      const duration = Number(cookieDuration);
      if (isNaN(duration)) {
        newErrors.cookieDuration = "Cookie duration must be a number";
      } else if (duration < 1 || duration > 365) {
        newErrors.cookieDuration = "Cookie duration must be between 1 and 365 days";
      }
    }

    // Validate recurring rate
    if (recurringCommissions && recurringRateType !== "same" && recurringRate) {
      const rate = Number(recurringRate);
      if (isNaN(rate)) {
        newErrors.recurringRate = "Recurring rate must be a number";
      } else if (rate < 1 || rate > 100) {
        newErrors.recurringRate = "Recurring rate must be between 1 and 100";
      }
    }

    // Validate approval threshold
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

  const handleSave = async () => {
    // Frontend validation
    if (!validateForm()) {
      return;
    }

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
        recurringRate: recurringCommissions && recurringRate && recurringRateType !== "same" ? Number(recurringRate) : undefined,
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

  const handleArchive = () => {
    setShowArchiveConfirm(true);
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

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              {getStatusBadge()}
            </div>
            {campaign.description && (
              <p className="text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing && campaign.status !== "archived" && (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" onClick={handlePauseResume}>
                {campaign.status === "active" ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Campaign Details */}
      {isEditing ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
              <CardDescription>Update your campaign configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) {
                      setErrors((prev) => ({ ...prev, name: "" }));
                    }
                  }}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name ? (
                  <p className="text-xs text-red-500">{errors.name}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">2-100 characters</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commissionType">Commission Type</Label>
                <Select
                  value={commissionType}
                  onValueChange={(value: "percentage" | "flatFee") => {
                    const newType = value;
                    setCommissionType(newType);
                    // When switching to percentage, set default to 10% (AC #5)
                    if (newType === "percentage") {
                      const currentRate = Number(commissionRate);
                      if (!commissionRate || currentRate > 100) {
                        setCommissionRate("10");
                      }
                    }
                    // When switching to flat fee, set default to ₱50 (AC #1)
                    if (newType === "flatFee") {
                      const currentRate = Number(commissionRate);
                      if (!commissionRate || currentRate < 0) {
                        setCommissionRate("50");
                      }
                    }
                    // Clear validation errors when switching types
                    if (errors.commissionRate) {
                      setErrors((prev) => ({ ...prev, commissionRate: "" }));
                    }
                  }}
                >
                  <SelectTrigger id="commissionType">
                    <SelectValue placeholder="Select commission type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="flatFee">Flat Fee</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {commissionType === "percentage"
                    ? "Affiliates earn a percentage of each sale"
                    : "Affiliates earn a fixed amount per conversion (regardless of sale value)"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commissionRate">
                  {commissionType === "percentage" ? "Commission Percentage" : "Commission Amount"} *
                </Label>
                <div className="relative">
                  <Input
                    id="commissionRate"
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
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                    {commissionType === "percentage" ? "%" : "₱"}
                  </span>
                </div>
                {errors.commissionRate ? (
                  <p className="text-xs text-red-500">{errors.commissionRate}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
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

              <div className="space-y-2">
                <Label htmlFor="cookieDuration">Cookie Duration (days)</Label>
                <Input
                  id="cookieDuration"
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
                  <p className="text-xs text-red-500">{errors.cookieDuration}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    How long to track referrals after a click (1-365 days)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Configure recurring commissions and approval rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="recurringCommissions">Recurring Commissions</Label>
                <Switch
                  id="recurringCommissions"
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
                <div className="space-y-3 pl-4 border-l-2 border-muted">
                  {/* Rate Type Selector */}
                  <div className="space-y-2">
                    <Label htmlFor="recurringRateType">Recurring Rate Type</Label>
                    <Select
                      value={recurringRateType}
                      onValueChange={(value: "same" | "reduced" | "custom") => {
                        setRecurringRateType(value);
                        if (value === "same") {
                          setRecurringRate("");
                        }
                      }}
                    >
                      <SelectTrigger id="recurringRateType">
                        <SelectValue placeholder="Select rate type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same">Same as Initial</SelectItem>
                        <SelectItem value="reduced">Reduced Rate</SelectItem>
                        <SelectItem value="custom">Custom Rate</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {recurringRateType === "same" && "Recurring commission equals initial rate"}
                      {recurringRateType === "reduced" && "Recurring commission is reduced (default: 50% of initial)"}
                      {recurringRateType === "custom" && "Specify a custom recurring rate"}
                    </p>
                  </div>

                  {/* Rate Input - Only show for reduced or custom */}
                  {(recurringRateType === "reduced" || recurringRateType === "custom") && (
                    <div className="space-y-2">
                      <Label htmlFor="recurringRate">
                        {recurringRateType === "reduced" ? "Reduced Rate (%)" : "Custom Rate (%)"}
                      </Label>
                      <div className="relative">
                        <Input
                          id="recurringRate"
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
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                          %
                        </span>
                      </div>
                      {errors.recurringRate && (
                        <p className="text-xs text-red-500">{errors.recurringRate}</p>
                      )}
                      {recurringRateType === "reduced" && !errors.recurringRate && (
                        <p className="text-xs text-muted-foreground">
                          Default: {DEFAULT_REDUCED_RATE_PERCENTAGE}% of initial rate = {(Number(commissionRate) * (DEFAULT_REDUCED_RATE_PERCENTAGE / 100)).toFixed(1)}% (initial: {commissionRate}%)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="autoApproveCommissions">Auto-approve Commissions</Label>
                <Switch
                  id="autoApproveCommissions"
                  checked={autoApproveCommissions}
                  onCheckedChange={setAutoApproveCommissions}
                />
              </div>

              {autoApproveCommissions && (
                <div className="space-y-2 pl-4 border-l-2">
                  <Label htmlFor="approvalThreshold">Approval Threshold (PHP)</Label>
                  <Input
                    id="approvalThreshold"
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
                    <p className="text-xs text-red-500">{errors.approvalThreshold}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Leave empty for "Auto-approve all" mode
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Commission Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Commission
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{campaign.commissionType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rate</p>
                  <p className="font-medium">
                    {campaign.commissionType === "percentage" 
                      ? `${campaign.commissionRate}%` 
                      : `₱${campaign.commissionRate.toFixed(2)}`
                    }
                  </p>
                </div>
                {campaign.recurringCommissions && (
                  <div>
                    <p className="text-sm text-muted-foreground">Recurring Rate</p>
                    <p className="font-medium">
                      {getRecurringRateDescription(
                        (campaign.recurringRateType ?? "same") as "same" | "reduced" | "custom",
                        campaign.recurringRate,
                        campaign.commissionRate
                      )}
                    </p>
                    {campaign.recurringRateType && campaign.recurringRateType !== "same" && campaign.recurringRate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Stored rate: {campaign.recurringRate}% ({campaign.recurringRateType})
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tracking Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cookie Duration</p>
                  <p className="font-medium">{campaign.cookieDuration || 30} days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approval Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Auto-approve</p>
                  <p className="font-medium">{campaign.autoApproveCommissions ? "Enabled" : "Disabled"}</p>
                </div>
                {campaign.autoApproveCommissions && campaign.approvalThreshold && (
                  <div>
                    <p className="text-sm text-muted-foreground">Threshold</p>
                    <p className="font-medium">₱{campaign.approvalThreshold}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pause Confirmation Dialog */}
      <AlertDialog open={showPauseConfirm} onOpenChange={setShowPauseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Pausing this campaign will stop new commission generation. Existing pending commissions will be preserved.
              You can resume the campaign at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPause} disabled={actionLoading && actionType === "pause"}>
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
              Resuming this campaign will allow new commission generation.
              Existing pending commissions will be processed normally.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResume} disabled={actionLoading && actionType === "resume"}>
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
              <span className="font-medium text-destructive">Warning: This action cannot be easily undone.</span>
              <br /><br />
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
