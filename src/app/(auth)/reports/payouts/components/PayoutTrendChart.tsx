"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/affiliate-segments";

interface PayoutTrendChartProps {
  data: Array<{
    month: string;
    monthLabel: string;
    totalAmount: number;
    batchCount: number;
  }>;
  canViewSensitiveData: boolean;
  isLoading?: boolean;
}

export function PayoutTrendChart({
  data,
  canViewSensitiveData,
  isLoading,
}: PayoutTrendChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-52" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    month: d.monthLabel,
    "Total Paid": canViewSensitiveData ? d.totalAmount : 0,
  }));

  const hasData = data.some((d) => d.totalAmount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Payout Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={208}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={60} tickFormatter={(value: number) => `₱${(value/1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(value) => canViewSensitiveData ? formatCurrency(Number(value) || 0) : "—"} 
              />
              <Area type="monotone" dataKey="Total Paid" stroke="#10409a" fill="#10409a" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              No payout data available
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
