"use client";

import { Suspense, useCallback, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePlatformStats } from "@/hooks/usePlatformStats";
import {
  useQueryState,
  parseAsString,
  parseAsArrayOf,
  parseAsInteger,
} from "nuqs";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTablePagination, DEFAULT_PAGE_SIZE } from "@/components/ui/DataTablePagination";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { FilterPill, FilterPillBar } from "@/components/ui/FilterPill";
import { FileText, Shield, Wrench, Users, CreditCard, Clock, Filter, AlertTriangle, ArrowRight, Calendar } from "lucide-react";
import { DateCell } from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getAuditActionLabel } from "@/lib/audit-constants";

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
  return getAuditActionLabel(action);
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
// Tier Config Diff Renderer
// ---------------------------------------------------------------------------

const TIER_FIELD_LABELS: Record<string, string> = {
  price: "Price",
  maxAffiliates: "Max Affiliates",
  maxCampaigns: "Max Campaigns",
  maxTeamMembers: "Max Team Members",
  maxPayoutsPerMonth: "Max Payouts/Month",
  maxApiCalls: "Max API Calls",
};

function formatTierValue(field: string, value: unknown): string {
  if (field === "price" && typeof value === "number") return `$${value.toLocaleString()}`;
  if (field === "features" && typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.map(([k, v]) => `${k}${v ? " \u2713" : " \u2717"}`).join(", ") || "None";
  }
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "—");
}

