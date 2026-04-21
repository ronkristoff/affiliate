"use client";

import { useState, Suspense } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2, Users, Target, UserCircle, DollarSign, Globe,
  BarChart3, Headphones, Building2, Edit, Plus, Trash2, Check,
  Sparkles, Shield, Zap,
} from "lucide-react";
import { cn, getSanitizedErrorMessage, reportClientError } from "@/lib/utils";
import { EditTierConfigSheet } from "./EditTierConfigSheet";
import { CreateTierConfigSheet } from "./CreateTierConfigSheet";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

// ── Tier color system ─────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, {
  accent: string;
  accentLight: string;
  accentBorder: string;
  gradient: string;
  iconBg: string;
  iconColor: string;
  badge: string;
}> = {
  starter: {
    accent: "#6b7280",
    accentLight: "#f3f4f6",
    accentBorder: "#e5e7eb",
    gradient: "from-gray-500/5 to-gray-500/[0.02]",
    iconBg: "bg-gray-100",
    iconColor: "text-gray-600",
    badge: "bg-gray-100 text-gray-700",
  },
  growth: {
    accent: "#1fb5a5",
    accentLight: "#ecfdf5",
    accentBorder: "#a7f3d0",
    gradient: "from-[#1fb5a5]/8 to-[#1fb5a5]/[0.02]",
    iconBg: "bg-[#ecfdf5]",
    iconColor: "text-[#0d9488]",
    badge: "bg-[#ecfdf5] text-[#065f46]",
  },
  scale: {
    accent: "#8b5cf6",
    accentLight: "#f5f3ff",
    accentBorder: "#c4b5fd",
    gradient: "from-purple-500/8 to-purple-500/[0.02]",
    iconBg: "bg-[#f5f3ff]",
    iconColor: "text-purple-600",
    badge: "bg-[#f5f3ff] text-purple-700",
  },
};

function getTierStyle(tierName: string) {
  return TIER_STYLES[tierName] || {
    accent: "#10b981",
    accentLight: "#ecfdf5",
    accentBorder: "#a7f3d0",
    gradient: "from-emerald-500/8 to-emerald-500/[0.02]",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700",
  };
}

// ── Limit & feature field definitions ─────────────────────────────────────────

const LIMIT_FIELDS = [
  { key: "maxAffiliates", label: "Affiliates", icon: Users },
  { key: "maxCampaigns", label: "Campaigns", icon: Target },
  { key: "maxTeamMembers", label: "Team", icon: UserCircle },
  { key: "maxPayoutsPerMonth", label: "Payouts/mo", icon: DollarSign },
  { key: "maxApiCalls", label: "API Calls", icon: Globe },
] as const;

const FEATURE_FIELDS = [
  { key: "advancedAnalytics" as const, label: "Analytics", icon: BarChart3 },
  { key: "prioritySupport" as const, label: "Support", icon: Headphones },
] as const;

