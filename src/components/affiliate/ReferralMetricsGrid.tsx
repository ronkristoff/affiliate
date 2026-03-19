"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MousePointerClick, ShoppingCart, TrendingUp, DollarSign } from "lucide-react";

interface AffiliateStats {
  totalClicks: number;
  totalConversions: number;
  totalCommissions: number;
  pendingCommissions: number;
  confirmedCommissions: number;
}

interface ReferralMetricsGridProps {
  stats: AffiliateStats | undefined;
}

export function ReferralMetricsGrid({ stats }: ReferralMetricsGridProps) {
  const isLoading = stats === undefined;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Calculate conversion rate
  const conversionRate = stats && stats.totalClicks > 0 
    ? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(1)
    : "0.0";

  const metrics = [
    {
      label: "Total Clicks",
      value: stats?.totalClicks || 0,
      icon: MousePointerClick,
      color: "blue",
    },
    {
      label: "Conversions",
      value: stats?.totalConversions || 0,
      icon: ShoppingCart,
      color: "green",
    },
    {
      label: "Conversion Rate",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: "purple",
    },
    {
      label: "Total Commissions",
      value: formatCurrency(stats?.totalCommissions || 0),
      icon: DollarSign,
      color: "amber",
    },
  ];

  const getColorClasses = (color: string) => {
    const classes: Record<string, { bg: string; text: string }> = {
      blue: { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-600 dark:text-blue-400" },
      green: { bg: "bg-green-100 dark:bg-green-900", text: "text-green-600 dark:text-green-400" },
      purple: { bg: "bg-purple-100 dark:bg-purple-900", text: "text-purple-600 dark:text-purple-400" },
      amber: { bg: "bg-amber-100 dark:bg-amber-900", text: "text-amber-600 dark:text-amber-400" },
    };
    return classes[color] || classes.blue;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const colors = getColorClasses(metric.color);
          return (
            <Card key={metric.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full ${colors.bg} flex items-center justify-center animate-pulse`}>
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-7 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => {
        const colors = getColorClasses(metric.color);
        const Icon = metric.icon;
        
        return (
          <Card key={metric.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full ${colors.bg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${colors.text}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="text-2xl font-semibold">{metric.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
