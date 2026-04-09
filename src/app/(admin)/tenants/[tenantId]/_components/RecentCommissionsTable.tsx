"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import {
  DataTable,
  type TableColumn,
  CurrencyCell,
} from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AdminCommissionDrawer } from "./AdminCommissionDrawer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Commission {
  _id: string;
  affiliateName: string;
  campaignName: string;
  amount: number;
  status: string;
  createdAt: number;
}

interface RecentCommissionsTableProps {
  commissions: Commission[];
  isLoading: boolean;
  tenantId: Id<"tenants">;
}

// ---------------------------------------------------------------------------
// Status config for commissions
// ---------------------------------------------------------------------------

const commissionStatusConfig: Record<
  string,
  { label: string; dotColor: string; bgClass: string; textClass: string }
> = {
  approved: { label: "Approved", dotColor: "#10b981", bgClass: "bg-[#dcfce7]", textClass: "text-[#166534]" },
  pending: { label: "Pending", dotColor: "#f59e0b", bgClass: "bg-[#fef3c7]", textClass: "text-[#92400e]" },
  paid: { label: "Paid", dotColor: "#3b82f6", bgClass: "bg-[#dbeafe]", textClass: "text-[#1e40af]" },
  reversed: { label: "Reversed", dotColor: "#ef4444", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" },
  declined: { label: "Declined", dotColor: "#ef4444", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" },
};

// ---------------------------------------------------------------------------
// Relative date helper
// ---------------------------------------------------------------------------

function RelativeDateCell({ value }: { value: number }) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const label =
    diffDays === 0
      ? "Today"
      : diffDays === 1
        ? "Yesterday"
        : diffDays < 7
          ? `${diffDays}d ago`
          : date.toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
            });

  return <span className="text-[12px] text-[#6b7280]">{label}</span>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecentCommissionsTable({
  commissions,
  isLoading,
  tenantId,
}: RecentCommissionsTableProps) {
  const [selectedCommissionId, setSelectedCommissionId] = useState<string | null>(null);

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: TableColumn<Commission>[] = [
    {
      key: "affiliateName",
      header: "Affiliate",
      sortable: true,
      sortField: "affiliateName",
      cell: (row) => (
        <span className="text-[13px] font-medium text-[#333]">
          {row.affiliateName}
        </span>
      ),
    },
    {
      key: "campaignName",
      header: "Campaign",
      sortable: true,
      sortField: "campaignName",
      cell: (row) => (
        <span className="text-[12px] text-[#6b7280]">{row.campaignName}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortField: "amount",
      align: "right",
      cell: (row) => <CurrencyCell amount={row.amount} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortField: "status",
      cell: (row) => {
        const config = commissionStatusConfig[row.status] ?? {
          label: row.status,
          dotColor: "#6b7280",
          bgClass: "bg-[#f3f4f6]",
          textClass: "text-[#374151]",
        };
        return (
          <Badge
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
              config.bgClass,
              config.textClass
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: config.dotColor }}
            />
            {config.label}
          </Badge>
        );
      },
    },
    {
      key: "createdAt",
      header: "Date",
      sortable: true,
      sortField: "createdAt",
      cell: (row) => <RelativeDateCell value={row.createdAt * 1000} />,
    },
  ];

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#111827]">
          Recent Commissions
        </h2>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-xs text-[#6b7280] hover:text-[#1c2260]"
        >
          <Link href={`/tenants/${tenantId}?tab=payouts`}>View All</Link>
        </Button>
      </div>

      <DataTable<Commission>
        columns={columns}
        data={commissions}
        getRowId={(row) => row._id}
        isLoading={isLoading}
        emptyMessage="No commissions yet. Commissions will appear here once affiliates start generating sales."
        hidePagination
        onRowClick={(row) => setSelectedCommissionId(row._id)}
        rowClassName={() => "cursor-pointer"}
      />

      <AdminCommissionDrawer
        tenantId={tenantId}
        commissionId={selectedCommissionId}
        isOpen={!!selectedCommissionId}
        onClose={() => setSelectedCommissionId(null)}
      />
    </div>
  );
}
