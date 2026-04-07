"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  useQueryState,
  parseAsString,
  parseAsArrayOf,
  parseAsInteger,
} from "nuqs";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/ui/DataTablePagination";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { FilterPill, FilterPillBar } from "@/components/ui/FilterPill";
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
  selectedActions,
  selectedEntityTypes,
  selectedActorIds,
  onActionsChange,
  onEntityTypesChange,
  onActorIdsChange,
}: {
  actionTypes: string[];
  entityTypes: string[];
  actors: AuditActor[];
  selectedActions: string[];
  selectedEntityTypes: string[];
  selectedActorIds: string[];
  onActionsChange: (values: string[]) => void;
  onEntityTypesChange: (values: string[]) => void;
  onActorIdsChange: (values: string[]) => void;
}) {
  const actionOptions = actionTypes.map((a) => ({ value: a, label: formatAction(a) }));
  const entityOptions = entityTypes.map((t) => ({ value: t, label: getEntityConfig(t).label }));
  const actorOptions = actors.map((a) => ({ value: a.actorId, label: a.actorName }));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
        <Filter className="w-3.5 h-3.5" />
        Filters:
      </div>

      <MultiSelect
        options={actionOptions}
        selected={selectedActions}
        onChange={onActionsChange}
        placeholder="All Actions"
        popoverWidth="w-64"
      />

      <MultiSelect
        options={entityOptions}
        selected={selectedEntityTypes}
        onChange={onEntityTypesChange}
        placeholder="All Entities"
        popoverWidth="w-52"
      />

      <MultiSelect
        options={actorOptions}
        selected={selectedActorIds}
        onChange={onActorIdsChange}
        placeholder="All Users"
        popoverWidth="w-52"
      />
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
  // ── URL state via nuqs (arrays for multi-select) ──────────────────────
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState("pageSize", parseAsInteger.withDefault(DEFAULT_PAGE_SIZE));
  const [selectedActions, setSelectedActions] = useQueryState("action", parseAsArrayOf(parseAsString).withDefault([]));
  const [selectedEntityTypes, setSelectedEntityTypes] = useQueryState("entity", parseAsArrayOf(parseAsString).withDefault([]));
  const [selectedActorIds, setSelectedActorIds] = useQueryState("actor", parseAsArrayOf(parseAsString).withDefault([]));

  // ── Queries ───────────────────────────────────────────────────────────
  const actionTypes = useQuery(api.admin.audit.getAuditActionTypes, {});
  const entityTypes = useQuery(api.admin.audit.getAuditEntityTypes, {});
  const actors = useQuery(api.admin.audit.getAuditActors, {});

  const result = useQuery(api.admin.audit.listAllAuditLogs, {
    page,
    numItems: pageSize,
    actionFilter: selectedActions.length > 0 ? selectedActions : undefined,
    entityTypeFilter: selectedEntityTypes.length > 0 ? selectedEntityTypes : undefined,
    actorIdFilter: selectedActorIds.length > 0 ? selectedActorIds : undefined,
  });

  // ── Reset page when filters change ────────────────────────────────────
  useEffect(() => {
    setPage(1);
  }, [selectedActions, selectedEntityTypes, selectedActorIds, setPage]);

  // ── Clear all filters ─────────────────────────────────────────────────
  const handleClearAll = useCallback(() => {
    setSelectedActions([]);
    setSelectedEntityTypes([]);
    setSelectedActorIds([]);
  }, [setSelectedActions, setSelectedEntityTypes, setSelectedActorIds]);

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

  const filtersReady = actionTypes !== undefined && entityTypes !== undefined && actors !== undefined;
  const hasFilters = selectedActions.length > 0 || selectedEntityTypes.length > 0 || selectedActorIds.length > 0;

  // ── Build filter pill entries ────────────────────────────────────────
  const filterPills = (() => {
    const pills: Array<{ key: string; label: string }> = [];
    for (const action of selectedActions) {
      pills.push({ key: `action:${action}`, label: formatAction(action) });
    }
    for (const entityType of selectedEntityTypes) {
      pills.push({ key: `entity:${entityType}`, label: getEntityConfig(entityType).label });
    }
    for (const actorId of selectedActorIds) {
      const actor = actors?.find((a) => a.actorId === actorId);
      if (actor) {
        pills.push({ key: `actor:${actorId}`, label: actor.actorName });
      }
    }
    return pills;
  })();

  // ── Per-pill remove handler ──────────────────────────────────────────
  const handlePillRemove = useCallback(
    (key: string) => {
      const [type, value] = key.split(":");
      if (type === "action") setSelectedActions((prev) => prev.filter((v) => v !== value));
      else if (type === "entity") setSelectedEntityTypes((prev) => prev.filter((v) => v !== value));
      else if (type === "actor") setSelectedActorIds((prev) => prev.filter((v) => v !== value));
    },
    [setSelectedActions, setSelectedEntityTypes, setSelectedActorIds],
  );

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
                selectedActions={selectedActions}
                selectedEntityTypes={selectedEntityTypes}
                selectedActorIds={selectedActorIds}
                onActionsChange={setSelectedActions}
                onEntityTypesChange={setSelectedEntityTypes}
                onActorIdsChange={setSelectedActorIds}
              />
            ) : (
              <div className="flex gap-3">
                <Skeleton className="h-8 w-36 rounded-lg" />
                <Skeleton className="h-8 w-32 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            )}
          </FadeIn>

          {/* Active filter pills */}
          {hasFilters && (
            <FadeIn delay={90}>
              <FilterPillBar
                pills={filterPills}
                onRemove={handlePillRemove}
                onClearAll={handleClearAll}
              />
            </FadeIn>
          )}

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
                    Try adjusting your filters.
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
