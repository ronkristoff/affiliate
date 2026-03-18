"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Code, Mail, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationsTabProps {
  tenant: {
    _id: Id<"tenants">;
    saligPayStatus?: string;
    saligPayExpiresAt?: number;
  };
}

const INTEGRATION_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  connected: { label: "Connected", bg: "bg-[#d1fae5]", text: "text-[#065f46]" },
  error: { label: "Error", bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
  disconnected: { label: "Disconnected", bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  not_configured: { label: "Not Configured", bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  verified: { label: "Verified", bg: "bg-[#d1fae5]", text: "text-[#065f46]" },
  pending_verification: { label: "Pending", bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
  not_installed: { label: "Not Installed", bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
  active: { label: "Active", bg: "bg-[#d1fae5]", text: "text-[#065f46]" },
  never_sent: { label: "Never Sent", bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" },
};

function formatDate(timestamp?: number): string {
  if (!timestamp) return "N/A";
  return new Date(timestamp * 1000).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function StatusBadge({ status }: { status: string }) {
  const config = INTEGRATION_STATUS_CONFIG[status] ?? INTEGRATION_STATUS_CONFIG.not_configured;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", config.bg, config.text)}>
      {config.label}
    </span>
  );
}

interface IntegrationRowProps {
  icon: React.ReactNode;
  name: string;
  status: string;
  lastActivity?: number;
  action?: { label: string; onClick?: () => void; variant?: "default" | "outline" };
}

function IntegrationRow({ icon, name, status, lastActivity, action }: IntegrationRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-[#e5e7eb] p-4 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f3f4f6] text-[#6b7280]">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-[#333333]">{name}</div>
          <div className="text-xs text-[#6b7280]">
            Last activity: {formatDate(lastActivity)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={status} />
        {action && (
          <Button variant={action.variant ?? "outline"} size="sm" className="h-8 text-xs" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export function IntegrationsTab({ tenant }: IntegrationsTabProps) {
  const integrations = useQuery(api.admin.tenants.getTenantIntegrations, {
    tenantId: tenant._id,
  });

  const isLoading = integrations === undefined;

  return (
    <Card className="overflow-hidden rounded-xl border border-[#e5e7eb]">
      <CardHeader className="border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
        <CardTitle className="text-sm font-bold text-[#333333]">Integrations</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : integrations ? (
          <>
            <IntegrationRow
              icon={<Zap className="h-5 w-5" />}
              name="SaligPay"
              status={integrations.saligPay.status}
              lastActivity={integrations.saligPay.lastActivity}
              action={{ label: "Trigger Re-auth Email", onClick: () => {} }}
            />
            <IntegrationRow
              icon={<Code className="h-5 w-5" />}
              name="Tracking Snippet"
              status={integrations.trackingSnippet.status}
              lastActivity={integrations.trackingSnippet.lastPing}
            />
            <IntegrationRow
              icon={<Mail className="h-5 w-5" />}
              name="Email Notifications"
              status={integrations.emailNotifications.status}
              lastActivity={integrations.emailNotifications.lastSent}
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