function formatLimit(value: number): string {
  if (value === -1) return "∞";
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
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
  const deleteMutation = useAction(api.tierConfigActions.deleteTierConfigWithStripe);

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
      toast.error(getSanitizedErrorMessage(error, "Failed to delete tier"));
      reportClientError({ source: "TierConfigClient", message: getSanitizedErrorMessage(error, "Failed to delete tier") });
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
              <div key={i} className="bg-[var(--bg-card)] rounded-2xl overflow-hidden shadow-sm">
                {/* Header skeleton */}
                <div className="p-6 pb-0">
                  <div className="flex items-center justify-between mb-4">
                    <Skeleton className="h-7 w-28 rounded-lg" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-10 w-32 mb-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
                {/* Divider */}
                <div className="mx-6 my-4 h-px bg-[var(--border)]" />
                {/* Limits skeleton */}
                <div className="px-6 pb-4">
                  <Skeleton className="h-3.5 w-14 mb-3 rounded" />
                  <div className="grid grid-cols-2 gap-2.5">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="bg-[var(--bg-page)] rounded-lg p-2.5">
                        <Skeleton className="h-3 w-10 mb-1 rounded" />
                        <Skeleton className="h-4 w-8 rounded" />
                      </div>
                    ))}
                    <div className="bg-[var(--bg-page)] rounded-lg p-2.5 col-span-2">
                      <Skeleton className="h-3 w-14 mb-1 rounded" />
                      <Skeleton className="h-4 w-10 rounded" />
                    </div>
                  </div>
                </div>
                {/* Divider */}
                <div className="mx-6 mb-4 h-px bg-[var(--border)]" />
                {/* Features skeleton */}
                <div className="px-6 pb-4">
                  <Skeleton className="h-3.5 w-16 mb-3 rounded" />
                  <div className="flex gap-2">
                    <Skeleton className="h-7 w-20 rounded-full" />
                    <Skeleton className="h-7 w-20 rounded-full" />
                  </div>
                </div>
                {/* Actions skeleton */}
                <div className="px-6 pb-6 flex gap-2.5">
                  <Skeleton className="h-9 flex-1 rounded-lg" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
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
        <PageTopbar
          description="Manage platform tier definitions, pricing, limits, and feature gates"
          actions={
            <Button size="sm" onClick={() => setShowCreateSheet(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tier
            </Button>
          }
        >
          <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
            Tier Configuration
          </h1>
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

  // Determine highlighted tier (middle one, like the marketing page)
  const highlightedIndex = tierConfigs.length <= 1 ? 0 : Math.floor(tierConfigs.length / 2);

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar
        description="Manage platform tier definitions, pricing, limits, and feature gates"
        actions={
          <Button size="sm" onClick={() => setShowCreateSheet(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tier
          </Button>
        }
      >
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          Tier Configuration
        </h1>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {tierConfigs.map((config, index) => {
                const style = getTierStyle(config.tier);
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={config._id}
                    className={cn(
                      "group relative bg-[var(--bg-card)] rounded-2xl overflow-hidden",
                      "transition-all duration-300",
                      isHighlighted
                        ? "shadow-lg shadow-[var(--brand-secondary)]/8 hover:shadow-xl hover:shadow-[var(--brand-secondary)]/12 hover:-translate-y-1"
                        : "shadow-sm hover:shadow-md hover:-translate-y-0.5"
                    )}
                  >
                    {/* Highlighted badge */}
                    {isHighlighted && (
                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-secondary)] to-[var(--brand-primary)]" />
                    )}

                    {/* ── Card body ─────────────────────────────────── */}
                    <div className={cn("p-6 bg-gradient-to-b", style.gradient, isHighlighted && "pt-7")}>
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: style.accentLight }}
                          >
                            {index === 0 && <Zap className="h-4 w-4" style={{ color: style.accent }} />}
                            {index === highlightedIndex && tierConfigs.length > 1 && <Sparkles className="h-4 w-4" style={{ color: style.accent }} />}
                            {index === tierConfigs.length - 1 && tierConfigs.length > 1 && <Shield className="h-4 w-4" style={{ color: style.accent }} />}
                            {index !== 0 && index !== highlightedIndex && index !== tierConfigs.length - 1 && <Zap className="h-4 w-4" style={{ color: style.accent }} />}
                            {tierConfigs.length <= 2 && index === 1 && <Sparkles className="h-4 w-4" style={{ color: style.accent }} />}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-[var(--text-heading)] leading-tight">
                              {config.tier.charAt(0).toUpperCase() + config.tier.slice(1)}
                            </h3>
                            <span className="text-xs text-[var(--text-muted)]">
                              {config.tenantCount} tenant{config.tenantCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        {isHighlighted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[var(--brand-primary)] text-white">
                            <Sparkles className="h-3 w-3" />
                            Popular
                          </span>
                        )}
                      </div>

                      {/* Price */}
                      <div className="mb-5">
                        {config.price === 0 ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-4xl font-extrabold text-[var(--text-heading)] tracking-tight">Free</span>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-medium text-[var(--text-muted)]">₱</span>
                            <span className="text-4xl font-extrabold text-[var(--text-heading)] tracking-tight">
                              {config.price.toLocaleString()}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-[var(--text-muted)] mt-0.5 block">per month</span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="mx-6 h-px bg-[var(--border)]" />

                    {/* ── Limits section ────────────────────────────── */}
                    <div className="px-6 py-5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-3 block">
                        Limits
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {LIMIT_FIELDS.map(({ key, label, icon: Icon }) => {
                          const value = config[key];
                          const isUnlimited = value === -1;
                          return (
                            <div
                              key={key}
                              className={cn(
                                "rounded-xl px-3 py-2.5",
                                "bg-[var(--bg-page)]/70",
                                "transition-colors duration-150",
                                key === "maxApiCalls" && "col-span-2"
                              )}
                            >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Icon className={cn("h-3 w-3", style.iconColor)} style={{ opacity: 0.7 }} />
                                <span className="text-[11px] text-[var(--text-muted)] font-medium">
                                  {label}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "text-sm font-bold",
                                  isUnlimited
                                    ? "text-[var(--brand-secondary)]"
                                    : "text-[var(--text-heading)]"
                                )}
                              >
                                {formatLimit(value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="mx-6 h-px bg-[var(--border)]" />

                    {/* ── Features section ───────────────────────────── */}
                    <div className="px-6 py-4">
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2.5 block">
                        Features
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {FEATURE_FIELDS.map(({ key, label, icon: Icon }) => {
                          const enabled = config.features[key];
                          return (
                            <div
                              key={key}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold",
                                "transition-colors duration-150",
                                enabled
                                  ? "text-[var(--success-text)]"
                                  : "text-[var(--text-muted)]/40 bg-[var(--bg-page)]/50"
                              )}
                              style={enabled ? { backgroundColor: "var(--success-bg)" } : undefined}
                            >
                              <Icon className="h-3 w-3" />
                              {label}
                              {enabled && <Check className="h-3 w-3 ml-0.5" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="mx-6 h-px bg-[var(--border)]" />

                    {/* ── Actions ────────────────────────────────────── */}
                    <div className="px-6 py-4 flex gap-2.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-lg"
                        onClick={() => setEditingTier(config)}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] border-[var(--danger)]/30 h-9 w-9 p-0 flex items-center justify-center"
                        onClick={() => setDeletingTier({ _id: config._id, tier: config.tier })}
                        disabled={config.tenantCount > 0}
                        title={config.tenantCount > 0 ? "Cannot delete: tenants are assigned to this tier" : "Delete tier"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
