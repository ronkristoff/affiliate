"use client";

import { useState, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Users, Target, UserCircle, DollarSign, Globe, BarChart3, Headphones, Building2, Edit, Plus, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditTierConfigSheet } from "./EditTierConfigSheet";
import { CreateTierConfigSheet } from "./CreateTierConfigSheet";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

// Tier badge color mapping
const TIER_COLORS: Record<string, { badge: string; border: string; headerBg: string; accent: string }> = {
  starter: {
    badge: "bg-gray-100 text-gray-700 border-gray-200",
    border: "border-gray-200",
    headerBg: "bg-gray-50",
    accent: "bg-gray-200",
  },
  growth: {
    badge: "bg-[var(--brand-light)] text-[var(--brand-primary)] border-[var(--brand-secondary)]/30",
    border: "border-[var(--brand-secondary)]/30",
    headerBg: "bg-[var(--brand-light)]",
    accent: "bg-[var(--brand-secondary)]",
  },
  scale: {
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    border: "border-purple-200",
    headerBg: "bg-purple-50",
    accent: "bg-purple-500",
  },
};

// Dynamic color for custom tiers
function getTierColors(tierName: string) {
  return TIER_COLORS[tierName] || {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    border: "border-emerald-200",
    headerBg: "bg-emerald-50",
    accent: "bg-emerald-500",
  };
}

// Limit display labels and icons
const LIMIT_FIELDS = [
  { key: "maxAffiliates", label: "Max Affiliates", icon: Users },
  { key: "maxCampaigns", label: "Max Campaigns", icon: Target },
  { key: "maxTeamMembers", label: "Max Team Members", icon: UserCircle },
  { key: "maxPayoutsPerMonth", label: "Max Payouts/Month", icon: DollarSign },
  { key: "maxApiCalls", label: "Max API Calls", icon: Globe },
] as const;

// Feature gate display (customDomain removed)
const FEATURE_FIELDS = [
  { key: "advancedAnalytics" as const, label: "Advanced Analytics", icon: BarChart3 },
  { key: "prioritySupport" as const, label: "Priority Support", icon: Headphones },
] as const;

function formatLimit(value: number): string {
  if (value === -1) return "Unlimited";
  return value.toLocaleString();
}

// ---------------------------------------------------------------------------
// Content component (hooks live here, wrapped by Suspense)
// ---------------------------------------------------------------------------

