"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";

interface LinkPerformanceCardProps {
  linkData: {
    _id: Id<"referralLinks">;
    affiliateId: Id<"affiliates">;
    clickCount: number;
    conversionCount: number;
    conversionRate: number;
  };
  primaryColor: string;
}

export function LinkPerformanceCard({ linkData, primaryColor }: LinkPerformanceCardProps) {
  // Fetch real 7-day click statistics
  const dailyClicks = useQuery(
    api.referralLinks.getAffiliateDailyClicks,
    { affiliateId: linkData.affiliateId }
  );

  // Calculate earnings (mock calculation - should come from backend in future)
  const earnings = linkData.conversionCount * 50; // Assuming 50 PHP per conversion

  // Show loading state while fetching daily stats
  if (dailyClicks === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Link Performance — Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...dailyClicks.map(d => d.clicks), 1); // Avoid div by zero

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Link Performance — Last 7 Days</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 7-day bar chart */}
        <div className="flex items-end justify-between gap-1 h-24">
          {dailyClicks.map((day, index) => {
            const height = (day.clicks / maxValue) * 100;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${height}%`,
                    backgroundColor: day.isToday ? primaryColor : '#9CA3AF',
                  }}
                />
                <span className="text-xs text-gray-500 mt-1">{day.dayName}</span>
              </div>
            );
          })}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="text-center">
            <div className="text-lg font-bold">{linkData.clickCount}</div>
            <div className="text-xs text-muted-foreground">Total Clicks</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{linkData.conversionCount}</div>
            <div className="text-xs text-muted-foreground">Signups</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{linkData.conversionRate}%</div>
            <div className="text-xs text-muted-foreground">Conversion %</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">₱{earnings.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Earned</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}