"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface TrendDataPoint {
  date: number;
  clicks: number;
  conversions: number;
  commissions: number;
}

interface CampaignTrendChartProps {
  trendData: TrendDataPoint[];
  className?: string;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

// Scaling factor for conversions to make them visible on same chart as clicks
const CONVERSION_SCALE_FACTOR = 10;

export function CampaignTrendChart({
  trendData,
  className,
}: CampaignTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { clicksPoints, conversionsPoints, maxValue } = useMemo(() => {
    if (!trendData || trendData.length === 0) {
      return { clicksPoints: [], conversionsPoints: [], maxValue: 1 };
    }

    const maxClicks = Math.max(...trendData.map((d) => d.clicks), 1);
    const maxConversions = Math.max(...trendData.map((d) => d.conversions), 1);
    const maxValue = Math.max(maxClicks, maxConversions * CONVERSION_SCALE_FACTOR);

    const width = 100;
    const height = 40;
    const padding = 5;

    const clicksPoints = trendData.map((d, i) => ({
      x: padding + (i / (trendData.length - 1)) * (width - 2 * padding),
      y: height - padding - (d.clicks / maxValue) * (height - 2 * padding),
      value: d.clicks,
      date: d.date,
    }));

    const conversionsPoints = trendData.map((d, i) => ({
      x: padding + (i / (trendData.length - 1)) * (width - 2 * padding),
      y: height - padding - ((d.conversions * CONVERSION_SCALE_FACTOR) / maxValue) * (height - 2 * padding),
      value: d.conversions,
      date: d.date,
    }));

    return { clicksPoints, conversionsPoints, maxValue };
  }, [trendData]);

  if (!trendData || trendData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        No trend data available
      </div>
    );
  }

  const clicksPath = clicksPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const conversionsPath = conversionsPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Calculate tooltip position
  const getTooltipData = () => {
    if (hoveredIndex === null || hoveredIndex < 0 || hoveredIndex >= trendData.length) {
      return null;
    }
    return trendData[hoveredIndex];
  };

  const tooltipData = getTooltipData();

  return (
    <div className={cn("h-48 w-full relative", className)}>
      <svg
        viewBox="0 0 100 40"
        className="w-full h-full"
        preserveAspectRatio="none"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Grid lines */}
        <line x1={5} y1={35} x2={95} y2={35} stroke="#e5e7eb" strokeWidth="0.5" />
        <line x1={5} y1={5} x2={5} y2={35} stroke="#e5e7eb" strokeWidth="0.5" />

        {/* Clicks line */}
        <path
          d={clicksPath}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Conversions line (scaled for visibility) */}
        <path
          d={conversionsPath}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover detection areas */}
        {clicksPoints.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r="3"
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
          />
        ))}

        {/* Highlighted points when hovering */}
        {hoveredIndex !== null && (
          <>
            <circle
              cx={clicksPoints[hoveredIndex]?.x}
              cy={clicksPoints[hoveredIndex]?.y}
              r="2"
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth="0.5"
            />
            <circle
              cx={conversionsPoints[hoveredIndex]?.x}
              cy={conversionsPoints[hoveredIndex]?.y}
              r="2"
              fill="#f59e0b"
              stroke="#ffffff"
              strokeWidth="0.5"
            />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {tooltipData && (
        <div className="absolute top-2 right-2 bg-white border rounded-lg shadow-lg p-2 text-xs z-10">
          <p className="font-medium text-gray-700 mb-1">{formatDate(tooltipData.date)}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-600">Clicks:</span>
              <span className="font-semibold">{tooltipData.clicks}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-gray-600">Conversions:</span>
              <span className="font-semibold">{tooltipData.conversions}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>{formatDate(trendData[0]?.date ?? 0)}</span>
        <span>{formatDate(trendData[trendData.length - 1]?.date ?? 0)}</span>
      </div>
    </div>
  );
}
