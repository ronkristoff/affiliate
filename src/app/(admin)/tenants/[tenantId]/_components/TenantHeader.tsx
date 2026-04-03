"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TenantAvatar } from "@/app/(admin)/tenants/_components/TenantAvatar";
import { StatusBadge } from "@/app/(admin)/tenants/_components/StatusBadge";
import { PlanBadge } from "@/app/(admin)/tenants/_components/PlanBadge";
import { Button } from "@/components/ui/button";
import { Mail, UserCog, Globe, Users, Wallet, Zap, Calendar } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { ImpersonateModal } from "./ImpersonateModal";

interface TenantHeaderProps {
  tenant: {
    _id: string;
    companyName: string;
    domain: string | undefined;
    ownerEmail: string;
    ownerName: string | undefined;
    plan: string;
    status: string;
    createdAt: number;
    saligPayStatus: string | undefined;
    affiliateCount: {
      total: number;
      active: number;
      pending: number;
      flagged: number;
    };
    totalCommissions: number;
    mrrInfluenced: number;
    isFlagged: boolean;
    flagReasons: string[];
  };
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export function TenantHeader({ tenant }: TenantHeaderProps) {
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const displayStatus = tenant.isFlagged
    ? "flagged"
    : (tenant.status as "active" | "trial" | "suspended" | "flagged");

  const joinDate = new Date(tenant.createdAt * 1000).toLocaleDateString();

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <TenantAvatar
            name={tenant.companyName}
            className="h-14 w-14 rounded-xl text-base"
          />

          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-[#111827]">
                {tenant.companyName}
              </h1>
              <StatusBadge status={displayStatus} />
              <PlanBadge plan={tenant.plan} />
            </div>

            <div className="flex items-center gap-1.5 text-[13px] text-[#6b7280]">
              {tenant.domain && (
                <>
                  <Globe className="h-3.5 w-3.5" />
                  <span>{tenant.domain}</span>
                  <span className="text-[#d1d5db]">&middot;</span>
                </>
              )}
              <span>{tenant.ownerEmail}</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6b7280]">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {tenant.affiliateCount.total} affiliate{tenant.affiliateCount.total !== 1 ? "s" : ""}
              </span>

              <span className="inline-flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                {phpFormatter.format(tenant.totalCommissions)} commissions
              </span>

              {tenant.saligPayStatus && (
                <span className="inline-flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  SaligPay {tenant.saligPayStatus}
                </span>
              )}

              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Joined {joinDate}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[#1c2260] hover:bg-[#1c2260]/5 hover:text-[#1c2260]"
          >
            <Mail className="h-4 w-4" />
            Send Email
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[#1c2260] hover:bg-[#1c2260]/5 hover:text-[#1c2260]"
            onClick={() => setImpersonateOpen(true)}
          >
            <UserCog className="h-4 w-4" />
            Impersonate
          </Button>
        </div>
      </div>

      <ImpersonateModal
        open={impersonateOpen}
        onOpenChange={setImpersonateOpen}
        tenantId={tenant._id as Id<"tenants">}
        tenantName={tenant.companyName}
      />
    </div>
  );
}
