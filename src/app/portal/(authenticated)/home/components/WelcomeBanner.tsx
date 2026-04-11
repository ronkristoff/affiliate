"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

interface WelcomeBannerProps {
  affiliateName: string;
  totalEarnings: number;
  totalClicks: number;
  totalConversions: number;
  primaryColor?: string;
}

interface GreetingResult {
  greeting: string;
  emoji: string;
}

function getGreeting(): GreetingResult {
  const hour = new Date().getHours();
  if (hour < 12) return { greeting: "Good morning", emoji: "🌅" };
  if (hour < 18) return { greeting: "Good afternoon", emoji: "☀️" };
  return { greeting: "Good evening", emoji: "🌙" };
}

export function WelcomeBanner({
  affiliateName,
  totalEarnings,
  totalClicks,
  totalConversions,
  primaryColor = "#1c2260",
}: WelcomeBannerProps) {
  const [greeting, setGreeting] = useState<GreetingResult>({ greeting: "Hello", emoji: "" });

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-xl p-6 text-white"
      style={{
        background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, 30)} 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-black/10" />
      
      <div className="relative z-10">
        {/* Greeting */}
        <div className="mb-4">
          <h2 className="text-xl font-bold tracking-tight">
            {greeting.greeting}, {affiliateName}! {greeting.emoji}
          </h2>
          <p className="text-white/80 text-sm mt-1">
            Your affiliate program is active — keep sharing!
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <p className="text-white/80 text-xs font-medium uppercase tracking-wide">
              Total Earned
            </p>
            <p className="text-lg font-bold">
              {formatCurrency(totalEarnings)}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <p className="text-white/80 text-xs font-medium uppercase tracking-wide">
              Total Clicks
            </p>
            <p className="text-lg font-bold">
              {totalClicks.toLocaleString()}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <p className="text-white/80 text-xs font-medium uppercase tracking-wide">
              Conversions
            </p>
            <p className="text-lg font-bold">
              {totalConversions.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to adjust color brightness
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}