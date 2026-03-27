"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface OverviewChartProps {
  data?: {
    mrrSparkline: number[];
    clicksSparkline: number[];
    conversionsSparkline: number[];
  };
  isLoading?: boolean;
}

export function OverviewChart({ data, isLoading }: OverviewChartProps) {
  const [activeTab, setActiveTab] = useState("revenue");

  const chartData = useMemo(() => {
    if (!data) return [];
    
    // Fallback if sparklines are empty
    const source = (activeTab === "revenue" 
      ? data.mrrSparkline 
      : activeTab === "clicks" 
        ? data.clicksSparkline 
        : data.conversionsSparkline) || [];

    return source.map((value, index) => ({
      name: `Day ${index + 1}`,
      value,
    }));
  }, [data, activeTab]);

  const tabs = [
    { id: "revenue", label: "Revenue", value: activeTab === "revenue" ? formatCurrency(data?.mrrSparkline.reduce((a, b) => a + b, 0) ?? 0) : null },
    { id: "customers", label: "New Customers", value: activeTab === "customers" ? data?.conversionsSparkline.reduce((a, b) => a + b, 0) ?? 0 : null },
    { id: "referrals", label: "New Referrals", value: activeTab === "referrals" ? data?.conversionsSparkline.reduce((a, b) => a + b, 0) ?? 0 : null },
    { id: "clicks", label: "Clicks", value: activeTab === "clicks" ? data?.clicksSparkline.reduce((a, b) => a + b, 0) ?? 0 : null },
    { id: "cancellations", label: "Cancellations", value: 0 },
  ];

  if (isLoading) {
    return (
      <Card className="h-full border-[var(--border-light)] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[var(--border-light)]">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="p-10 flex items-center justify-center">
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full border-[var(--border-light)] overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <CardTitle className="text-[15px] font-bold text-[var(--text-heading)]">Overview</CardTitle>
          <Info className="w-4 h-4 text-[var(--text-muted)] cursor-help" />
        </div>
        <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-muted)] bg-[var(--bg-page)]/50 px-3 py-1.5 rounded-lg border border-[var(--border-light)]">
          Timeframe: Last 30 Days
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 flex flex-col">
        <div className="flex-1 h-[300px] w-full mt-6 px-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10409a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10409a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                hide
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: "var(--text-muted)" }} 
                width={60}
                tickFormatter={(val) => activeTab === "revenue" ? `$${val}` : val}
              />
              <Tooltip 
                contentStyle={{ borderRadius: "12px", border: "1px solid var(--border-light)", boxShadow: "var(--shadow-md)" }}
                formatter={(value: any) => [activeTab === "revenue" ? formatCurrency(Number(value)) : value, activeTab.charAt(0).toUpperCase() + activeTab.slice(1)]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10409a"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorValue)"
                animationDuration={1000}
                activeDot={{ r: 5, strokeWidth: 0, fill: "#10409a" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex border-t border-[var(--border-light)] overflow-x-auto no-scrollbar bg-white">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-4 px-6 transition-all duration-200 border-r border-[var(--border-light)] last:border-r-0 min-w-[140px]",
                activeTab === tab.id 
                  ? "bg-blue-50/30 border-b-2 border-b-[#10409a]" 
                  : "hover:bg-[var(--bg-page)]/30 border-b-2 border-b-transparent"
              )}
            >
              <span className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 px-2 py-0.5 rounded transition-colors", 
                activeTab === tab.id ? "text-[#10409a] bg-blue-50/50" : "text-[var(--text-muted)]")}>
                {tab.label}
              </span>
              <span className={cn("text-[20px] font-bold tabular-nums transition-colors", 
                activeTab === tab.id ? "text-[var(--text-heading)]" : "text-[var(--text-muted)]/70")}>
                {tab.value !== null ? tab.value : (isLoading ? "..." : "0")}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
