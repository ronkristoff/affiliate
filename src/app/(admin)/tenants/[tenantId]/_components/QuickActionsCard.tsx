"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Shield, Mail, MessageSquarePlus, Ban } from "lucide-react";
import { ImpersonateModal } from "./ImpersonateModal";

interface QuickActionsCardProps {
  tenantId: Id<"tenants">;
  tenantName: string;
}

export function QuickActionsCard({ tenantId, tenantName }: QuickActionsCardProps) {
  const [impersonateOpen, setImpersonateOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
        <h2 className="mb-4 text-base font-semibold text-[#111827]">
          Quick Actions
        </h2>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 bg-[#fef3c7] text-[#92400e] border-[#fde68a] hover:bg-[#fde68a] hover:text-[#92400e]"
            onClick={() => setImpersonateOpen(true)}
          >
            <Shield className="h-4 w-4" />
            Impersonate Tenant
          </Button>

        <Button
          variant="outline"
          disabled
          className="w-full justify-start gap-2 disabled:opacity-50"
        >
          <Mail className="h-4 w-4" />
          Send Resolution Email
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => console.log(`Switch to notes tab for tenant: ${tenantId}`)}
        >
          <MessageSquarePlus className="h-4 w-4" />
          Add Admin Note
        </Button>

        <Button
          variant="outline"
          disabled
          className="w-full justify-start gap-2 bg-[#fee2e2] text-[#991b1b] border-[#fecaca] hover:bg-[#fecaca] hover:text-[#991b1b] disabled:opacity-50"
        >
          <Ban className="h-4 w-4" />
          Suspend Tenant
        </Button>
        </div>
      </div>

      <ImpersonateModal
        open={impersonateOpen}
        onOpenChange={setImpersonateOpen}
        tenantId={tenantId}
        tenantName={tenantName}
      />
    </>
  );
}
