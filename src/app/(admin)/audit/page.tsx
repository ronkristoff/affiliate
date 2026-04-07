"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useQueryState,
  parseAsString,
  parseAsInteger,
} from "nuqs";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/ui/DataTablePagination";
import { FileText, Shield, Wrench, Users, CreditCard, Clock, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DateCell } from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogEntry {
  _id: string;
  _creationTime: number;
  tenantId?: string;
  action: string;
  entityType: string;
  entityId: string;
  targetId?: string;
  actorId?: string;
  actorName?: string;
  actorType: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  affiliateId?: string;
  tenantName?: string;
}

interface AuditActor {
  actorId: string;
  actorName: string;
  actorType: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAction(action: string): string {
  const map: Record<string, string> = {
    COMMISSION_CREATED: "Commission Created",
    COMMISSION_APPROVED: "Commission Approved",
    COMMISSION_DECLINED: "Commission Declined",
    COMMISSION_REVERSED: "Commission Reversed",
    COMMISSION_STATUS_CHANGE: "Status Changed",
    payout_batch_generated: "Payout Batch Generated",
    payout_marked_paid: "Payout Paid",
    batch_marked_paid: "Batch Paid",
    impersonation_start: "Impersonation Started",
    impersonation_end: "Impersonation Ended",
    impersonated_mutation: "Impersonated Action",
    tier_config_created: "Tier Created",
    tier_config_updated: "Tier Updated",
    tier_config_deleted: "Tier Deleted",
    tier_override_created: "Override Created",
    tier_override_removed: "Override Removed",
    subscription_trial_start: "Trial Started",
    subscription_converted: "Subscription Converted",
    subscription_renewed: "Subscription Renewed",
    subscription_cancelled: "Subscription Cancelled",
    subscription_plan_changed: "Plan Changed",
    ADMIN_PLAN_CHANGE: "Plan Changed (Admin)",
  };

  if (map[action]) return map[action];
  if (action.startsWith("security_")) {
    return action.replace("security_", "").replace(/_/g, " ");
  }
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getEntityConfig(entityType: string): {
  label: string;
  variant: "default" | "info" | "warning" | "success" | "destructive" | "outline";
} {
  const config: Record<string, { label: string; variant: "default" | "info" | "warning" | "success" | "destructive" | "outline" }> = {
    commission: { label: "Commission", variant: "info" },
    commissions: { label: "Commission", variant: "info" },
    payouts: { label: "Payout", variant: "success" },
    payoutBatches: { label: "Payout Batch", variant: "success" },
    security_event: { label: "Security", variant: "destructive" },
    impersonation: { label: "Impersonation", variant: "warning" },
    impersonationSessions: { label: "Impersonation", variant: "warning" },
    tier_config: { label: "Tier Config", variant: "outline" },
    tier_override: { label: "Tier Override", variant: "outline" },
    subscription: { label: "Subscription", variant: "default" },
    tenant: { label: "Tenant", variant: "default" },
    affiliate: { label: "Affiliate", variant: "info" },
    user: { label: "User", variant: "info" },
  };
  return config[entityType] ?? { label: entityType, variant: "outline" };
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case "commission":
    case "commissions":
      return <CreditCard className="w-3.5 h-3.5" />;
    case "payouts":
    case "payoutBatches":
      return <CreditCard className="w-3.5 h-3.5" />;
    case "security_event":
      return <Shield className="w-3.5 h-3.5" />;
    case "impersonation":
    case "impersonationSessions":
      return <Users className="w-3.5 h-3.5" />;
    case "tier_config":
    case "tier_override":
      return <Wrench className="w-3.5 h-3.5" />;
    default:
      return <FileText className="w-3.5 h-3.5" />;
  }
}

function getActorBadge(actorType: string) {
  switch (actorType) {
    case "system":
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">System</Badge>;
    case "user":
      return <Badge variant="info" className="text-[10px] px-1.5 py-0">User</Badge>;
    case "admin":
      return <Badge variant="default" className="text-[10px] px-1.5 py-0">Admin</Badge>;
    case "webhook":
      return <Badge variant="warning" className="text-[10px] px-1.5 py-0">Webhook</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{actorType}</Badge>;
  }
}

function formatMetadata(metadata: unknown): string | null {
  if (!metadata) return null;
  if (typeof metadata === "string") return metadata.length > 100 ? metadata.slice(0, 100) + "..." : metadata;
  try {
    const str = JSON.stringify(metadata);
    return str.length > 120 ? str.slice(0, 120) + "..." : str;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Filter Bar
// ---------------------------------------------------------------------------

function FilterBar({
  actionTypes,
  entityTypes,
  actors,
  selectedAction,
  selectedEntityType,
  selectedActorId,
  onActionChange,
  onEntityTypeChange,
  onActorChange,
  onClearAll,
}: {
  actionTypes: string[];
  entityTypes: string[];
  actors: AuditActor[];
  selectedAction: string;
  selectedEntityType: string;
  selectedActorId: string;
  onActionChange: (v: string) => void;
  onEntityTypeChange: (v: string) => void;
  onActorChange: (v: string) => void;
  onClearAll: () => void;
}) {
  const hasFilters = !!selectedAction || !!selectedEntityType || !!selectedActorId;

  const selectClass =
    "h-8 rounded-lg border border-[var(--border-light)] bg-white px-2.5 text-[12px] text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
        <Filter className="w-3.5 h-3.5" />
        Filters:
      </div>

      {/* Action */}
      <select
        value={selectedAction}
        onChange={(e) => onActionChange(e.target.value)}
        className={selectClass}
      >
        <option value="">All Actions</option>
        {actionTypes.map((action) => (
          <option key={action} value={action}>
            {formatAction(action)}
          </option>
        ))}
      </select>

      {/* Entity */}
      <select
        value={selectedEntityType}
        onChange={(e) => onEntityTypeChange(e.target.value)}
        className={selectClass}
      >
        <option value="">All Entities</option>
        {entityTypes.map((type) => (
          <option key={type} value={type}>
            {getEntityConfig(type).label}
          </option>
        ))}
      </select>

      {/* Actor — specific users, not generic types */}
      <select
        value={selectedActorId}
        onChange={(e) => onActorChange(e.target.value)}
        className={selectClass}
      >
        <option value="">All Users</option>
        {actors.map((actor) => (
          <option key={actor.actorId} value={actor.actorId}>
            {actor.actorName}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={onClearAll}
          className="h-8 px-3 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit Log Row
// ---------------------------------------------------------------------------

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const entityConfig = getEntityConfig(entry.entityType);
  const entityIcon = getEntityIcon(entry.entityType);
  const metadataPreview = formatMetadata(entry.metadata ?? entry.newValue);

  return (
    <div className="group px-5 py-3.5 border-b border-[var(--border-light)] last:border-b-0 hover:bg-[var(--brand-light)]/20 transition-colors">
      <div className="flex items-start gap-3.5">
        {/* Entity icon */}
        <div className="mt-0.5 w-8 h-8 rounded-lg bg-[var(--bg-page)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
          {entityIcon}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Top row: action + entity badge + actor type badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-[var(--text-heading)]">
              {formatAction(entry.action)}
            </span>
            <Badge variant={entityConfig.variant} className="text-[10px] px-1.5 py-0 gap-1">
              {entityIcon}
              {entityConfig.label}
            </Badge>
            {getActorBadge(entry.actorType)}
          </div>

          {/* Actor name + tenant */}
          <div className="mt-1 text-[12px] text-[var(--text-muted)]">
            {entry.actorName ? (
              <>by <span className="font-medium text-[var(--text-body)]">{entry.actorName}</span></>
            ) : (
              <>by <span className="italic">System</span></>
            )}
            {entry.tenantName && (
              <>
                {" · "}
                <span className="font-medium text-[var(--text-body)]">{entry.tenantName}</span>
              </>
            )}
          </div>

          {/* Metadata preview */}
          {metadataPreview && (
            <div className="mt-1.5 text-[11px] text-[var(--text-muted)] font-mono bg-[var(--bg-page)] rounded-md px-2.5 py-1.5 max-w-[600px] truncate">
              {metadataPreview}
            </div>
          )}

          {/* Entity ID */}
          <div className="mt-1 text-[10px] text-[var(--text-muted)]/60 flex items-center gap-1">
            ID: {entry.entityId}
            {entry.targetId && <> · Target: {entry.targetId}</>}
          </div>
        </div>

        {/* Timestamp */}
        <div className="shrink-0 text-right">
          <DateCell value={entry._creationTime} format="relative-full" size="sm" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content (hooks inside — wrapped by Suspense)
// ---------------------------------------------------------------------------

function AuditLogContent() {
  // ── URL state via nuqs ────────────────────────────────────────────────
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState("pageSize", parseAsInteger.withDefault(DEFAULT_PAGE_SIZE));
  const [selectedAction, setSelectedAction] = useQueryState("action", parseAsString.withDefault(""));
  const [selectedEntityType, setSelectedEntityType] = useQueryState("entity", parseAsString.withDefault(""));
  const [selectedActorId, setSelectedActorId] = useQueryState("actor", parseAsString.withDefault(""));

  // ── Queries ───────────────────────────────────────────────────────────
  const actionTypes = useQuery(api.admin.audit.getAuditActionTypes, {});
  const entityTypes = useQuery(api.admin.audit.getAuditEntityTypes, {});
  const actors = useQuery(api.admin.audit.getAuditActors, {});

  const result = useQuery(api.admin.audit.listAllAuditLogs, {
    page,
    numItems: pageSize,
    actionFilter: selectedAction || undefined,
    entityTypeFilter: selectedEntityType || undefined,
    actorIdFilter: selectedActorId || undefined,
  });

  // ── Reset page when filters change ────────────────────────────────────
  useEffect(() => {
    setPage(1);
  }, [selectedAction, selectedEntityType, selectedActorId, setPage]);

  // ── Clear all filters ─────────────────────────────────────────────────
  const handleClearAll = useCallback(() => {
    setSelectedAction("");
    setSelectedEntityType("");
    setSelectedActorId("");
  }, [setSelectedAction, setSelectedEntityType, setSelectedActorId]);

  // ── Pagination handler ────────────────────────────────────────────────
  const handlePaginationChange = useCallback(
    ({ page: newPage, pageSize: newPageSize }: { page: number; pageSize: number }) => {
      setPage(newPage);
      if (newPageSize !== pageSize) {
        setPageSize(newPageSize);
      }
    },
    [page, pageSize, setPage, setPageSize],
  );

  // ── Derived state ─────────────────────────────────────────────────────
  const isLoading = result === undefined;
  const entries = result?.page ?? [];
  const total = result?.total ?? 0;
  const rawMaxPage = Math.max(1, Math.ceil(total / pageSize));
  const maxPage = isLoading ? Math.max(page, rawMaxPage) : rawMaxPage;

  // Filters are loaded when all three queries have resolved
  const filtersReady = actionTypes !== undefined && entityTypes !== undefined && actors !== undefined;

  // ── Selected actor display name (for empty state message) ────────────
  const selectedActorName = selectedActorId && actors
    ? actors.find((a) => a.actorId === selectedActorId)?.actorName
    : undefined;

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar description="Platform-wide audit trail for all tenant operations">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          Audit Log
        </h1>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        <div className="space-y-5">
          {/* Summary stats */}
          <FadeIn delay={0}>
            <div className="flex items-center gap-6 text-[12px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {total} entries
              </span>
              {actionTypes && (
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  {actionTypes.length} action types
                </span>
              )}
            </div>
          </FadeIn>

          {/* Filters */}
          <FadeIn delay={60}>
            {filtersReady ? (
              <FilterBar
                actionTypes={actionTypes}
                entityTypes={entityTypes}
                actors={actors}
                selectedAction={selectedAction}
                selectedEntityType={selectedEntityType}
                selectedActorId={selectedActorId}
                onActionChange={setSelectedAction}
                onEntityTypeChange={setSelectedEntityType}
                onActorChange={setSelectedActorId}
                onClearAll={handleClearAll}
              />
            ) : (
              <div className="flex gap-3">
                <Skeleton className="h-8 w-36 rounded-lg" />
                <Skeleton className="h-8 w-32 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            )}
          </FadeIn>

          {/* Audit log list */}
          <FadeIn delay={120}>
            <div className="bg-white rounded-xl overflow-hidden border border-[var(--border-light)] shadow-sm">
              {/* Top gradient */}
              <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/20 to-transparent" />

              {isLoading ? (
                /* Loading skeleton */
                <div className="divide-y divide-[var(--border-light)]">
                  {[...Array(pageSize)].map((_, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-start gap-3.5">
                      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-20 rounded-full" />
                          <Skeleton className="h-4 w-12 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-48" />
                        <Skeleton className="h-5 w-72 rounded-md" />
                      </div>
                      <Skeleton className="h-3 w-20" />
                    </div>
                  ))}
                </div>
              ) : entries.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
                  <div className="w-12 h-12 rounded-full bg-[var(--brand-light)]/50 flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium mb-1">No audit entries found</p>
                  <p className="text-[12px]">
                    {(selectedAction || selectedEntityType || selectedActorId)
                      ? "Try adjusting your filters."
                      : "Audit events will appear here as actions are performed across the platform."}
                  </p>
                </div>
              ) : (
                /* Entries */
                <div className="divide-y divide-[var(--border-light)]">
                  {entries.map((entry) => (
                    <AuditLogRow key={entry._id} entry={entry} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {!isLoading && entries.length > 0 && (
                <DataTablePagination
                  pagination={{ page, pageSize }}
                  total={total}
                  onPaginationChange={handlePaginationChange}
                  isLoading={isLoading}
                />
              )}

              {/* Bottom gradient */}
              <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/10 to-transparent" />
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export (wrapped in Suspense for nuqs)
// ---------------------------------------------------------------------------

function AuditLogSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--border-light)] px-8 py-3">
        <Skeleton className="h-5 w-24 mb-1" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="px-8 pt-6 pb-8 space-y-5">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-3">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <div className="bg-white rounded-xl border border-[var(--border-light)] overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-5 py-3.5 flex items-start gap-3.5 border-b border-[var(--border-light)]">
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<AuditLogSkeleton />}>
      <AuditLogContent />
    </Suspense>
  );
}
