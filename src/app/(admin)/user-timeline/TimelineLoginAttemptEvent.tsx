"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Lock, Globe, AlertTriangle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoginAttemptEntry {
  _id: string;
  _creationTime: number;
  email: string;
  ipAddress?: string;
  failedAt: number;
  lockedUntil?: number;
  isLocked: boolean;
  remainingLockMs?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimelineLoginAttemptEvent({ entry }: { entry: LoginAttemptEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(entry.failedAt), { addSuffix: true });
  const absoluteTime = format(new Date(entry.failedAt), "MMM d, yyyy 'at' h:mm a");

  let lockoutLabel: string | undefined;
  if (entry.isLocked && entry.remainingLockMs !== undefined) {
    if (entry.remainingLockMs > 60 * 1000) {
      lockoutLabel = `Locked for ${Math.ceil(entry.remainingLockMs / 60000)} more min`;
    } else {
      lockoutLabel = `Locked for ${Math.ceil(entry.remainingLockMs / 1000)} more sec`;
    }
  }

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer",
        "hover:bg-[var(--brand-light)]/20",
      )}
      onClick={() => setIsExpanded((prev) => !prev)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
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
            entry.isLocked
              ? "bg-red-500 ring-red-500/20"
              : "bg-amber-500 ring-amber-500/20",
          )}
        />
      </div>

      {/* Icon + content */}
      <div className="flex-1 min-w-0">
        {/* Top row */}
        <div className="flex items-center gap-2 flex-wrap">
          {entry.isLocked ? (
            <Lock className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          )}
          <span className={cn(
            "text-[13px] font-semibold",
            entry.isLocked
              ? "text-red-600"
              : "text-amber-600",
          )}>
            {entry.isLocked ? "Account Locked" : "Failed Login Attempt"}
          </span>
          {lockoutLabel && (
            <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0 rounded-full font-medium">
              {lockoutLabel}
            </span>
          )}
        </div>

        {/* IP address */}
        {entry.ipAddress && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <Globe className="w-3 h-3" />
            {entry.ipAddress}
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]" title={absoluteTime}>
          {timeAgo}
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 bg-[var(--bg-page)] rounded-md px-3 py-2 text-[11px] font-mono text-[var(--text-body)]" onClick={(e) => e.stopPropagation()}>
            <div>Email: {entry.email}</div>
            {entry.ipAddress && <div>IP: {entry.ipAddress}</div>}
            <div>Failed at: {absoluteTime}</div>
            {entry.lockedUntil && (
              <div>Locked until: {format(new Date(entry.lockedUntil), "MMM d, yyyy 'at' h:mm a")}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
