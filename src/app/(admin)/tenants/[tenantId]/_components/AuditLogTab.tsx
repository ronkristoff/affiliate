"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Shield, MessageSquare, CreditCard, AlertTriangle, UserCog, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLogTabProps {
  tenantId: Id<"tenants">;
}

const ACTION_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  impersonation_start: { icon: UserCog, color: "text-[#f59e0b]", bgColor: "bg-[#fef3c7]" },
  impersonation_end: { icon: UserCog, color: "text-[#6b7280]", bgColor: "bg-[#f3f4f6]" },
  admin_note_added: { icon: MessageSquare, color: "text-[#1c2260]", bgColor: "bg-[#dbeafe]" },
  plan_change: { icon: CreditCard, color: "text-[#7c3aed]", bgColor: "bg-[#ede9fe]" },
  status_change: { icon: Shield, color: "text-[#ef4444]", bgColor: "bg-[#fee2e2]" },
  tenant_suspended: { icon: AlertTriangle, color: "text-[#ef4444]", bgColor: "bg-[#fee2e2]" },
};

function getDefaultActionConfig() {
  return { icon: Clock, color: "text-[#6b7280]", bgColor: "bg-[#f3f4f6]" };
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatActionName(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AuditLogTab({ tenantId }: AuditLogTabProps) {
  const [logCursor, setLogCursor] = useState<string | null>(null);

  const logResult = useQuery(api.admin.tenants.getTenantAuditLog, {
    tenantId,
    paginationOpts: { numItems: 20, cursor: logCursor },
  });

  const isLoading = logResult === undefined;
  const entries = logResult?.entries ?? [];
  const hasNextPage = logResult?.hasNextPage ?? false;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#e5e7eb] bg-white">
        {isLoading ? (
          <div className="space-y-4 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-60 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Clock className="mb-2 h-8 w-8 text-[#6b7280]" />
            <p className="text-sm text-[#6b7280]">No audit log entries</p>
          </div>
        ) : (
          <div className="divide-y divide-[#e5e7eb]">
            {entries.map((entry) => {
              const config = ACTION_TYPE_CONFIG[entry.action] ?? getDefaultActionConfig();
              const Icon = config.icon;
              return (
                <div key={entry._id} className="flex items-start gap-3 p-4">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", config.bgColor)}>
                    <Icon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#333333]">
                        {formatActionName(entry.action)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-[#6b7280]">
                      by {entry.actorName}
                      {entry.ipAddress && (
                        <span className="ml-2">from {entry.ipAddress}</span>
                      )}
                    </div>
                    {entry.details && (
                      <p className="mt-1 truncate text-xs text-[#9ca3af]">{entry.details}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-[#6b7280]">{formatDate(entry.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More — uses true DB cursor pagination */}
        {hasNextPage && logResult?.continueCursor && (
          <div className="border-t border-[#e5e7eb] p-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogCursor(logResult.continueCursor ?? null)}
              className="text-[#1c2260] hover:bg-[#1c2260]/10"
            >
              <ChevronDown className="mr-1 h-4 w-4" />
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
