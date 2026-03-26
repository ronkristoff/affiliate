"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  type TableColumn,
  CurrencyCell,
  DateCell,
  StatusBadgeCell,
} from "@/components/ui/DataTable";
import { Search } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Affiliate {
  _id: string;
  name: string;
  email: string;
  referralCount: number;
  totalEarned: number;
  status: string;
  createdAt: number;
  isFlagged: boolean;
}

interface AffiliatesTabProps {
  tenantId: Id<"tenants">;
}

// ---------------------------------------------------------------------------
// Status config for affiliates (extends the default in StatusBadgeCell)
// ---------------------------------------------------------------------------

const affiliateStatusConfig = {
  active: { label: "Active", dotColor: "#10b981", bgClass: "bg-[#d1fae5]", textClass: "text-[#065f46]" },
  pending: { label: "Pending", dotColor: "#f59e0b", bgClass: "bg-[#fef3c7]", textClass: "text-[#92400e]" },
  suspended: { label: "Suspended", dotColor: "#ef4444", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" },
  rejected: { label: "Rejected", dotColor: "#ef4444", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AffiliatesTab({ tenantId }: AffiliatesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const affiliates = useQuery(api.admin.tenants.getTenantAffiliates, {
    tenantId,
    searchQuery: searchQuery || undefined,
  });

  const isLoading = affiliates === undefined;

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: TableColumn<Affiliate>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Affiliate",
        sortable: true,
        sortField: "name",
        cell: (row) => (
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#333]">{row.name}</span>
            {row.isFlagged && (
              <Badge variant="outline" className="border-[#f59e0b] bg-[#fffbeb] text-[#92400e] text-[10px]">
                Flagged
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "email",
        header: "Email",
        sortable: true,
        sortField: "email",
        cell: (row) => (
          <span className="text-[12px] text-[#6b7280]">{row.email}</span>
        ),
      },
      {
        key: "referralCount",
        header: "Referrals",
        sortable: true,
        sortField: "referralCount",
        align: "right",
        cell: (row) => (
          <span className="text-[12px] tabular-nums text-[#474747]">
            {row.referralCount}
          </span>
        ),
      },
      {
        key: "totalEarned",
        header: "Total Earned",
        sortable: true,
        sortField: "totalEarned",
        align: "right",
        cell: (row) => <CurrencyCell amount={row.totalEarned} />,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        sortField: "status",
        cell: (row) => (
          <StatusBadgeCell status={row.status} statusConfig={affiliateStatusConfig} />
        ),
      },
      {
        key: "createdAt",
        header: "Joined",
        sortable: true,
        sortField: "createdAt",
        cell: (row) => <DateCell value={row.createdAt * 1000} format="short" />,
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable<Affiliate>
        columns={columns}
        data={affiliates ?? []}
        getRowId={(row) => row._id}
        isLoading={isLoading}
        emptyMessage="No affiliates found."
        rowClassName={(row) =>
          row.isFlagged ? "!bg-[#fffbeb] hover:!bg-[#fef9c3]" : ""
        }
      />
    </div>
  );
}
