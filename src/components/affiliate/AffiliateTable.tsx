"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  Eye,
  PauseCircle,
  CheckCircle2,
  MoreHorizontal,
} from "lucide-react";

type AffiliateStatus = "all" | "pending" | "active" | "suspended" | "rejected";

interface Affiliate {
  _id: Id<"affiliates">;
  _creationTime: number;
  email: string;
  name: string;
  uniqueCode: string;
  status: string;
  promotionChannel?: string;
  campaignName?: string;
  referralCount?: number;
  clickCount?: number;
  totalEarnings?: number;
  hasFraudSignals?: boolean;
}

interface AffiliateTableProps {
  affiliates: Affiliate[];
  activeTab: AffiliateStatus;
  selectedAffiliates: Set<Id<"affiliates">>;
  canManage: boolean;
  onSelectAll: (checked: boolean) => void;
  onSelectAffiliate: (id: Id<"affiliates">, checked: boolean) => void;
  onApprove: (id: Id<"affiliates">, name: string) => void;
  onReject: (affiliate: Affiliate) => void;
  onSuspend: (affiliate: Affiliate) => void;
  onReactivate: (affiliate: Affiliate) => void;
  onViewDetails: (affiliate: Affiliate) => void;
  allSelected: boolean;
  someSelected: boolean;
  isLoading?: boolean;
}

// Helper to get avatar color based on name
function getAvatarColor(name: string): { bg: string; text: string } {
  const colors = [
    { bg: "#dbeafe", text: "#10409a" },
    { bg: "#fce7f3", text: "#9d174d" },
    { bg: "#ecfdf5", text: "#065f46" },
    { bg: "#ede9fe", text: "#5b21b6" },
    { bg: "#fff7ed", text: "#92400e" },
    { bg: "#f0fdf4", text: "#14532d" },
    { bg: "#fdf4ff", text: "#6b21a8" },
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// Helper to get initials
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Helper to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Helper to format date
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Helper to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function AffiliateTable({
  affiliates,
  activeTab,
  selectedAffiliates,
  canManage,
  onSelectAll,
  onSelectAffiliate,
  onApprove,
  onReject,
  onSuspend,
  onReactivate,
  onViewDetails,
  allSelected,
  someSelected,
  isLoading = false,
}: AffiliateTableProps) {
  // Show skeleton while loading
  if (isLoading) {
    const isPendingTab = activeTab === "pending";
    return (
      <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {isPendingTab && canManage && (
                  <th className="w-10 px-4 py-2.5 text-left bg-[#fafafa] border-b border-[#e5e7eb]">
                    <Skeleton className="h-4 w-4" />
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                  {isPendingTab ? "Applicant" : "Affiliate"}
                </th>
                {isPendingTab ? (
                  <>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                      Applied
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                      Source
                    </th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                      Campaign
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                      Referrals
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                      Clicks
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                      Earnings
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                      Joined
                    </th>
                  </>
                )}
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                  {isPendingTab ? "Actions" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-[#f3f4f6]">
                  {isPendingTab && canManage && (
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-3 w-20" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-3 w-24" />
                  </td>
                  {!isPendingTab && (
                    <>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-3 w-28" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-3 w-8" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-3 w-12" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-3 w-16 ml-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-3 w-20" />
                      </td>
                    </>
                  )}
                  {isPendingTab && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-7 w-16 rounded-md" />
                        <Skeleton className="h-7 w-16 rounded-md" />
                      </div>
                    </td>
                  )}
                  {!isPendingTab && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="h-7 w-14 rounded-md" />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (affiliates.length === 0) {
    return (
      <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
        <div className="flex items-center justify-center h-32 text-[#6b7280] text-sm">
          No {activeTab} affiliates found
        </div>
      </div>
    );
  }

  const isPendingTab = activeTab === "pending";

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {isPendingTab && canManage && (
                <th className="w-10 px-4 py-2.5 text-left">
                  <Checkbox
                    checked={someSelected ? "indeterminate" : allSelected ? true : false}
                    onCheckedChange={onSelectAll}
                  />
                </th>
              )}
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                {isPendingTab ? "Applicant" : "Affiliate"}
              </th>
              {isPendingTab ? (
                <>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                    Applied
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                    Source
                  </th>
                </>
              ) : (
                <>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                    Campaign
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                    Referrals
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                    Clicks
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                    Earnings
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                    Joined
                  </th>
                </>
              )}
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]">
                {isPendingTab ? "Actions" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((affiliate) => {
              const colors = getAvatarColor(affiliate.name);
              const initials = getInitials(affiliate.name);
              const isSelected = selectedAffiliates.has(affiliate._id);

              return (
                <tr
                  key={affiliate._id}
                  className={cn(
                    "hover:bg-[#f9fafb] transition-colors",
                    isPendingTab && "border-b border-[#f3f4f6]"
                  )}
                  style={
                    isPendingTab && isSelected
                      ? { backgroundColor: "#fffbeb" }
                      : undefined
                  }
                >
                  {isPendingTab && canManage && (
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          onSelectAffiliate(affiliate._id, checked as boolean)
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {initials}
                      </div>
                      <div>
                        <div className="font-semibold text-[#333] text-[13px]">
                          {affiliate.name}
                        </div>
                        <div className="text-[11px] text-[#6b7280]">
                          {affiliate.email}
                        </div>
                        {affiliate.hasFraudSignals && (
                          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-semibold">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: "#f59e0b" }}
                            />
                            Flagged
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {isPendingTab ? (
                    <>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-[#6b7280]">
                          {formatRelativeTime(affiliate._creationTime)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#474747]">
                          {affiliate.promotionChannel || "Direct invite"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#474747]">
                          {affiliate.campaignName || "Standard Program"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {canManage && (
                            <>
                              <button
                                onClick={() => onApprove(affiliate._id, affiliate.name)}
                                className="px-3 py-1.5 rounded-md text-[12px] font-bold bg-[#10b981] text-white hover:bg-[#059669] transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => onReject(affiliate)}
                                className="px-3 py-1.5 rounded-md text-[12px] font-bold bg-transparent text-[#ef4444] border border-[#ef4444] hover:bg-[#fef2f2] transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <StatusBadge status={affiliate.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#474747]">
                          {affiliate.campaignName || "Standard Program"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-semibold text-[#333]">
                          {affiliate.referralCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] text-[#6b7280]">
                          {affiliate.clickCount?.toLocaleString() || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            affiliate.status === "suspended"
                              ? "text-[#6b7280]"
                              : "text-[#333]"
                          )}
                        >
                          {formatCurrency(affiliate.totalEarnings || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#6b7280]">
                          {formatDate(affiliate._creationTime)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[12px]"
                            onClick={() => onViewDetails(affiliate)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Button>
                          {canManage && affiliate.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[12px] text-[#ef4444] border-[#ef4444] hover:bg-[#fef2f2]"
                              onClick={() => onSuspend(affiliate)}
                            >
                              <PauseCircle className="h-3.5 w-3.5 mr-1" />
                              Suspend
                            </Button>
                          )}
                          {canManage && affiliate.status === "suspended" && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 px-2 text-[12px] bg-[#10b981] hover:bg-[#059669]"
                              onClick={() => onReactivate(affiliate)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Simple export for use in other components
export type { Affiliate };
