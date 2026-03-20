"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Id } from "@/convex/_generated/dataModel";
import {
  X,
  Mail,
  AlertTriangle,
  ExternalLink,
  PauseCircle,
  CheckCircle2,
} from "lucide-react";

interface AffiliateDetailDrawerProps {
  affiliate: {
    _id: Id<"affiliates">;
    name: string;
    email: string;
    status: string;
    uniqueCode: string;
    campaignName?: string;
    commissionRate?: string;
    payoutMethod?: {
      type: string;
      details: string;
    };
    pendingPayout?: number;
    joinDate: number;
    referralCount?: number;
    clickCount?: number;
    totalEarnings?: number;
    note?: string;
    recentCommissions?: {
      customer: string;
      plan: string;
      status: "confirmed" | "pending";
      amount: number;
    }[];
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveNote?: (note: string) => void;
  onSuspend?: () => void;
  onReactivate?: () => void;
  isStatsLoading?: boolean;
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

export function AffiliateDetailDrawer({
  affiliate,
  isOpen,
  onClose,
  onSaveNote,
  onSuspend,
  onReactivate,
  isStatsLoading = false,
}: AffiliateDetailDrawerProps) {
  const [note, setNote] = useState(affiliate?.note || "");

  if (!affiliate) return null;

  const colors = getAvatarColor(affiliate.name);
  const initials = getInitials(affiliate.name);

  const handleSaveNote = () => {
    onSaveNote?.(note);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-[#e5e7eb]">
          <SheetTitle className="text-base font-bold text-[#333]">
            Affiliate Profile
          </SheetTitle>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Hero */}
          <div className="flex items-center gap-4 pb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-[22px] font-bold shrink-0"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              {initials}
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#333]">
                {affiliate.name}
              </h2>
              <p className="text-[13px] text-[#6b7280]">{affiliate.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <StatusBadge status={affiliate.status} />
                <span className="text-[11px] text-[#6b7280]">
                  Joined {formatDate(affiliate.joinDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Mini Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {isStatsLoading ? (
              <>
                <div className="bg-[#f2f2f2] rounded-lg p-3 text-center">
                  <Skeleton className="h-6 w-10 mx-auto" />
                  <Skeleton className="h-3 w-14 mx-auto mt-2" />
                </div>
                <div className="bg-[#f2f2f2] rounded-lg p-3 text-center">
                  <Skeleton className="h-6 w-10 mx-auto" />
                  <Skeleton className="h-3 w-10 mx-auto mt-2" />
                </div>
                <div className="bg-[#f2f2f2] rounded-lg p-3 text-center">
                  <Skeleton className="h-6 w-16 mx-auto" />
                  <Skeleton className="h-3 w-16 mx-auto mt-2" />
                </div>
              </>
            ) : (
              <>
                <div className="bg-[#f2f2f2] rounded-lg p-3 text-center">
                  <div className="text-[18px] font-bold text-[#333]">
                    {affiliate.referralCount || 0}
                  </div>
                  <div className="text-[11px] text-[#6b7280] mt-0.5">Referrals</div>
                </div>
                <div className="bg-[#f2f2f2] rounded-lg p-3 text-center">
                  <div className="text-[18px] font-bold text-[#333]">
                    {affiliate.clickCount?.toLocaleString() || 0}
                  </div>
                  <div className="text-[11px] text-[#6b7280] mt-0.5">Clicks</div>
                </div>
                <div className="bg-[#f2f2f2] rounded-lg p-3 text-center">
                  <div className="text-[18px] font-bold text-[#333]">
                    {formatCurrency(affiliate.totalEarnings || 0)}
                  </div>
                  <div className="text-[11px] text-[#6b7280] mt-0.5">Total Earned</div>
                </div>
              </>
            )}
          </div>

          {/* Details Section */}
          <div className="mb-6">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280] mb-3">
              Details
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6]">
                <span className="text-[12px] text-[#6b7280]">Campaign</span>
                <span className="text-[13px] font-semibold text-[#333]">
                  {affiliate.campaignName || "Standard Program"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6]">
                <span className="text-[12px] text-[#6b7280]">Commission Rate</span>
                <span className="text-[13px] font-semibold text-[#333]">
                  {affiliate.commissionRate || "20% recurring"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6]">
                <span className="text-[12px] text-[#6b7280]">Referral Code</span>
                <code className="text-[12px] font-mono bg-[#f3f4f6] px-2 py-0.5 rounded text-[#333]">
                  {affiliate.uniqueCode}
                </code>
              </div>
              {affiliate.payoutMethod && (
                <div className="flex justify-between items-center py-2 border-b border-[#f3f4f6]">
                  <span className="text-[12px] text-[#6b7280]">Payout Method</span>
                  <span className="text-[13px] font-semibold text-[#333]">
                    {affiliate.payoutMethod.type} — {affiliate.payoutMethod.details}
                  </span>
                </div>
              )}
              {affiliate.pendingPayout !== undefined ? (
                <div className="flex justify-between items-center py-2">
                  <span className="text-[12px] text-[#6b7280]">Pending Payout</span>
                  {isStatsLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    <span className="text-[13px] font-semibold text-[#f59e0b]">
                      {formatCurrency(affiliate.pendingPayout)}
                    </span>
                  )}
                </div>
              ) : isStatsLoading ? (
                <div className="flex justify-between items-center py-2">
                  <span className="text-[12px] text-[#6b7280]">Pending Payout</span>
                  <Skeleton className="h-4 w-20" />
                </div>
              ) : null}
            </div>
          </div>

          {/* Recent Commissions */}
          {affiliate.recentCommissions && affiliate.recentCommissions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280] mb-3">
                Recent Commissions
              </h3>
              <div className="space-y-2">
                {affiliate.recentCommissions.slice(0, 3).map((commission, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center py-2 border-b border-[#f3f4f6] text-[12px]"
                  >
                    <span>
                      {commission.customer} — {commission.plan}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          commission.status === "confirmed"
                            ? "bg-[#d1fae5] text-[#065f46]"
                            : "bg-[#fef3c7] text-[#92400e]"
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              commission.status === "confirmed" ? "#10b981" : "#f59e0b",
                          }}
                        />
                        {commission.status === "confirmed" ? "Confirmed" : "Pending"}
                      </span>
                      <span className="font-semibold text-[#333]">
                        {formatCurrency(commission.amount)}
                      </span>
                    </div>
                  </div>
                ))}
                <a
                  href="#"
                  className="inline-flex items-center gap-1 mt-2 text-[12px] text-[#2b7bb9] hover:underline"
                >
                  View all commissions →
                </a>
              </div>
            </div>
          )}

