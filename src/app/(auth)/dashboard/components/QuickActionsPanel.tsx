"use client";

import Link from "next/link";

interface QuickAction {
  label: string;
  subtext: string;
  href: string;
  emoji: string;
}

interface QuickActionsPanelProps {
  pendingCount?: number;
  showPayAll?: boolean;
}

export function QuickActionsPanel({
  pendingCount = 0,
  showPayAll = true,
}: QuickActionsPanelProps) {
  const actions: QuickAction[] = [
    {
      label: "Invite Affiliate",
      subtext: "Send by email",
      href: "/affiliates/invite",
      emoji: "📨",
    },
    ...(showPayAll
      ? [
          {
            label: "Pay All",
            subtext: pendingCount > 0 ? `${pendingCount} pending` : "No pending",
            href: "/payouts",
            emoji: "💸",
          },
        ]
      : []),
    {
      label: "New Campaign",
      subtext: "Set commissions",
      href: "/campaigns/new",
      emoji: "🎯",
    },
    {
      label: "Export Report",
      subtext: "CSV download",
      href: "/reports?export=true",
      emoji: "📊",
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Quick Actions</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Link key={action.label} href={action.href}>
              <div className="border border-[var(--border)] rounded-xl p-4 cursor-pointer transition-all hover:border-[var(--brand-secondary)] hover:bg-[#eff6ff] text-center group">
                <div className="text-[24px] mb-2">{action.emoji}</div>
                <div className="text-[12px] font-semibold text-[var(--text-heading)] group-hover:text-[var(--brand-primary)] transition-colors">{action.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{action.subtext}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
