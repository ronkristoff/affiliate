"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { CheckCircle, PauseCircle, Mail, Hash, CreditCard } from "lucide-react";

interface PayoutMethod {
  type: string;
  details: string;
}

interface AffiliateProfileHeroProps {
  name: string;
  email: string;
  uniqueCode: string;
  joinDate: number;
  status: string;
  payoutMethod?: PayoutMethod;
  canManage: boolean;
  isActive: boolean;
  isSuspended: boolean;
  onSuspend: () => void;
  onReactivate: () => void;
}

export function AffiliateProfileHero({
  name,
  email,
  uniqueCode,
  joinDate,
  status,
  payoutMethod,
  canManage,
  isActive,
  isSuspended,
  onSuspend,
  onReactivate,
}: AffiliateProfileHeroProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="card">
      {/* Header row: avatar + name + status + actions */}
      <div className="card-header">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-[var(--brand-light)] flex items-center justify-center shrink-0">
            <span className="text-lg font-semibold text-[var(--brand-primary)]">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-[var(--text-heading)]">{name}</h2>
            <p className="text-[12px] text-[var(--text-muted)]">
              Joined {formatDate(joinDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {canManage && isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSuspend}
              className="text-[#92400e] border-[#f59e0b] bg-[#fffbeb] hover:bg-[#fef3c7] hover:border-[#f59e0b] hover:shadow-[0_0_0_2px_rgba(245,158,11,0.15)]"
            >
              <PauseCircle className="mr-2 h-4 w-4" />
              Suspend
            </Button>
          )}
          {canManage && isSuspended && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReactivate}
              className="text-[#065f46] border-[#10b981] bg-[#ecfdf5] hover:bg-[#d1fae5] hover:border-[#10b981] hover:shadow-[0_0_0_2px_rgba(16,185,129,0.15)]"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Profile details row */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Email */}
          <div className="flex items-center gap-3 rounded-lg bg-[var(--bg-page)] px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-[var(--brand-light)] flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-[var(--brand-primary)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Email</p>
              <p className="text-[13px] text-[var(--text-heading)] truncate">{email}</p>
            </div>
          </div>

          {/* Referral Code */}
          <div className="flex items-center gap-3 rounded-lg bg-[var(--bg-page)] px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-[var(--success-bg)] flex items-center justify-center shrink-0">
              <Hash className="h-4 w-4 text-[var(--success-text)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Referral Code</p>
              <code className="text-[13px] text-[var(--text-heading)] font-mono">{uniqueCode}</code>
            </div>
          </div>

          {/* Payout Method */}
          <div className="flex items-center gap-3 rounded-lg bg-[var(--bg-page)] px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-[var(--warning-bg)] flex items-center justify-center shrink-0">
              <CreditCard className="h-4 w-4 text-[var(--warning-text)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Payout Method</p>
              <p className="text-[13px] text-[var(--text-heading)] capitalize">
                {payoutMethod ? payoutMethod.type : "Not set"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