          {/* Internal Notes */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280] mb-3">
              Internal Notes
            </h3>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a private note about this affiliate (not visible to them)…"
              className="min-h-[80px] text-[13px] border-[#e5e7eb] focus:border-[#1659d6] resize-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveNote}
              className="mt-2 h-7 text-[12px]"
            >
              Save Note
            </Button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#e5e7eb] flex gap-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-[12px] transition-all duration-200 active:scale-95"
          >
            <Mail className="h-3.5 w-3.5 mr-1" />
            Send Email
          </Button>
          {affiliate.status === "active" && onSuspend && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-[12px] text-[#92400e] border-[#f59e0b] bg-[#fffbeb] hover:bg-[#fef3c7] hover:border-[#f59e0b] hover:shadow-[0_0_0_2px_rgba(245,158,11,0.15)] transition-all duration-200 active:scale-95 active:translate-y-[1px]"
              onClick={onSuspend}
            >
              <PauseCircle className="h-3.5 w-3.5 mr-1" />
              Suspend
            </Button>
          )}
          {affiliate.status === "suspended" && onReactivate && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-[12px] text-[#065f46] border-[#10b981] bg-[#ecfdf5] hover:bg-[#d1fae5] hover:border-[#10b981] hover:shadow-[0_0_0_2px_rgba(16,185,129,0.15)] transition-all duration-200 active:scale-95 active:translate-y-[1px]"
              onClick={onReactivate}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Reactivate
            </Button>
          )}
          <Button
            size="sm"
            className="flex-1 h-8 text-[12px] bg-[#10409a] hover:bg-[#1659d6] hover:shadow-[0_2px_8px_rgba(16,64,154,0.25)] transition-all duration-200 active:scale-95 active:translate-y-[1px]"
            asChild
          >
            <a href={`/affiliates/${affiliate._id}`}>
              View Full Profile
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
