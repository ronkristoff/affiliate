"use client";

import { User, Mail, Hash } from "lucide-react";

interface PayoutMethod {
  type: string;
  details: string;
}

interface ProfileInformationProps {
  email: string;
  uniqueCode: string;
  payoutMethod?: PayoutMethod;
}

export function ProfileInformation({
  email,
  uniqueCode,
  payoutMethod,
}: ProfileInformationProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title flex items-center gap-2">
          <User className="h-4 w-4" />
          Profile
        </h3>
      </div>
      <div className="px-5 pb-5 space-y-4">
        <div className="space-y-1">
          <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em] flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            Email
          </label>
          <p className="text-[13px] text-[var(--text-body)] break-all">{email}</p>
        </div>
        <div className="space-y-1">
          <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em] flex items-center gap-2">
            <Hash className="h-3.5 w-3.5" />
            Referral Code
          </label>
          <code className="rounded-md bg-[var(--bg-page)] px-2.5 py-1 text-[13px] text-[var(--text-heading)] font-mono block w-fit">
            {uniqueCode}
          </code>
        </div>
        {payoutMethod && (
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em]">
              Payout Method
            </label>
            <p className="text-[13px] text-[var(--text-body)] capitalize">{payoutMethod.type}</p>
          </div>
        )}
      </div>
    </div>
  );
}
