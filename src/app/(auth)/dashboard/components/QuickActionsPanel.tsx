"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Mail, Banknote, Target, BarChart3 } from "lucide-react";

interface QuickActionBase {
  label: string;
  subtext: string;
  href: string;
  icon: LucideIcon;
}

interface QuickActionCallback {
  label: string;
  subtext: string;
  onClick: () => void;
  icon: LucideIcon;
}

type QuickAction = QuickActionBase | QuickActionCallback;

interface QuickActionsPanelProps {
  pendingCount?: number;
  showPayAll?: boolean;
  onInvite?: () => void;
  onCreateCampaign?: () => void;
}

export function QuickActionsPanel({
  pendingCount = 0,
  showPayAll = true,
  onInvite,
  onCreateCampaign,
}: QuickActionsPanelProps) {
  const actions: QuickAction[] = [
    {
      label: "Invite Affiliate",
      subtext: "Send by email",
      ...(onInvite ? { onClick: onInvite } : { href: "/affiliates/invite" }),
      icon: Mail,
    },
    ...(showPayAll
      ? [
          {
            label: "Pay All",
            subtext: pendingCount > 0 ? `${pendingCount} pending` : "No pending",
            href: "/payouts",
            icon: Banknote,
          },
        ]
      : []),
    {
      label: "New Campaign",
      subtext: "Set commissions",
      ...(onCreateCampaign ? { onClick: onCreateCampaign } : { href: "/campaigns/new" }),
      icon: Target,
    },
    {
      label: "Export Report",
      subtext: "CSV download",
      href: "/reports?export=true",
      icon: BarChart3,
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Quick Actions</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return "onClick" in action ? (
              <div
                key={action.label}
                onClick={action.onClick}
                className="border border-[var(--border)] rounded-xl p-4 cursor-pointer transition-all hover:border-[var(--brand-secondary)] hover:bg-[#eff6ff] text-center group"
              >
                <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 rounded-full bg-[#eff6ff] text-[var(--brand-secondary)] group-hover:bg-[var(--brand-secondary)] group-hover:text-white transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-[12px] font-semibold text-[var(--text-heading)] group-hover:text-[var(--brand-primary)] transition-colors">{action.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{action.subtext}</div>
              </div>
            ) : (
              <Link key={action.label} href={action.href}>
                <div className="border border-[var(--border)] rounded-xl p-4 cursor-pointer transition-all hover:border-[var(--brand-secondary)] hover:bg-[#eff6ff] text-center group">
                  <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 rounded-full bg-[#eff6ff] text-[var(--brand-secondary)] group-hover:bg-[var(--brand-secondary)] group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-[12px] font-semibold text-[var(--text-heading)] group-hover:text-[var(--brand-primary)] transition-colors">{action.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{action.subtext}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
