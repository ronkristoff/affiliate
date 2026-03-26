"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
  strokeWidth?: number;
  showArea?: boolean;
  className?: string;
}

/**
 * Lightweight sparkline chart for MetricCards.
 * Renders a simple line chart showing trend data inline.
 */
export function SparklineChart({
  data,
  color = "var(--brand-primary)",
  height = 40,
  strokeWidth = 2,
  showArea = false,
  className = "",
}: SparklineChartProps) {
  // Transform data array into chart-compatible format
  const chartData = data.map((value, index) => ({ value, index }));

  // Don't render if data is empty or too small
  if (!data || data.length < 2) {
    return null;
  }

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          {showArea && (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={strokeWidth}
              fill={color}
              fillOpacity={0.1}
              isAnimationActive={false}
            />
          )}
          {!showArea && (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
