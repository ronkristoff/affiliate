"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumberCompact } from "@/lib/format";
import { Wallet } from "lucide-react";

interface HeroMetricsProps {
  affiliateName: string;
  availableEarnings: number;
  totalEarnings: number;
  pendingEarnings: number;
  totalConversions: number;
  totalClicks: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface StatTile {
  label: string;
  value: string;
}

export function HeroMetrics({
  affiliateName,
  availableEarnings,
  totalEarnings,
  pendingEarnings,
  totalConversions,
  totalClicks,
}: HeroMetricsProps) {
  const router = useRouter();

  const tiles: StatTile[] = [
    { label: "Total Earned", value: formatCurrency(totalEarnings) },
    { label: "Pending", value: formatCurrency(pendingEarnings) },
    { label: "Conversions", value: formatNumberCompact(totalConversions) },
    { label: "Clicks", value: formatNumberCompact(totalClicks) },
  ];

  return (
    <div
      className="relative overflow-hidden rounded-xl p-6 text-white"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, var(--portal-primary, #1c2260) 90%, #000) 0%, color-mix(in srgb, var(--portal-primary, #1c2260) 70%, transparent) 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-black/10" />

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {getGreeting()}, {affiliateName}!
            </h2>
            <p className="text-white/70 text-sm mt-1">
              Here&apos;s how you&apos;re doing today
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide">
                Available to Withdraw
              </p>
              <p className="text-2xl sm:text-3xl font-bold">
                {formatCurrency(availableEarnings)}
              </p>
            </div>
            {availableEarnings > 0 && (
              <Button
                size="sm"
                className="bg-white text-[var(--portal-primary,#1c2260)] hover:bg-white/90 font-semibold"
                onClick={() => router.push("/portal/earnings")}
              >
                <Wallet className="w-4 h-4 mr-1.5" />
                Withdraw
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3"
            >
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide">
                {tile.label}
              </p>
              <p className="text-lg font-bold mt-0.5">{tile.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