function TierConfigDiffRenderer({ metadata }: { metadata: Record<string, unknown> }) {
  const before = metadata.before as Record<string, unknown> | undefined;
  const after = metadata.after as Record<string, unknown> | undefined;
  const tier = metadata.tier as string | undefined;
  const affectedTenants = metadata.affectedTenants as number | undefined;
  const decreasedLimits = metadata.decreasedLimits as Array<{ field: string; label: string; oldValue: number; newValue: number }> | undefined;

  if (!before && !after) {
    const config = (metadata.config as Record<string, unknown>) ?? (metadata.deletedConfig as Record<string, unknown>) ?? undefined;
    if (!config) return null;
    return (
      <div className="mt-2 bg-[var(--bg-page)] rounded-lg border border-[var(--border-light)] overflow-hidden">
        <table className="w-full text-[11px]">
          <tbody>
            {Object.entries(config).map(([field, value]) => (
              <tr key={field} className="border-b border-[var(--border-light)] last:border-b-0">
                <td className="px-3 py-1.5 text-[var(--text-muted)] font-medium w-36">{TIER_FIELD_LABELS[field] ?? field}</td>
                <td className="px-3 py-1.5 text-[var(--text-body)]">{formatTierValue(field, value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const allFields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

  return (
    <div className="mt-2 space-y-2">
      {tier && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tier}</Badge>
          {affectedTenants !== undefined && affectedTenants > 0 && (
            <span className="text-[11px] text-[var(--text-muted)]">{affectedTenants} tenant{affectedTenants !== 1 ? "s" : ""} affected</span>
          )}
        </div>
      )}

      <div className="bg-[var(--bg-page)] rounded-lg border border-[var(--border-light)] overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[var(--border-light)] bg-[var(--bg-page)]">
              <th className="px-3 py-1.5 text-left text-[var(--text-muted)] font-medium w-36">Field</th>
              <th className="px-3 py-1.5 text-left text-[var(--text-muted)] font-medium">Before</th>
              <th className="px-3 py-1.5 text-left text-[var(--text-muted)] font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(allFields).map((field) => {
              const oldVal = before?.[field];
              const newVal = after?.[field];
              const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);
              const isDecrease = decreasedLimits?.some((d) => d.field === field);

              return (
                <tr key={field} className={`border-b border-[var(--border-light)] last:border-b-0 ${isDecrease ? "bg-red-50/50" : ""}`}>
                  <td className="px-3 py-1.5 text-[var(--text-muted)] font-medium">{TIER_FIELD_LABELS[field] ?? field}</td>
                  <td className={`px-3 py-1.5 ${isChanged ? "line-through text-[var(--text-muted)]" : "text-[var(--text-body)]"}`}>
                    {formatTierValue(field, oldVal)}
                  </td>
                  <td className={`px-3 py-1.5 font-medium ${isDecrease ? "text-red-600" : isChanged ? "text-emerald-600" : "text-[var(--text-body)]"}`}>
                    {formatTierValue(field, newVal)}
                    {isDecrease && " \u2193"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {decreasedLimits && decreasedLimits.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-md px-2.5 py-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Decreased limits may affect {affectedTenants ?? 0} tenant{affectedTenants !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Structured Metadata Renderer
// ---------------------------------------------------------------------------

function StructuredMetadata({ entry }: { entry: AuditLogEntry }) {
  const metadata = entry.metadata as Record<string, unknown> | undefined;

  if (entry.entityType === "tier_config" && metadata) {
    return <TierConfigDiffRenderer metadata={metadata} />;
  }

  const fallback = formatMetadata(entry.metadata ?? entry.newValue);
  if (!fallback) return null;

  return (
    <div className="mt-1.5 text-[11px] text-[var(--text-muted)] font-mono bg-[var(--bg-page)] rounded-md px-2.5 py-1.5 max-w-[600px] truncate">
      {fallback}
    </div>
  );
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
  startDate,
  endDate,
  onActionsChange,
  onEntityTypesChange,
  onActorIdsChange,
  onStartDateChange,
  onEndDateChange,
}: {
  actionTypes: string[];
  entityTypes: string[];
  actors: AuditActor[];
  selectedActions: string[];
  selectedEntityTypes: string[];
  selectedActorIds: string[];
  startDate: string;
  endDate: string;
  onActionsChange: (values: string[]) => void;
  onEntityTypesChange: (values: string[]) => void;
  onActorIdsChange: (values: string[]) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
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

      <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
        <Calendar className="w-3.5 h-3.5" />
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          max={endDate || undefined}
          className="h-8 rounded-lg border border-[var(--border-light)] bg-white px-2 text-[12px] text-[var(--text-body)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/40"
        />
        <span className="text-[var(--text-muted)]">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          min={startDate || undefined}
          className="h-8 rounded-lg border border-[var(--border-light)] bg-white px-2 text-[12px] text-[var(--text-body)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/40"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fraud Radar Section
// ---------------------------------------------------------------------------

function FraudRadarSection() {
  const platformStats = usePlatformStats();
  const fraudResult = useQuery(api.admin.audit.getPlatformFraudSummary, {
    paginationOpts: { numItems: 10, cursor: null },
  });

  const totalFlagged = platformStats?.totalFraudSignals ?? 0;
  const fraudTenants = fraudResult?.page ?? [];
  const isLoadingFraud = fraudResult === undefined;
  const isFraudEmpty = !isLoadingFraud && fraudTenants.length === 0;

  if (!isLoadingFraud && totalFlagged === 0 && isFraudEmpty) return null;

  return (
    <FadeIn delay={30}>
      <div className="bg-white rounded-xl overflow-hidden border border-[var(--border-light)] shadow-sm">
        <div className="px-5 py-4 border-b border-[var(--border-light)] bg-gradient-to-r from-red-50/50 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <Shield className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-heading)]">Fraud Radar</h2>
                <p className="text-[12px] text-[var(--text-muted)]">Tenants with flagged commissions</p>
              </div>
            </div>
            <MetricCard
              label="Flagged"
              numericValue={totalFlagged}
              subtext="platform-wide"
              isLoading={platformStats === undefined}
              variant="red"
              icon={<AlertTriangle className="w-4 h-4" />}
            />
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-red-200/40 to-transparent" />

        {isLoadingFraud ? (
          <div className="divide-y divide-[var(--border-light)]">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-[var(--text-muted)]" />
              </div>
            ))}
          </div>
        ) : isFraudEmpty ? (
          <div className="px-5 py-8 text-center text-[var(--text-muted)] text-sm">
            <Shield className="w-6 h-6 mx-auto mb-2 text-green-400" />
            No fraud signals detected across the platform
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-light)]">
            {fraudTenants.map((tenant) => (
              <Link
                key={tenant.tenantId}
                href={`/tenants/${tenant.tenantId}?tab=overview`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--brand-light)]/20 transition-colors group"
              >
                <span className="text-sm font-medium text-[var(--text-heading)] min-w-0 truncate">
                  {tenant.tenantName}
                </span>
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                  {tenant.commissionsFlagged} flagged
                </Badge>
                <span className="text-[12px] text-[var(--text-muted)] shrink-0">
                  {tenant.commissionsConfirmedThisMonth} confirmed
                </span>
                <span className="text-[12px] text-[var(--text-muted)] shrink-0">
                  {tenant.commissionsPendingCount} pending
                </span>
                <Badge
                  variant={tenant.fraudRate > 0.1 ? "destructive" : tenant.fraudRate > 0.05 ? "warning" : "outline"}
                  className="text-[10px] px-1.5 py-0 shrink-0 ml-auto"
                >
                  {(tenant.fraudRate * 100).toFixed(1)}% rate
                </Badge>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            ))}
          </div>
        )}

        <div className="h-px bg-gradient-to-r from-transparent via-red-200/20 to-transparent" />
      </div>
    </FadeIn>
  );
}

// ---------------------------------------------------------------------------
// Audit Log Row
// ---------------------------------------------------------------------------

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const entityConfig = getEntityConfig(entry.entityType);
  const entityIcon = getEntityIcon(entry.entityType);

  return (
    <div className="group px-5 py-3.5 border-b border-[var(--border-light)] last:border-b-0 hover:bg-[var(--brand-light)]/20 transition-colors">
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5 w-8 h-8 rounded-lg bg-[var(--bg-page)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
          {entityIcon}
        </div>

        <div className="flex-1 min-w-0">
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

          <div className="mt-1 text-[12px] text-[var(--text-muted)]">
            {entry.actorName ? (
              <>by <span className="font-medium text-[var(--text-body)]">{entry.actorName}</span></>
            ) : (
              <>by <span className="italic">System</span></>
            )}
            {entry.tenantName && (
              <>
                {" \u00B7 "}
                <span className="font-medium text-[var(--text-body)]">{entry.tenantName}</span>
              </>
            )}
          </div>

          <StructuredMetadata entry={entry} />

          <div className="mt-1 text-[10px] text-[var(--text-muted)]/60 flex items-center gap-1">
            ID: {entry.entityId}
            {entry.targetId && <> \u00B7 Target: {entry.targetId}</>}
          </div>
        </div>

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
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState("pageSize", parseAsInteger.withDefault(DEFAULT_PAGE_SIZE));
  const [selectedActions, setSelectedActions] = useQueryState("action", parseAsArrayOf(parseAsString).withDefault([]));
  const [selectedEntityTypes, setSelectedEntityTypes] = useQueryState("entity", parseAsArrayOf(parseAsString).withDefault([]));
  const [selectedActorIds, setSelectedActorIds] = useQueryState("actor", parseAsArrayOf(parseAsString).withDefault([]));
  const [startDateStr, setStartDateStr] = useQueryState("from", parseAsString.withDefault(""));
  const [endDateStr, setEndDateStr] = useQueryState("to", parseAsString.withDefault(""));

  const startDate = startDateStr ? new Date(startDateStr + "T00:00:00").getTime() : undefined;
  const endDate = endDateStr ? new Date(endDateStr + "T23:59:59.999").getTime() + 1 : undefined;

  const actionTypes = useQuery(api.admin.audit.getAuditActionTypes, {});
  const entityTypes = useQuery(api.admin.audit.getAuditEntityTypes, {});
  const actors = useQuery(api.admin.audit.getAuditActors, {});

  const result = useQuery(api.admin.audit.listAllAuditLogs, {
    page,
    numItems: pageSize,
    actionFilter: selectedActions.length > 0 ? selectedActions : undefined,
    entityTypeFilter: selectedEntityTypes.length > 0 ? selectedEntityTypes : undefined,
    actorIdFilter: selectedActorIds.length > 0 ? selectedActorIds : undefined,
    startDate,
    endDate,
  });

  useEffect(() => {
    setPage(1);
  }, [selectedActions, selectedEntityTypes, selectedActorIds, startDateStr, endDateStr, setPage]);

  const handleClearAll = useCallback(() => {
    setSelectedActions([]);
    setSelectedEntityTypes([]);
    setSelectedActorIds([]);
    setStartDateStr("");
    setEndDateStr("");
  }, [setSelectedActions, setSelectedEntityTypes, setSelectedActorIds, setStartDateStr, setEndDateStr]);

  const handlePaginationChange = useCallback(
    ({ page: newPage, pageSize: newPageSize }: { page: number; pageSize: number }) => {
      setPage(newPage);
      if (newPageSize !== pageSize) {
        setPageSize(newPageSize);
      }
    },
    [page, pageSize, setPage, setPageSize],
  );

  const isLoading = result === undefined;
  const entries = result?.page ?? [];
  const total = result?.total ?? 0;
  const rawMaxPage = Math.max(1, Math.ceil(total / pageSize));
  const maxPage = isLoading ? Math.max(page, rawMaxPage) : rawMaxPage;

  const filtersReady = actionTypes !== undefined && entityTypes !== undefined && actors !== undefined;
  const hasFilters = selectedActions.length > 0 || selectedEntityTypes.length > 0 || selectedActorIds.length > 0 || startDateStr !== "" || endDateStr !== "";

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
    if (startDateStr) {
      pills.push({ key: "date:from", label: `From: ${startDateStr}` });
    }
    if (endDateStr) {
      pills.push({ key: "date:to", label: `To: ${endDateStr}` });
    }
    return pills;
  })();

  const handlePillRemove = useCallback(
    (key: string) => {
      const [type, value] = key.split(":", 2);
      if (type === "action") setSelectedActions((prev) => prev.filter((v) => v !== value));
      else if (type === "entity") setSelectedEntityTypes((prev) => prev.filter((v) => v !== value));
      else if (type === "actor") setSelectedActorIds((prev) => prev.filter((v) => v !== value));
      else if (type === "date" && value === "from") setStartDateStr("");
      else if (type === "date" && value === "to") setEndDateStr("");
    },
    [setSelectedActions, setSelectedEntityTypes, setSelectedActorIds, setStartDateStr, setEndDateStr],
  );

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <PageTopbar description="Platform-wide audit trail for all tenant operations">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          Audit Log
        </h1>
      </PageTopbar>

      <div className="px-8 pt-6 pb-8">
        <div className="space-y-5">
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

          <FraudRadarSection />

          <FadeIn delay={60}>
            {filtersReady ? (
              <FilterBar
                actionTypes={actionTypes}
                entityTypes={entityTypes}
                actors={actors}
                selectedActions={selectedActions}
                selectedEntityTypes={selectedEntityTypes}
                selectedActorIds={selectedActorIds}
                startDate={startDateStr}
                endDate={endDateStr}
                onActionsChange={setSelectedActions}
                onEntityTypesChange={setSelectedEntityTypes}
                onActorIdsChange={setSelectedActorIds}
                onStartDateChange={setStartDateStr}
                onEndDateChange={setEndDateStr}
              />
            ) : (
              <div className="flex gap-3">
                <Skeleton className="h-8 w-36 rounded-lg" />
                <Skeleton className="h-8 w-32 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            )}
          </FadeIn>

          {hasFilters && (
            <FadeIn delay={90}>
              <FilterPillBar
                pills={filterPills}
                onRemove={handlePillRemove}
                onClearAll={handleClearAll}
              />
            </FadeIn>
          )}

          <FadeIn delay={120}>
            <div className="bg-white rounded-xl overflow-hidden border border-[var(--border-light)] shadow-sm">
              <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/20 to-transparent" />

              {isLoading ? (
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
                <div className="divide-y divide-[var(--border-light)]">
                  {entries.map((entry) => (
                    <AuditLogRow key={entry._id} entry={entry} />
                  ))}
                </div>
              )}

              {!isLoading && entries.length > 0 && (
                <DataTablePagination
                  pagination={{ page, pageSize }}
                  total={total}
                  onPaginationChange={handlePaginationChange}
                  isLoading={isLoading}
                />
              )}

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
