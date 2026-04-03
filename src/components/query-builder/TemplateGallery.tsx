"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QueryConfig } from "@/hooks/useQueryBuilder";
import {
  TrendingUp,
  BarChart3,
  GitBranch,
  Wallet,
  PieChart,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  config: QueryConfig;
}

// Helper to create a full QueryConfig with sensible defaults for new fields
function tpl(config: Omit<QueryConfig, "filterLogic" | "rowLimit">): QueryConfig {
  return { ...config, filterLogic: "and", rowLimit: 100 };
}

const TEMPLATES: Template[] = [
  {
    id: "top-affiliates",
    name: "Top Affiliates by Revenue",
    description: "See which affiliates generate the most commission revenue",
    icon: <TrendingUp className="w-5 h-5" />,
    config: tpl({
      tables: ["commissions"],
      columns: [
        { table: "commissions", column: "affiliateId", alias: "Affiliate" },
        { table: "commissions", column: "amount", alias: "Amount" },
      ],
      filters: [],
      joins: [],
      aggregations: [
        { id: "tpl-1", table: "commissions", column: "amount", function: "SUM", alias: "total_revenue" },
        { id: "tpl-2", table: "commissions", column: "amount", function: "COUNT", alias: "commission_count" },
      ],
      groupBy: [{ table: "commissions", column: "affiliateId" }],
    }),
  },
  {
    id: "campaign-performance",
    name: "Campaign Performance Summary",
    description: "Compare campaign metrics including clicks and conversions",
    icon: <BarChart3 className="w-5 h-5" />,
    config: tpl({
      tables: ["campaigns"],
      columns: [
        { table: "campaigns", column: "name", alias: "Campaign" },
        { table: "campaigns", column: "status", alias: "Status" },
        { table: "campaigns", column: "commissionType", alias: "Type" },
        { table: "campaigns", column: "commissionValue", alias: "Value" },
      ],
      filters: [],
      joins: [],
      aggregations: [],
      groupBy: [],
    }),
  },
  {
    id: "conversion-funnel",
    name: "Conversion Funnel Analysis",
    description: "Count conversions grouped by status to see your funnel",
    icon: <GitBranch className="w-5 h-5" />,
    config: tpl({
      tables: ["conversions"],
      columns: [
        { table: "conversions", column: "status", alias: "Status" },
        { table: "conversions", column: "amount", alias: "Amount" },
      ],
      filters: [],
      joins: [],
      aggregations: [
        { id: "tpl-3", table: "conversions", column: "amount", function: "COUNT", alias: "conversion_count" },
        { id: "tpl-4", table: "conversions", column: "amount", function: "SUM", alias: "total_amount" },
      ],
      groupBy: [{ table: "conversions", column: "status" }],
    }),
  },
  {
    id: "payout-history",
    name: "Payout History",
    description: "Sum of payout amounts grouped by status",
    icon: <Wallet className="w-5 h-5" />,
    config: tpl({
      tables: ["payouts"],
      columns: [
        { table: "payouts", column: "status", alias: "Status" },
        { table: "payouts", column: "amount", alias: "Amount" },
        { table: "payouts", column: "paymentSource", alias: "Method" },
      ],
      filters: [],
      joins: [],
      aggregations: [
        { id: "tpl-5", table: "payouts", column: "amount", function: "SUM", alias: "total_paid" },
        { id: "tpl-6", table: "payouts", column: "amount", function: "COUNT", alias: "payout_count" },
      ],
      groupBy: [{ table: "payouts", column: "status" }],
    }),
  },
  {
    id: "commission-breakdown",
    name: "Commission Status Breakdown",
    description: "Count and sum of commissions by their current status",
    icon: <PieChart className="w-5 h-5" />,
    config: tpl({
      tables: ["commissions"],
      columns: [
        { table: "commissions", column: "status", alias: "Status" },
        { table: "commissions", column: "amount", alias: "Amount" },
        { table: "commissions", column: "isSelfReferral", alias: "Self Referral" },
      ],
      filters: [],
      joins: [],
      aggregations: [
        { id: "tpl-7", table: "commissions", column: "amount", function: "COUNT", alias: "count" },
        { id: "tpl-8", table: "commissions", column: "amount", function: "SUM", alias: "total" },
      ],
      groupBy: [{ table: "commissions", column: "status" }],
    }),
  },
];

interface TemplateGalleryProps {
  onSelectTemplate: (config: QueryConfig) => void;
}

export function TemplateGallery({ onSelectTemplate }: TemplateGalleryProps) {
  return (
    <div className="space-y-2">
      {TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => onSelectTemplate(template.config)}
          className="group w-full flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white p-3 text-left transition-all hover:border-[#1fb5a5]/40 hover:shadow-sm"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1c2260]/10 to-[#1fb5a5]/10 flex items-center justify-center text-[#1c2260] shrink-0 group-hover:from-[#1c2260]/20 group-hover:to-[#1fb5a5]/20 transition-colors">
            {template.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[var(--text-heading)] group-hover:text-[#1c2260] transition-colors">
              {template.name}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2">
              {template.description}
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {template.config.tables.map((t) => (
                <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0">
                  {t}
                </Badge>
              ))}
              {template.config.aggregations.length > 0 && (
                <Badge variant="brand" className="text-[9px] px-1.5 py-0">
                  {template.config.aggregations.map((a) => a.function).join(", ")}
                </Badge>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
