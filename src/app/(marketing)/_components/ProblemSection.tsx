"use client";

import { TrendingUp, Webhook, RefreshCw, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ProblemSection() {
  const problems = [
    {
      icon: TrendingUp,
      title: "Plan upgrades go untracked",
      description: "When customers upgrade mid-cycle, you manually calculate prorated commissions — if you remember to.",
    },
    {
      icon: Webhook,
      title: "Webhooks you have to maintain",
      description: "Third-party integrations fail silently. You wake up to missed referrals and angry affiliates.",
    },
    {
      icon: RefreshCw,
      title: "Refunds don't reverse commissions",
      description: "A customer gets a refund but the affiliate keeps the commission. Your margins disappear overnight.",
    },
    {
      icon: FileSpreadsheet,
      title: "Spreadsheets break at scale",
      description: "What worked for 50 affiliates falls apart at 500. Data silos, formula errors, and manual exports.",
    },
  ];

  return (
    <section className="py-20 bg-[var(--bg-page)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-heading)] mb-4">
            Managing affiliate commissions manually is{" "}
            <span className="text-[var(--brand-primary)]">costing you</span> — and your affiliates.
          </h2>
          <p className="text-lg text-[var(--text-body)]">
            Most affiliate programs are built on webhooks and spreadsheets. 
            Here's what happens when your business actually scales.
          </p>
        </div>

        {/* Problem Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {problems.map((problem, index) => (
            <Card 
              key={index} 
              className="group border-[var(--border)] hover:border-[var(--brand-primary)]/30 hover:shadow-lg transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-[var(--danger-bg)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <problem.icon className="w-6 h-6 text-[var(--danger-text)]" />
                </div>
                <h3 className="font-semibold text-[var(--text-heading)] mb-2">
                  {problem.title}
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  {problem.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
