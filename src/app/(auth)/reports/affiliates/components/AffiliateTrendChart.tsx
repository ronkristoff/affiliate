"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface TrendDataPoint {
  date: number;
  clicks: number;
  conversions: number;
  commissions: number;
}

interface AffiliateTrendChartProps {
  data: TrendDataPoint[];
  showCommissions?: boolean;
  className?: string;
}

export function AffiliateTrendChart({
  data,
  showCommissions = false,
  className,
}: AffiliateTrendChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const maxClicks = Math.max(...data.map(d => d.clicks), 1);
    const maxConversions = Math.max(...data.map(d => d.conversions), 1);
    const maxCommissions = Math.max(...data.map(d => d.commissions), 1);
    
    const maxValue = showCommissions 
      ? Math.max(maxClicks, maxConversions, maxCommissions)
      : Math.max(maxClicks, maxConversions);

    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const xScale = (index: number) => 
      padding.left + (index / (data.length - 1 || 1)) * chartWidth;
    
    const yScale = (value: number) => 
      padding.top + chartHeight - (value / maxValue) * chartHeight;

    // Generate path for clicks line
    const clicksPath = data.map((d, i) => 
      `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.clicks)}`
    ).join(' ');

    // Generate path for conversions line
    const conversionsPath = data.map((d, i) => 
      `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.conversions)}`
    ).join(' ');

    // Generate path for commissions line (if showing)
    const commissionsPath = showCommissions 
      ? data.map((d, i) => 
          `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.commissions)}`
        ).join(' ')
      : '';

    // Generate area paths
    const clicksAreaPath = clicksPath + 
      ` L ${xScale(data.length - 1)} ${padding.top + chartHeight}` +
      ` L ${padding.left} ${padding.top + chartHeight} Z`;

    // X-axis labels (show max 6 labels)
    const labelStep = Math.ceil(data.length / 6);
    const xLabels = data.filter((_, i) => i % labelStep === 0).map((d, i) => ({
      x: xScale(i * labelStep),
      label: new Date(d.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }),
    }));

    // Y-axis labels (5 labels)
    const yLabels = Array.from({ length: 5 }, (_, i) => ({
      y: padding.top + chartHeight - (i / 4) * chartHeight,
      value: Math.round((maxValue * i) / 4),
    }));

    return {
      width,
      height,
      padding,
      clicksPath,
      conversionsPath,
      commissionsPath,
      clicksAreaPath,
      xLabels,
      yLabels,
    };
  }, [data, showCommissions]);

  if (!chartData || data.length === 0) {
    return (
      <div className={cn("h-[200px] flex items-center justify-center bg-gray-50 rounded-lg", className)}>
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <svg
        viewBox={`0 0 ${chartData.width} ${chartData.height}`}
        className="w-full h-[200px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {chartData.yLabels.map((label, i) => (
          <line
            key={i}
            x1={chartData.padding.left}
            y1={label.y}
            x2={chartData.width - chartData.padding.right}
            y2={label.y}
            stroke="#e5e7eb"
            strokeDasharray="4 4"
          />
        ))}

        {/* Clicks area */}
        <path
          d={chartData.clicksAreaPath}
          fill="url(#clicksGradient)"
          opacity={0.2}
        />

        {/* Clicks line */}
        <path
          d={chartData.clicksPath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
        />

        {/* Conversions line */}
        <path
          d={chartData.conversionsPath}
          fill="none"
          stroke="#10b981"
          strokeWidth={2}
        />

        {/* Commissions line (if showing) */}
        {showCommissions && chartData.commissionsPath && (
          <path
            d={chartData.commissionsPath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={2}
          />
        )}

        {/* Data points for clicks */}
        {data.map((d, i) => (
          <circle
            key={`click-${i}`}
            cx={chartData.padding.left + (i / (data.length - 1 || 1)) * (chartData.width - chartData.padding.left - chartData.padding.right)}
            cy={chartData.padding.top + (chartData.height - chartData.padding.top - chartData.padding.bottom) - (d.clicks / Math.max(...data.map(d => d.clicks), 1)) * (chartData.height - chartData.padding.top - chartData.padding.bottom)}
            r={3}
            fill="#3b82f6"
          />
        ))}

        {/* X-axis labels */}
        {chartData.xLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={chartData.height - 10}
            textAnchor="middle"
            className="text-xs fill-gray-500"
          >
            {label.label}
          </text>
        ))}

        {/* Y-axis labels */}
        {chartData.yLabels.map((label, i) => (
          <text
            key={i}
            x={chartData.padding.left - 10}
            y={label.y + 4}
            textAnchor="end"
            className="text-xs fill-gray-500"
          >
            {label.value}
          </text>
        ))}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="clicksGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
        </defs>
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-600">Clicks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-xs text-gray-600">Conversions</span>
        </div>
        {showCommissions && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs text-gray-600">Commissions</span>
          </div>
        )}
      </div>
    </div>
  );
}
