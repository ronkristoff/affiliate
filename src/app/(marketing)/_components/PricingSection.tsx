"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);
  const allTiers = useQuery(api.tierConfig.getAllTierConfigs);

  const getPrice = (monthlyPrice: number) => {
    if (isAnnual) {
      // Annual = monthly × 10 (2 months free)
      return Math.round(monthlyPrice * 10);
    }
    return monthlyPrice;
  };

  const formatLimit = (value: number): string => {
    if (value === -1) return "Unlimited";
    return value.toLocaleString();
  };

  // Generate feature list from tier config data
  const generateFeatures = (tier: {
    maxAffiliates: number;
    maxCampaigns: number;
    maxTeamMembers: number;
    maxPayoutsPerMonth: number;
    features: {
      advancedAnalytics: boolean;
      prioritySupport: boolean;
    };
  }): string[] => {
    const features: string[] = [];
    features.push(`Up to ${formatLimit(tier.maxAffiliates)} affiliates`);
    features.push(`${formatLimit(tier.maxCampaigns)} campaign${tier.maxCampaigns !== 1 ? "s" : ""}`);
    features.push(`${formatLimit(tier.maxTeamMembers)} team member${tier.maxTeamMembers !== 1 ? "s" : ""}`);
    features.push(`${formatLimit(tier.maxPayoutsPerMonth)} payouts/month`);
    if (tier.features.advancedAnalytics) {
      features.push("Advanced analytics");
    }
    if (tier.features.prioritySupport) {
      features.push("Priority support");
    }
    features.push("14-day free trial");
    return features;
  };

  // Get description based on tier position
  const getDescription = (index: number, total: number): string => {
    if (total <= 1) return "Flexible affiliate marketing for your business.";
    if (index === 0) return "Perfect for small teams getting started with affiliate marketing.";
    if (index === total - 1) return "For enterprises with complex affiliate program needs.";
    return "For growing businesses ready to scale their affiliate program.";
  };

  // Determine which tier to highlight (middle tier, or second-to-last)
  const getHighlightedIndex = (total: number): number => {
    if (total <= 1) return 0;
    if (total === 2) return 1;
    return Math.floor(total / 2);
  };

  if (allTiers === undefined) {
    return (
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary)]" />
          </div>
        </div>
      </section>
    );
  }

  const highlightedIndex = getHighlightedIndex(allTiers.length);

  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[var(--brand-light)] text-[var(--brand-primary)] text-sm font-medium mb-4">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-heading)] mb-4">
            Simple, transparent{" "}
            <span className="text-[var(--brand-primary)]">pricing</span>
          </h2>
          <p className="text-lg text-[var(--text-body)]">
            Start free, scale as you grow. No hidden fees, no surprises.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={cn("text-sm font-medium", !isAnnual ? 'text-[var(--text-heading)]' : 'text-[var(--text-muted)]')}>
            Monthly
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
            aria-label="Toggle annual billing"
          />
          <span className={cn("text-sm font-medium", isAnnual ? 'text-[var(--text-heading)]' : 'text-[var(--text-muted)]')}>
            Annual
          </span>
          {isAnnual && (
            <span className="px-3 py-1 rounded-full bg-[var(--success-bg)] text-[var(--success-text)] text-xs font-medium">
              Save 17%
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className={cn(
          "gap-8 max-w-5xl mx-auto",
          allTiers.length <= 3 ? "grid md:grid-cols-3" : "grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}>
          {allTiers.map((tier, index) => {
            const isHighlighted = index === highlightedIndex;
            const features = generateFeatures(tier);

            return (
              <Card
                key={tier.tier}
                className={`relative ${
                  isHighlighted
                    ? 'border-[var(--brand-primary)] shadow-lg scale-[1.04]'
                    : 'border-[var(--border)]'
                }`}
              >
                {isHighlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[var(--brand-primary)] text-white text-sm font-medium rounded-full">
                    Most Popular
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="font-semibold text-xl text-[var(--text-heading)] mb-2">
                    {tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1)}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4">
                    {getDescription(index, allTiers.length)}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    {tier.price === 0 ? (
                      <div>
                        <span className="text-4xl font-bold text-[var(--text-heading)]">Free</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-4xl font-bold text-[var(--text-heading)]">
                          ₱{getPrice(tier.price).toLocaleString()}
                        </span>
                        <span className="text-[var(--text-muted)]">/{isAnnual ? 'year' : 'month'}</span>
                      </div>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div>
                      <span className="text-[var(--text-muted)]">Affiliates:</span>
                      <span className="font-medium text-[var(--text-heading)] ml-1">{formatLimit(tier.maxAffiliates)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Campaigns:</span>
                      <span className="font-medium text-[var(--text-heading)] ml-1">{formatLimit(tier.maxCampaigns)}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {features.map((feature, featureIndex) => (
                      <li key={`${tier.tier}-${featureIndex}`} className="flex items-start gap-2 text-sm">
                        <Check className="w-5 h-5 text-[var(--success)] flex-shrink-0 mt-0.5" />
                        <span className="text-[var(--text-body)]">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link href="/sign-up" className="block">
                    <Button 
                      className={`w-full font-semibold min-h-[44px] ${
                        isHighlighted
                          ? 'bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white'
                          : 'bg-[var(--bg-page)] hover:bg-[var(--border)] text-[var(--text-heading)]'
                      }`}
                    >
                      {tier.price === 0 ? "Get Started Free" : "Start free trial"}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Enterprise Callout */}
        <div className="text-center mt-12">
          <p className="text-[var(--text-muted)]">
            Need something custom?{" "}
            <Link href="mailto:hello@saligaffiliate.com" className="text-[var(--brand-primary)] font-medium hover:underline">
              Contact us
            </Link>{" "}
            for enterprise pricing.
          </p>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            All plans include 14-day free trial with full Scale tier access.
          </p>
        </div>
      </div>
    </section>
  );
}
