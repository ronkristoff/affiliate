"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  getAuditActionLabel,
  getActionSeverity,
  type AuditSeverity,
} from "@/lib/audit-constants";
import {
  LogIn,
  LogOut,
  Shield,
  Mail,
  DollarSign,
  Users,
  AlertTriangle,
  Settings,
  Activity,
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  _id: string;
  _creationTime: number;
  tenantId?: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorType: string;
  actorName?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  affiliateId?: string;
  tenantName?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeverityDotColor(severity: AuditSeverity): string {
  const colors: Record<AuditSeverity, string> = {
    red: "bg-red-500",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
  };
  return colors[severity];
}

function getSeverityRingColor(severity: AuditSeverity): string {
  const colors: Record<AuditSeverity, string> = {
    red: "ring-red-500/20",
    green: "ring-emerald-500/20",
    amber: "ring-amber-500/20",
    blue: "ring-blue-500/20",
    purple: "ring-purple-500/20",
  };
  return colors[severity];
}

function getActionIcon(action: string): React.ReactNode {
  if (action.startsWith("AUTH_") || action.startsWith("LOGIN") || action === "ACCOUNT_LOCKED") {
    return <LogIn className="w-3.5 h-3.5" />;
  }
  if (action.startsWith("email_") || action.startsWith("EMAIL_")) {
    return <Mail className="w-3.5 h-3.5" />;
  }
  if (
    action.startsWith("COMMISSION_") ||
    action.startsWith("payout_") ||
    action.startsWith("batch_")
  ) {
    return <DollarSign className="w-3.5 h-3.5" />;
  }
  if (action.startsWith("affiliate_") || action.startsWith("AFFILIATE_") || action.startsWith("referral_")) {
    return <Users className="w-3.5 h-3.5" />;
  }
  if (
    action.startsWith("security_") ||
    action.startsWith("impersonation") ||
    action.startsWith("FRAUD_") ||
    action === "permission_denied"
  ) {
    return <Shield className="w-3.5 h-3.5" />;
  }
  if (action.startsWith("CAMPAIGN_") || action.startsWith("tenant_") || action.startsWith("user_")) {
    return <Settings className="w-3.5 h-3.5" />;
  }
  return <Activity className="w-3.5 h-3.5" />;
}

function formatTimestamp(ts: number): { relative: string; absolute: string } {
  const date = new Date(ts);
  return {
    relative: formatDistanceToNow(date, { addSuffix: true }),
    absolute: format(date, "MMM d, yyyy 'at' h:mm a"),
  };
}

function formatMetadataValue(value: unknown, depth = 0): string {
  if (depth > 3) return "...";
  if (value === null || value === undefined) return "\u2014";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDiff(
  previous: unknown,
  next: unknown,
): { field: string; from: string; to: string }[] {
  if (!previous || !next || typeof previous !== "object" || typeof next !== "object") {
    return [];
  }
  const diffs: { field: string; from: string; to: string }[] = [];
  const allKeys = new Set([
    ...Object.keys(previous as Record<string, unknown>),
    ...Object.keys(next as Record<string, unknown>),
  ]);
  for (const key of allKeys) {
    const prev = (previous as Record<string, unknown>)[key];
    const nxt = (next as Record<string, unknown>)[key];
    if (JSON.stringify(prev) !== JSON.stringify(nxt)) {
      diffs.push({
        field: key,
        from: formatMetadataValue(prev),
        to: formatMetadataValue(nxt),
      });
    }
  }
  return diffs;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimelineEvent({ entry }: { entry: TimelineEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const severity = getActionSeverity(entry.action);
  const label = getAuditActionLabel(entry.action);
  const icon = getActionIcon(entry.action);
  const { relative, absolute } = formatTimestamp(entry._creationTime);
  const diffs = formatDiff(entry.previousValue, entry.newValue);
  const hasDetails = !!entry.metadata || diffs.length > 0;

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer",
        "hover:bg-[var(--brand-light)]/20",
      )}
      onClick={() => hasDetails && setIsExpanded((prev) => !prev)}
      role={hasDetails ? "button" : undefined}
      tabIndex={hasDetails ? 0 : undefined}
      onKeyDown={(e) => {
        if (hasDetails && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setIsExpanded((prev) => !prev);
        }
      }}
    >
      {/* Severity dot */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full ring-4",
            getSeverityDotColor(severity),
            getSeverityRingColor(severity),
          )}
        />
      </div>

      {/* Icon + content */}
      <div className="flex-1 min-w-0">
        {/* Top row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Action icon */}
          <span className="text-[var(--text-muted)]">{icon}</span>

          {/* Action label */}
          <span className="text-[13px] font-semibold text-[var(--text-heading)]">
            {label}
          </span>

          {/* Entity type badge */}
          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
            {entry.entityType}
          </Badge>

          {/* Tenant name */}
          {entry.tenantName && (
            <span className="text-[11px] text-[var(--text-muted)]">{entry.tenantName}</span>
          )}
        </div>

          {/* Timestamp + actor */}
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span title={absolute}>{relative}</span>
            {entry.actorName && (
              <>
                <span className="text-[var(--border-light)]">·</span>
                <span>by {entry.actorName}</span>
              </>
            )}
          </div>

        {/* Expanded details */}
        {isExpanded && hasDetails && (
          <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
            {/* Diff view */}
            {diffs.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Changes
                </div>
                {diffs.map((d) => (
                  <div
                    key={d.field}
                    className="bg-[var(--bg-page)] rounded-md px-3 py-2 text-[11px] font-mono"
                  >
                    <span className="text-[var(--text-muted)]">{d.field}: </span>
                    <span className="text-red-500 line-through">{d.from}</span>
                    <span className="text-[var(--text-muted)] mx-1.5">&rarr;</span>
                    <span className="text-emerald-600">{d.to}</span>
                  </div>
                ))}
              </div>
            ) : entry.metadata ? (
              <div className="bg-[var(--bg-page)] rounded-md px-3 py-2 text-[11px] font-mono text-[var(--text-body)] max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
                {formatMetadataValue(entry.metadata)}
              </div>
            ) : null}

            {/* Entity ID */}
            <div className="text-[10px] text-[var(--text-muted)]/60 font-mono">
              ID: {entry.entityId}
            </div>
          </div>
        )}
      </div>

      {/* Expand chevron */}
      {hasDetails && (
        <div className="shrink-0 pt-1 text-[var(--text-muted)]">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      )}
    </div>
  );
}
