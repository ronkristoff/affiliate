"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Target, UserCircle, DollarSign, Globe, BarChart3, Headphones, Building2, Edit, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditTierConfigModal } from "./EditTierConfigModal";
import { CreateTierConfigModal } from "./CreateTierConfigModal";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

// Tier badge color mapping
const TIER_COLORS: Record<string, { badge: string; border: string; headerBg: string }> = {
  starter: {
    badge: "bg-gray-100 text-gray-700 border-gray-200",
    border: "border-gray-200",
    headerBg: "bg-gray-50",
  },
  growth: {
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    border: "border-blue-200",
    headerBg: "bg-blue-50",
  },
  scale: {
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    border: "border-purple-200",
    headerBg: "bg-purple-50",
  },
};

// Dynamic color for custom tiers
function getTierColors(tierName: string) {
  return TIER_COLORS[tierName] || {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    border: "border-emerald-200",
    headerBg: "bg-emerald-50",
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

export function TierConfigClient() {
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingTier, setDeletingTier] = useState<{ _id: Id<"tierConfigs">; tier: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const tierConfigs = useQuery(api.admin.tier_configs.getAdminTierConfigs);
  const deleteMutation = useMutation(api.admin.tier_configs.deleteTierConfig);

  // Handle loading and error states
  if (tierConfigs === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tierConfigs.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-[#333333]">No tier configurations found</h2>
        <p className="text-sm text-[#6b7280] mt-1">
          Create your first tier to get started.
        </p>
        <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Tier
        </Button>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#333333]">Tier Configuration</h1>
          <p className="text-sm text-[#6b7280]">
            Manage platform tier definitions, pricing, limits, and feature gates
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tier
        </Button>
      </div>

      {/* Responsive card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tierConfigs.map((config) => {
          const colors = getTierColors(config.tier);

          return (
            <Card key={config._id} className={cn("overflow-hidden", colors.border)}>
              {/* Tier name header with badge */}
              <CardHeader className={cn("pb-0", colors.headerBg)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    <Badge className={cn("text-xs font-medium", colors.badge)} variant="outline">
                      {config.tier.charAt(0).toUpperCase() + config.tier.slice(1)}
                    </Badge>
                  </CardTitle>
                  {/* Tenant count per tier */}
                  <span className="text-xs text-muted-foreground">
                    {config.tenantCount} tenant{config.tenantCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Price */}
                <div className="text-center py-2">
                  <span className="text-3xl font-bold text-[#10409a]">
                    ₱{config.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>

                {/* Limits */}
                <div className="space-y-2">
                  {LIMIT_FIELDS.map(({ key, label, icon: Icon }) => {
                    const value = config[key];
                    return (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                          <span>{label}</span>
                        </div>
                        <span className={cn(
                          "font-medium",
                          value === -1 ? "text-green-600" : "text-[#333333]"
                        )}>
                          {formatLimit(value)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Feature gates */}
                <div className="border-t pt-3 space-y-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Features
                  </span>
                  {FEATURE_FIELDS.map(({ key, label, icon: Icon }) => {
                    const enabled = config.features[key];
                    return (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                          <span>{label}</span>
                        </div>
                        {enabled ? (
                          <span className="text-green-600 text-xs font-medium">Enabled</span>
                        ) : (
                          <span className="text-gray-400 text-xs">Disabled</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>

              {/* Edit & Delete buttons */}
              <CardFooter className="pt-0 gap-2">
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
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={() => setDeletingTier({ _id: config._id, tier: config.tier })}
                  disabled={config.tenantCount > 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingTier && (
        <EditTierConfigModal
          tierConfig={editingTier}
          onClose={() => setEditingTier(null)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTierConfigModal
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Delete Confirmation */}
      {deletingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg shadow-lg p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-semibold">Delete Tier</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the{" "}
              <strong>{deletingTier.tier.charAt(0).toUpperCase() + deletingTier.tier.slice(1)}</strong> tier?
              This action cannot be undone.
            </p>
            {deletingTier && (
              <div className="flex justify-end gap-2">
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
