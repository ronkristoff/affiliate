"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import { CommissionOverridesSection } from "@/components/dashboard/affiliates";
import {
  Loader2,
  ArrowLeft,
  MousePointerClick,
  ShoppingCart,
  Wallet,
  Users,
} from "lucide-react";

interface AffiliateDetailClientProps {
  affiliateId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function AffiliateDetailClient({
  affiliateId,
}: AffiliateDetailClientProps) {
  const affiliate = useQuery(api.affiliates.getAffiliateWithOverrides, {
    affiliateId: affiliateId as Id<"affiliates">,
  });
  const stats = useQuery(api.affiliates.getAffiliateStats, {
    affiliateId: affiliateId as Id<"affiliates">,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "pending":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            Pending
          </Badge>
        );
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-800">
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!affiliate) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/affiliates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{affiliate.name}</h1>
          <p className="text-muted-foreground text-sm">{affiliate.email}</p>
        </div>
        <div className="ml-auto">{getStatusBadge(affiliate.status)}</div>
      </div>

      {/* Stats Grid */}
      <FadeIn className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Clicks"
          numericValue={stats?.totalClicks ?? 0}
          variant="blue"
          isLoading={!stats}
          icon={<MousePointerClick className="w-4 h-4" />}
        />
        <MetricCard
          label="Conversions"
          numericValue={stats?.totalConversions ?? 0}
          variant="green"
          isLoading={!stats}
          icon={<ShoppingCart className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Earned"
          numericValue={stats?.totalCommissions ?? 0}
          formatValue={formatCurrency}
          variant="yellow"
          isLoading={!stats}
          icon={<Wallet className="w-4 h-4" />}
        />
        <MetricCard
          label="Pending"
          numericValue={stats?.pendingCommissions ?? 0}
          formatValue={formatCurrency}
          variant="gray"
          isLoading={!stats}
          icon={<Users className="w-4 h-4" />}
        />
      </FadeIn>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Affiliate Details</CardTitle>
          <CardDescription>
            Referral code and account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Referral Code
              </p>
              <code className="bg-muted px-2 py-1 rounded text-sm mt-1 inline-block">
                {affiliate.uniqueCode}
              </code>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="mt-1">{getStatusBadge(affiliate.status)}</p>
            </div>
          </div>
          {affiliate.payoutMethod && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Payout Method
                </p>
                <p className="text-sm mt-1 capitalize">
                  {affiliate.payoutMethod.type}
                </p>
                <p className="text-sm text-muted-foreground">
                  {affiliate.payoutMethod.details}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Commission Overrides Section */}
      <CommissionOverridesSection
        affiliateId={affiliateId as Id<"affiliates">}
      />
    </div>
  );
}