function TierConfigContent() {
  const [editingTier, setEditingTier] = useState<{
    _id: string;
    tier: string;
    price: number;
    maxAffiliates: number;
    maxCampaigns: number;
    maxTeamMembers: number;
    maxPayoutsPerMonth: number;
    maxApiCalls: number;
    features: {
      customDomain: boolean;
      advancedAnalytics: boolean;
      prioritySupport: boolean;
    };
  } | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [deletingTier, setDeletingTier] = useState<{ _id: Id<"tierConfigs">; tier: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const tierConfigs = useQuery(api.admin.tier_configs.getAdminTierConfigs);
  const deleteMutation = useMutation(api.admin.tier_configs.deleteTierConfig);

  const isLoading = tierConfigs === undefined;

  const handleDelete = async (tierConfigId: Id<"tierConfigs">, tierName: string) => {
    setIsDeleting(true);
    try {
      const result = await deleteMutation({ tierConfigId });
      if (result.success) {
        toast.success(`${tierName.charAt(0).toUpperCase() + tierName.slice(1)} tier deleted successfully`);
        setDeletingTier(null);
      } else {
        toast.error(
          `Cannot delete: ${result.affectedTenants} tenant${result.affectedTenants !== 1 ? "s are" : " is"} currently on this tier. Reassign them first.`
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete tier");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)]">
        <PageTopbar description="Manage platform tier definitions, pricing, limits, and feature gates">
          <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
            Tier Configuration
          </h1>
        </PageTopbar>
        <div className="px-8 pt-6 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="p-5 border-b border-[var(--border)]">
                  <Skeleton className="h-6 w-24 mb-2" />
                  <Skeleton className="h-8 w-20" />
                </div>
                <div className="p-5 space-y-3">
                  {[...Array(5)].map((_, j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
                <div className="p-5 border-t border-[var(--border)] flex gap-2">
                  <Skeleton className="h-9 flex-1" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (tierConfigs.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)]">
        <PageTopbar description="Manage platform tier definitions, pricing, limits, and feature gates">
          <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
            Tier Configuration
          </h1>
          <Button size="sm" onClick={() => setShowCreateSheet(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tier
          </Button>
        </PageTopbar>
        <div className="px-8 pt-6 pb-8">
          <FadeIn>
            <div className="empty-state bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[var(--text-heading)]">
                No tier configurations found
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Create your first tier to get started.
              </p>
              <Button className="mt-4" onClick={() => setShowCreateSheet(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Tier
              </Button>
            </div>
          </FadeIn>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar description="Manage platform tier definitions, pricing, limits, and feature gates">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          Tier Configuration
        </h1>
        <Button size="sm" onClick={() => setShowCreateSheet(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tier
        </Button>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        <div className="space-y-6">
          {/* Tier count summary */}
          <FadeIn delay={0}>
            <p className="text-sm text-[var(--text-muted)]">
              {tierConfigs.length} tier{tierConfigs.length !== 1 ? "s" : ""} configured
            </p>
          </FadeIn>

          {/* Responsive card grid */}
          <FadeIn delay={80}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tierConfigs.map((config) => {
                const colors = getTierColors(config.tier);

                return (
                  <div
                    key={config._id}
                    className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden card-hover"
                  >
                    {/* Tier name header with badge */}
                    <div className={cn("px-5 py-4 border-b border-[var(--border)]", colors.headerBg)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-2.5 w-2.5 rounded-full", colors.accent)} />
                          <span className={cn(
                            "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                            colors.badge
                          )}>
                            {config.tier.charAt(0).toUpperCase() + config.tier.slice(1)}
                          </span>
                        </div>
                        {/* Tenant count per tier */}
                        <span className="text-xs text-[var(--text-muted)]">
                          {config.tenantCount} tenant{config.tenantCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="px-5 pt-5 pb-4 text-center border-b border-[var(--border)]">
                      <span className="text-3xl font-bold text-[var(--brand-primary)]">
                        ₱{config.price.toLocaleString()}
                      </span>
                      <span className="text-sm text-[var(--text-muted)]">/month</span>
                    </div>

                    {/* Limits */}
                    <div className="px-5 py-4 space-y-2.5">
                      {LIMIT_FIELDS.map(({ key, label, icon: Icon }) => {
                        const value = config[key];
                        return (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                              <Icon className="h-3.5 w-3.5" />
                              <span>{label}</span>
                            </div>
                            <span className={cn(
                              "font-medium",
                              value === -1 ? "text-[var(--success)]" : "text-[var(--text-heading)]"
                            )}>
                              {formatLimit(value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Feature gates */}
                    <div className="px-5 py-4 border-t border-[var(--border)] space-y-2.5">
                      <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        Features
                      </span>
                      {FEATURE_FIELDS.map(({ key, label, icon: Icon }) => {
                        const enabled = config.features[key];
                        return (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                              <Icon className="h-3.5 w-3.5" />
                              <span>{label}</span>
                            </div>
                            {enabled ? (
                              <span className="badge-success">
                                <Check className="h-3 w-3" />
                                Enabled
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)]/50 text-xs">Disabled</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Edit & Delete buttons */}
                    <div className="px-5 py-4 border-t border-[var(--border)] flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setEditingTier(config)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] border-[var(--danger)]/30"
                        onClick={() => setDeletingTier({ _id: config._id, tier: config.tier })}
                        disabled={config.tenantCount > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Edit Sheet */}
      {editingTier && (
        <EditTierConfigSheet
          tierConfig={editingTier}
          onClose={() => setEditingTier(null)}
        />
      )}

      {/* Create Sheet */}
      {showCreateSheet && (
        <CreateTierConfigSheet
          onClose={() => setShowCreateSheet(false)}
        />
      )}

      {/* Delete Confirmation */}
      {deletingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--bg-card)] rounded-xl shadow-lg p-6 max-w-sm w-full space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--danger-bg)] flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-[var(--danger)]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-heading)]">Delete Tier</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-body)]">
              Are you sure you want to delete the{" "}
              <strong className="text-[var(--text-heading)]">{deletingTier.tier.charAt(0).toUpperCase() + deletingTier.tier.slice(1)}</strong> tier?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingTier(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deletingTier._id, deletingTier.tier)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export (wrapped in Suspense)
// ---------------------------------------------------------------------------

export function TierConfigClient() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TierConfigContent />
    </Suspense>
  );
}
