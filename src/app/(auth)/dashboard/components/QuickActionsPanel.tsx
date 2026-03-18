"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserPlus, Wallet, Megaphone, Download } from "lucide-react";
import Link from "next/link";

interface QuickAction {
  label: string;
  subtext: string;
  href: string;
  icon: React.ReactNode;
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
      subtext: "Grow your program",
      href: "/affiliates/invite",
      icon: <UserPlus className="w-5 h-5" />,
    },
    ...(showPayAll
      ? [
          {
            label: "Pay All Pending",
            subtext: pendingCount > 0 ? `${pendingCount} pending` : "No pending",
            href: "/payouts",
            icon: <Wallet className="w-5 h-5" />,
          },
        ]
      : []),
    {
      label: "New Campaign",
      subtext: "Create offer",
      href: "/campaigns/new",
      icon: <Megaphone className="w-5 h-5" />,
    },
    {
      label: "Export Report",
      subtext: "Download CSV",
      href: "/reports?export=true",
      icon: <Download className="w-5 h-5" />,
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Quick Actions
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link key={action.label} href={action.href}>
            <Card className="p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {action.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.subtext}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
