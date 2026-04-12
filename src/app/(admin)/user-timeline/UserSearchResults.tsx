"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Building2, UserCheck, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserSearchResult {
  /** Discriminator: "user" for SaaS owners/team, "affiliate" for affiliates */
  type: "user" | "affiliate";
  userId?: string;
  affiliateId?: string;
  email: string;
  name?: string;
  tenantId: string;
  tenantName: string;
  role?: string;
  affiliateCode?: string;
  affiliateStatus?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface UserSearchResultsProps {
  results: UserSearchResult[];
  isLoading: boolean;
  onSelect: (result: UserSearchResult) => void;
  selectedUserId?: string;
}

export function UserSearchResults({
  results,
  isLoading,
  onSelect,
  selectedUserId,
}: UserSearchResultsProps) {
  if (isLoading) {
    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border-light)] rounded-lg shadow-xl overflow-hidden z-50">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border-light)] rounded-lg shadow-xl overflow-hidden z-50 max-h-[320px] overflow-y-auto">
      {/* Results header */}
      <div className="px-4 py-2 border-b border-[var(--border-light)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {results.length} user{results.length !== 1 ? "s" : ""} found
      </div>

      {results.map((result) => {
        const isSelected = (result.userId ?? result.affiliateId) === selectedUserId;
        const resultKey = result.userId ?? result.affiliateId ?? result.email;

        return (
          <button
            key={resultKey}
            onClick={() => onSelect(result)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
              isSelected
                ? "bg-[var(--brand-light)]/30"
                : "hover:bg-[var(--brand-light)]/15",
            )}
          >
            {/* Avatar */}
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
              result.type === "affiliate"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]",
            )}>
              {result.type === "affiliate" ? (
                <UserCircle className="w-5 h-5" />
              ) : (
                (result.name ?? result.email)
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[var(--text-heading)] truncate">
                  {result.name ?? result.email}
                </span>
                {/* Type badge */}
                <Badge
                  variant={result.type === "affiliate" ? "success" : "default"}
                  className="text-[9px] px-1.5 py-0"
                >
                  {result.type === "affiliate" ? "Affiliate" : (result.role ?? "User")}
                </Badge>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <span className="truncate">{result.email}</span>
                <span className="shrink-0">&middot;</span>
                <span className="flex items-center gap-1 shrink-0">
                  <Building2 className="w-3 h-3" />
                  {result.tenantName}
                </span>
              </div>

              {/* Affiliate badge */}
              {result.affiliateCode && (
                <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                  <UserCheck className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600 font-mono">{result.affiliateCode}</span>
                  {result.affiliateStatus && (
                    <Badge
                      variant={
                        result.affiliateStatus === "active"
                          ? "success"
                          : result.affiliateStatus === "suspended"
                            ? "destructive"
                            : "outline"
                      }
                      className="text-[8px] px-1 py-0"
                    >
                      {result.affiliateStatus}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
