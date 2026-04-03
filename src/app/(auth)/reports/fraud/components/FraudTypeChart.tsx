"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface FraudTypeChartProps {
  data: { name: string; count: number }[];
}

const COLORS = ["#1c2260", "#1fb5a5", "#3b82f6", "#60a5fa", "#93c5fd"];

export function FraudTypeChart({ data }: FraudTypeChartProps) {
  const hasData = data.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Signals by Type</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={208}>
            <BarChart data={data}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={48} />
              <Tooltip />
              <Bar dataKey="count" fill="#1c2260">
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No fraud signals</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FraudTypeChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-52" />
      </CardContent>
    </Card>
  );
}
