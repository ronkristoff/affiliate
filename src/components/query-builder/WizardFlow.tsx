"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { QueryConfig } from "@/hooks/useQueryBuilder";
import {
  TrendingUp,
  BarChart3,
  GitBranch,
  Wallet,
  PieChart,
  Sparkles,
} from "lucide-react";

interface WizardQuestion {
  question: string;
  description: string;
  icon: React.ReactNode;
  config: QueryConfig;
  category: string;
}

const QUESTIONS: WizardQuestion[] = [
  {
    question: "Which affiliates generate the most revenue?",
    description: "See top earners ranked by total commission",
    icon: <TrendingUp className="w-5 h-5" />,
    category: "Revenue",
    config: {
      tables: ["commissions"],
      columns: [
        { table: "commissions", column: "affiliateId", alias: "Affiliate" },
        { table: "commissions", column: "amount", alias: "Amount" },
      ],
      filters: [],
      joins: [],
      aggregations: [
        { id: "w-1", table: "commissions", column: "amount", function: "SUM", alias: "total_revenue" },
        { id: "w-2", table: "commissions", column: "amount", function: "COUNT", alias: "commission_count" },
      ],
      groupBy: [{ table: "commissions", column: "affiliateId" }],
    },
  },
  {
    question: "How are my campaigns performing?",
    description: "Compare campaign types and commission values",
    icon: <BarChart3 className="w-5 h-5" />,
    category: "Campaigns",
    config: {
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
    },
  },
  {
    question: "What does my conversion funnel look like?",
    description: "Count conversions by status to identify drop-offs",
    icon: <GitBranch className="w-5 h-5" />,
    category: "Conversions",
    config: {
      tables: ["conversions"],
      columns: [
        { table: "conversions", column: "status", alias: "Status" },
        { table: "conversions", column: "amount", alias: "Amount" },
      ],
      filters: [],
      joins: [],
      aggregations: [
        { id: "w-3", table: "conversions", column: "amount", function: "COUNT", alias: "count" },
        { id: "w-4", table: "conversions", column: "amount", function: "SUM", alias: "total" },
      ],
      groupBy: [{ table: "conversions", column: "status" }],
    },
  },
  {
    question: "How much have I paid out in total?",
    description: "Payout totals grouped by status and method",
    icon: <Wallet className="w-5 h-5" />,
    category: "Payouts",
    config: {
      tables: ["payouts"],
      columns: [
        { table: "payouts", column: "status", alias: "Status" },
        { table: "payouts", column: "amount", alias: "Amount" },
        { table: "payouts", column: "paymentSource", alias: "Method" },
      ],
      filters: [],
      joins: [],
      aggregations: [
        { id: "w-5", table: "payouts", column: "amount", function: "SUM", alias: "total_paid" },
      ],
      groupBy: [{ table: "payouts", column: "status" }],
    },
  },
];

interface WizardFlowProps {
  onSelectQuestion: (config: QueryConfig) => void;
  onSwitchToAdvanced: () => void;
}

export function WizardFlow({ onSelectQuestion, onSwitchToAdvanced }: WizardFlowProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10409a]/10 to-[#1659d6]/10 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6 text-[#10409a]" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-heading)]">
          What do you want to know?
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Pick a question to get started, or switch to advanced mode for full control.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {QUESTIONS.map((q) => (
          <button
            key={q.question}
            type="button"
            onClick={() => onSelectQuestion(q.config)}
            className="group relative flex flex-col items-start gap-3 rounded-xl border border-[var(--border)] bg-white p-5 text-left transition-all hover:border-[#1659d6]/40 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#10409a]/10 to-[#1659d6]/10 flex items-center justify-center text-[#10409a] group-hover:from-[#10409a] group-hover:to-[#1659d6] group-hover:text-white transition-all shrink-0">
                {q.icon}
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {q.category}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-heading)] group-hover:text-[#10409a] transition-colors">
                {q.question}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {q.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onSwitchToAdvanced}
          className="text-sm text-[#1659d6] hover:text-[#10409a] font-medium transition-colors"
        >
          Switch to Advanced Mode for full query control
        </button>
      </div>
    </div>
  );
}
