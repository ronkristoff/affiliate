"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumberCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TopLink {
  referralLinkId: string;
  code: string;
  clicks: number;
  conversions: number;
  earnings: number;
}

interface TopLinksRankingProps {
  links: TopLink[] | undefined;
  isLoading: boolean;
}

function truncateSlug(slug: string, maxLen = 28): string {
  if (!slug || slug.length <= maxLen) return slug || "—";
  return slug.slice(0, maxLen - 1) + "...";
}

export function TopLinksRanking({ links, isLoading }: TopLinksRankingProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...(links ?? [])].sort((a, b) => b.conversions - a.conversions);
  const top = sorted.slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top Links</CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No link activity this period.
          </div>
        ) : (
          <div className="space-y-2">
            {top.map((link, i) => (
              <div
                key={link.referralLinkId}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <span
                  className={cn(
                    "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0",
                    i === 0
                      ? "bg-amber-100 text-amber-800"
                      : i === 1
                        ? "bg-gray-100 text-gray-600"
                        : i === 2
                          ? "bg-orange-100 text-orange-700"
                          : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
                  {truncateSlug(link.code)}
                </span>
                <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                  <span className="w-14 text-right">
                    {formatNumberCompact(link.clicks)} clicks
                  </span>
                  <span className="w-20 text-right">
                    {formatNumberCompact(link.conversions)} conv
                  </span>
                  <span className="w-20 text-right font-semibold text-gray-900">
                    {formatCurrency(link.earnings)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
