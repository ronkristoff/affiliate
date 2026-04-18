"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DataTable,
  type TableColumn,
  type TableAction,
  type ColumnFilter,
  type FilterOption,
  CurrencyCell,
  DateCell,
} from "@/components/ui/DataTable";
import { TenantAvatar } from "./TenantAvatar";
import { StatusBadge } from "./StatusBadge";
import { PlanBadge } from "./PlanBadge";
import { Eye } from "lucide-react";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import { cn } from "@/lib/utils";
import { AlertTriangle, XCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TenantSortField =
  | "name"
  | "plan"
  | "subscriptionStatus"
  | "status"
  | "affiliateCount"
  | "mrr"
  | "_creationTime";

interface Tenant {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  domain: string | undefined;
  plan: string;
  status: string;
  subscriptionStatus?: string;
  ownerEmail: string;
  affiliateCount: number;
  mrr: number;
  isFlagged: boolean;
  isBillingOverdue?: boolean;
  isTrialExpired?: boolean;
}

interface TenantTableProps {
  tenants: Tenant[];
  isLoading: boolean;
  total?: number;
  sortField?: TenantSortField;
  sortOrder?: "asc" | "desc";
  onSortChange?: (sortBy: string, sortOrder: "asc" | "desc") => void;
  onViewTenant?: (tenantId: string) => void;
  /** Active column-level filters */
  activeFilters?: ColumnFilter[];
  /** Callback when column filters change */
  onFilterChange?: (filters: ColumnFilter[]) => void;
  /** Pagination state */
  pagination?: { page: number; pageSize: number };
  /** Total items for pagination */
  totalItems?: number;
  /** Pagination change callback */
  onPaginationChange?: (pagination: { page: number; pageSize: number }) => void;
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

const statusFilterOptions: FilterOption[] = [
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "suspended", label: "Suspended" },
];

const planFilterOptions: FilterOption[] = [
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "scale", label: "Scale" },
  { value: "pro", label: "Pro" },
];

const subscriptionStatusFilterOptions: FilterOption[] = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past Due" },
  { value: "cancelled", label: "Cancelled" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TenantTable({
  tenants,
  isLoading,
  total,
  sortField,
  sortOrder,
  onSortChange,
  onViewTenant,
  activeFilters = [],
  onFilterChange,
  pagination,
  totalItems,
  onPaginationChange,
}: TenantTableProps) {
  const router = useRouter();

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: TableColumn<Tenant>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Tenant",
        sortable: true,
        sortField: "name",
        filterable: true,
        filterType: "text",
        filterLabel: "Tenant",
        cell: (row) => (
          <div className="flex items-center gap-3">
            <TenantAvatar name={row.name} />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[var(--text-heading)]">
                {row.name}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {row.domain || row.slug}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "billingAlert",
        header: "",
        sortable: false,
        width: 40,
        hideOnMobile: false,
        cell: (row) => {
          if (row.isTrialExpired) {
            return (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700"
                title="Trial expired"
              >
                <XCircle className="h-3 w-3" />
              </span>
            );
          }
          if (row.isBillingOverdue) {
            return (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                title="Billing issue"
              >
                <AlertTriangle className="h-3 w-3" />
              </span>
            );
          }
          return null;
        },
      },
      {
        key: "plan",
        header: "Plan",
        sortable: true,
        sortField: "plan",
        filterable: true,
        filterType: "select",
        filterOptions: planFilterOptions,
        filterLabel: "Plan",
        cell: (row) => <PlanBadge plan={row.plan} />,
      },
      {
        key: "subscriptionStatus",
        header: "Subscription",
        sortable: true,
        sortField: "subscriptionStatus",
        filterable: true,
        filterType: "select",
        filterOptions: subscriptionStatusFilterOptions,
        filterLabel: "Subscription",
        cell: (row) => <SubscriptionStatusBadge status={row.subscriptionStatus} />,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        sortField: "status",
        filterable: true,
        filterType: "select",
        filterOptions: statusFilterOptions,
        filterLabel: "Status",
        cell: (row) => (
          <StatusBadge
            status={
              row.isFlagged
                ? "flagged"
                : (row.status as "active" | "trial" | "suspended")
            }
          />
        ),
      },
      {
        key: "affiliateCount",
        header: "Affiliates",
        sortable: true,
        sortField: "affiliateCount",
        filterable: true,
        filterType: "number-range",
        filterLabel: "Affiliates",
        filterStep: 1,
        align: "right",
        cell: (row) => (
          <span className="text-[12px] tabular-nums text-[var(--text-heading)]">
            {row.affiliateCount}
          </span>
        ),
      },
      {
        key: "mrr",
        header: "MRR",
        sortable: true,
        sortField: "mrr",
        filterable: true,
        filterType: "number-range",
        filterLabel: "MRR",
        filterStep: 0.01,
        align: "right",
        cell: (row) => <CurrencyCell amount={row.mrr} />,
      },
      {
        key: "created",
        header: "Created",
        sortable: true,
        sortField: "_creationTime",
        filterable: true,
        filterType: "date-range",
        filterLabel: "Created",
        cell: (row) => <DateCell value={row._creationTime} format="short" />,
      },
    ],
    []
  );

  // ── Row actions ──────────────────────────────────────────────────────────
  const actions: TableAction<Tenant>[] = useMemo(
    () => [
      {
        label: "View",
        variant: "info",
        icon: <Eye className="w-3.5 h-3.5" />,
        onClick: (row) => {
          if (onViewTenant) {
            onViewTenant(row._id);
          } else {
            router.push(`/tenants/${row._id}`);
          }
        },
      },
    ],
    [onViewTenant, router]
  );

  return (
    <DataTable<Tenant>
      columns={columns}
      actions={actions}
      data={tenants}
      getRowId={(row) => row._id}
      isLoading={isLoading}
      emptyMessage="No tenants found"
      sortBy={sortField}
      sortOrder={sortOrder}
      onSortChange={onSortChange}
      activeFilters={activeFilters}
      onFilterChange={onFilterChange}
      rowClassName={(row) =>
        row.isTrialExpired
          ? "!border-l-4 !border-l-red-500 !bg-red-50/50"
          : row.isBillingOverdue
            ? "!border-l-4 !border-l-amber-500 !bg-amber-50/50"
            : row.isFlagged
              ? "!bg-[var(--warning-bg)]"
              : ""
      }
      onRowClick={(row) => {
        if (onViewTenant) {
          onViewTenant(row._id);
        } else {
          router.push(`/tenants/${row._id}`);
        }
      }}
      pagination={pagination}
      total={totalItems}
      onPaginationChange={onPaginationChange}
    />
  );
}
