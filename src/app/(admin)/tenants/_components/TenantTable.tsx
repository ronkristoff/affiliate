"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TenantAvatar } from "./TenantAvatar";
import { StatusBadge } from "./StatusBadge";
import { PlanBadge } from "./PlanBadge";
import { Loader2 } from "lucide-react";

export type SortField = "name" | "plan" | "status" | "affiliateCount" | "mrr" | "_creationTime";
export type SortOrder = "asc" | "desc";

interface Tenant {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  domain: string | undefined;
  plan: string;
  status: string;
  ownerEmail: string;
  affiliateCount: number;
  mrr: number;
  isFlagged: boolean;
}

interface TenantTableProps {
  tenants: Tenant[];
  isLoading: boolean;
  total?: number;
  sortField?: SortField;
  sortOrder?: SortOrder;
  onSort?: (field: SortField) => void;
  onViewTenant?: (tenantId: string) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function SkeletonRow() {
  return (
    <TableRow>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </TableCell>
      ))}
    </TableRow>
  );
}

interface SortableHeaderProps {
  field: SortField;
  label: string;
  currentSortField?: SortField;
  currentSortOrder?: SortOrder;
  onSort?: (field: SortField) => void;
  align?: "left" | "right";
}

function SortableHeader({
  field,
  label,
  currentSortField,
  currentSortOrder,
  onSort,
  align = "left",
}: SortableHeaderProps) {
  const isActive = currentSortField === field;

  return (
    <TableHead
      className={cn(
        "px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280] cursor-pointer select-none hover:bg-[#f3f4f6] transition-colors",
        align === "right" && "text-right"
      )}
      onClick={() => onSort?.(field)}
    >
      <div className={cn("flex items-center gap-1", align === "right" && "justify-end")}>
        {label}
        {isActive ? (
          currentSortOrder === "asc" ? (
            <ArrowUp className="h-3 w-3 text-[#10409a]" />
          ) : (
            <ArrowDown className="h-3 w-3 text-[#10409a]" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-[#9ca3af] opacity-0 group-hover:opacity-100" />
        )}
      </div>
    </TableHead>
  );
}

export function TenantTable({
  tenants,
  isLoading,
  total,
  sortField,
  sortOrder,
  onSort,
  onViewTenant,
}: TenantTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#f9fafb] hover:bg-[#f9fafb] group">
            <SortableHeader
              field="name"
              label="Tenant"
              currentSortField={sortField}
              currentSortOrder={sortOrder}
              onSort={onSort}
            />
            <SortableHeader
              field="plan"
              label="Plan"
              currentSortField={sortField}
              currentSortOrder={sortOrder}
              onSort={onSort}
            />
            <SortableHeader
              field="status"
              label="Status"
              currentSortField={sortField}
              currentSortOrder={sortOrder}
              onSort={onSort}
            />
            <SortableHeader
              field="affiliateCount"
              label="Affiliates"
              currentSortField={sortField}
              currentSortOrder={sortOrder}
              onSort={onSort}
              align="right"
            />
            <SortableHeader
              field="mrr"
              label="MRR"
              currentSortField={sortField}
              currentSortOrder={sortOrder}
              onSort={onSort}
              align="right"
            />
            <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280] text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          )}
          {!isLoading && tenants.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No tenants found.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && tenants.length > 0 && tenants.map((tenant) => (
              <TableRow
                key={tenant._id}
                className={cn(
                  "border-b border-[#e5e7eb] last:border-0",
                  tenant.isFlagged && "bg-[#fefce8] hover:bg-[#fef9c3]"
                )}
              >
                {/* Tenant Column */}
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <TenantAvatar name={tenant.name} />
                    <div>
                      <div className="text-sm font-medium text-[#333333]">
                        {tenant.name}
                      </div>
                      <div className="text-xs text-[#6b7280]">
                        {tenant.domain || tenant.slug}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Plan */}
                <TableCell className="px-4 py-3">
                  <PlanBadge plan={tenant.plan} />
                </TableCell>

                {/* Status */}
                <TableCell className="px-4 py-3">
                  <StatusBadge
                    status={
                      tenant.isFlagged
                        ? "flagged"
                        : (tenant.status as "active" | "trial" | "suspended")
                    }
                  />
                </TableCell>

                {/* Affiliates */}
                <TableCell className="px-4 py-3 text-right text-sm text-[#333333]">
                  {tenant.affiliateCount}
                </TableCell>

                {/* MRR */}
                <TableCell className="px-4 py-3 text-right text-sm font-medium text-[#333333]">
                  {formatCurrency(tenant.mrr)}
                </TableCell>

                {/* Actions */}
                <TableCell className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[#10409a] hover:bg-[#10409a]/10 hover:text-[#10409a]"
                    onClick={() => onViewTenant?.(tenant._id)}
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
