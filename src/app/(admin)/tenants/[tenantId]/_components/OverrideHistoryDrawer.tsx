"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, History, Loader2, XCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverrideHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: Id<"tenants">;
}

interface OverrideRecord {
  _id: string;
  adminName: string;
  adminEmail: string;
  overrides: {
    maxAffiliates?: number;
    maxCampaigns?: number;
    maxTeamMembers?: number;
    maxPayoutsPerMonth?: number;
  };
  reason: string;
  expiresAt?: number;
  createdAt: number;
  removedAt?: number;
  removedBy?: string;
  removalReason?: string;
  status: "active" | "expired" | "removed";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-0 text-xs">
          Active
        </Badge>
      );
    case "expired":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0 text-xs">
          <Clock className="mr-1 h-3 w-3" />
          Expired
        </Badge>
      );
    case "removed":
      return (
        <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 border-0 text-xs">
          <XCircle className="mr-1 h-3 w-3" />
          Removed
        </Badge>
      );
    default:
      return null;
  }
}

function getOverrideSummary(overrides: OverrideRecord["overrides"]): string {
  const parts: string[] = [];
  if (overrides.maxAffiliates !== undefined) parts.push(`Affiliates: ${overrides.maxAffiliates}`);
  if (overrides.maxCampaigns !== undefined) parts.push(`Campaigns: ${overrides.maxCampaigns}`);
  if (overrides.maxTeamMembers !== undefined) parts.push(`Team: ${overrides.maxTeamMembers}`);
  if (overrides.maxPayoutsPerMonth !== undefined) parts.push(`Payouts: ${overrides.maxPayoutsPerMonth}`);
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// OverrideHistoryDrawer Component
// ---------------------------------------------------------------------------

export function OverrideHistoryDrawer({
  open,
  onOpenChange,
  tenantId,
}: OverrideHistoryDrawerProps) {
  const history = useQuery(api.admin.tier_overrides.getTierOverrideHistory, {
    tenantId,
    limit: 50,
  });

  const isLoading = history === undefined;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-[#10409a]" />
              Override History
            </DrawerTitle>
            <DrawerDescription>
              Complete history of tier limit overrides for this tenant.
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#6b7280]" />
              </div>
            )}

            {!isLoading && history && history.length === 0 && (
              <div className="text-center py-12">
                <AlertTriangle className="h-8 w-8 text-[#d1d5db] mx-auto mb-3" />
                <p className="text-sm text-[#6b7280]">
                  No override history found for this tenant.
                </p>
              </div>
            )}

            {!isLoading && history && history.length > 0 && (
              <div className="space-y-4">
                {history.map((record) => (
                  <OverrideHistoryItem key={record._id} record={record} />
                ))}
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// OverrideHistoryItem Sub-component
// ---------------------------------------------------------------------------

interface OverrideHistoryItemProps {
  record: OverrideRecord;
}

function OverrideHistoryItem({ record }: OverrideHistoryItemProps): React.ReactElement {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 space-y-3">
      {/* Header row: status + date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusBadge(record.status)}
          <span className="text-xs text-[#6b7280]">
            by <strong className="text-[#374151]">{record.adminName}</strong>
          </span>
        </div>
        <span className="text-xs text-[#9ca3af]">{formatDate(record.createdAt)}</span>
      </div>

      {/* Override values */}
      <div className="text-xs text-[#374151] bg-[#f9fafb] rounded-md px-3 py-2">
        {getOverrideSummary(record.overrides)}
      </div>

      {/* Reason */}
      <div>
        <span className="text-xs font-medium text-[#6b7280]">Reason: </span>
        <span className="text-xs text-[#374151]">{record.reason}</span>
      </div>

      {/* Expiration info */}
      {record.expiresAt && record.status === "active" && (
        <div className="flex items-center gap-1 text-xs text-amber-700">
          <Clock className="h-3 w-3" />
          <span>
            Expires: {new Date(record.expiresAt).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Removal/expiry info */}
      {record.removedAt && (
        <div className="flex items-center gap-1 text-xs text-[#6b7280]">
          <XCircle className="h-3 w-3" />
          <span>
            {record.status === "expired" ? "Expired" : "Removed"}:{" "}
            {formatDate(record.removedAt)}
          </span>
          {record.removedBy && (
            <span className="ml-1">
              by {record.removedBy}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
