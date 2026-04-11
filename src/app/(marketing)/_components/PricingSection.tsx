"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, ArrowRight, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useDefaultTrialDays } from "@/hooks/useDefaultTrialDays";

export function PricingSection() {
  const trialDays = useDefaultTrialDays();
  const [isAnnual, setIsAnnual] = useState(false);
  const allTiers = useQuery(api.tierConfig.getAllTierConfigs);

  const getPrice = (monthlyPrice: number) => {
    if (isAnnual) {
      return Math.round(monthlyPrice * 10);
    }
    return monthlyPrice;
  };

  const formatLimit = (value: number): string => {
    if (value === -1) return "Unlimited";
    return value.toLocaleString();
  };

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
    features.push(`${trialDays}-day free trial`);
    return features;
  };

  const getDescription = (index: number, total: number): string => {
    if (total <= 1) return "Flexible affiliate marketing for your business.";
    if (index === 0) return "Perfect for small teams getting started with affiliate marketing.";
    if (index === total - 1) return "For enterprises with complex affiliate program needs.";
    return "For growing businesses ready to scale their affiliate program.";
  };

  const getHighlightedIndex = (total: number): number => {
    if (total <= 1) return 0;
    if (total === 2) return 1;
    return Math.floor(total / 2);
  };

  if (allTiers === undefined) {
    return (
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#1c2260]" />
          </div>
        </div>
      </section>
    );
  }

  const highlightedIndex = getHighlightedIndex(allTiers.length);

  return (
    <section id="pricing" className="py-24 bg-[#f8fafc] relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#1c2260] to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1c2260]/10 text-[#1c2260] text-sm font-bold mb-6">
            <Zap className="w-4 h-4" />
            Pricing
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#1c2260] mb-6 leading-[1.05]">
            Simple, transparent{" "}
            <span className="text-[#0e1333]">pricing</span>
          </h2>
          <p className="text-xl text-[#6b7280]">
            Start free, scale as you grow. No hidden fees, no surprises.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-16">
          <span className={cn("text-sm font-bold", !isAnnual ? 'text-[#1c2260]' : 'text-[#6b7280]')}>
            Monthly
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
            aria-label="Toggle annual billing"
            className="data-[state=checked]:bg-[#1c2260] data-[state=unchecked]:bg-[#e5e7eb]"
          />
          <span className={cn("text-sm font-bold", isAnnual ? 'text-[#1c2260]' : 'text-[#6b7280]')}>
            Annual
          </span>
          {isAnnual && (
            <span className="px-3 py-1 rounded-full bg-[#10b981] text-white text-xs font-bold">
              Save 17%
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {allTiers.map((tier, index) => {
            const isHighlighted = index === highlightedIndex;
            const features = generateFeatures(tier);

            return (
              <div
                key={tier.tier}
                className="relative"
              >
                {/* Featured badge */}
                {isHighlighted && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
                    <div className="px-4 py-1.5 bg-[#1c2260] text-white text-xs font-bold rounded-full shadow-lg">
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Card */}
                <div 
                  className={cn(
                    "relative h-full rounded-3xl transition-all duration-500",
                    isHighlighted 
                      ? "bg-[#0e1333] text-white scale-[1.05] shadow-2xl shadow-[#0e1333]/20 animate-[glow_3s_ease-in-out_infinite]" 
                      : "bg-white border-2 border-[#e5e7eb] hover:border-[#1c2260]/30 hover:shadow-xl"
                  )}
                >

                  <div className={cn("p-8", isHighlighted ? "pt-12" : "")}>
                    {/* Tier name */}
                    <div className="mb-6">
                      <h3 className={cn(
                        "text-2xl font-black mb-2",
                        isHighlighted ? "text-white" : "text-[#333333]"
                      )}>
                        {tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1)}
                      </h3>
                      <p className={cn(
                        "text-sm leading-relaxed",
                        isHighlighted ? "text-white/70" : "text-[#6b7280]"
                      )}>
                        {getDescription(index, allTiers.length)}
                      </p>
                    </div>

                    {/* Price - dramatic display */}
                    <div className="mb-8">
                      {tier.price === 0 ? (
                        <div className="flex items-baseline gap-2">
                          <span className={cn("text-5xl font-black", isHighlighted ? "text-white" : "text-[#0e1333]")}>Free</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-2">
                          <span className={cn("text-5xl font-black", isHighlighted ? "text-white" : "text-[#0e1333]")}>
                            ₱{getPrice(tier.price).toLocaleString()}
                          </span>
                          <span className={cn(
                            "text-sm font-medium",
                            isHighlighted ? "text-white/60" : "text-[#6b7280]"
                          )}>
                            /{isAnnual ? 'year' : 'month'}
                          </span>
                        </div>
                      )}
                      {isAnnual && tier.price > 0 && (
                        <p className="text-xs text-[#22d3ee] font-medium mt-1">
                          2 months free
                        </p>
                      )}
                    </div>

                    {/* Limits */}
                    <div className={cn(
                      "grid grid-cols-2 gap-3 mb-8 p-4 rounded-2xl",
                      isHighlighted ? "bg-white/5" : "bg-[#f8fafc]"
                    )}>
                      <div>
                        <div className={cn(
                          "text-xs font-medium mb-1",
                          isHighlighted ? "text-white/60" : "text-[#6b7280]"
                        )}>
                          Affiliates
                        </div>
                        <div className={cn(
                          "text-lg font-black",
                          isHighlighted ? "text-white" : "text-[#333333]"
                        )}>
                          {formatLimit(tier.maxAffiliates)}
                        </div>
                      </div>
                      <div>
                        <div className={cn(
                          "text-xs font-medium mb-1",
                          isHighlighted ? "text-white/60" : "text-[#6b7280]"
                        )}>
                          Campaigns
                        </div>
                        <div className={cn(
                          "text-lg font-black",
                          isHighlighted ? "text-white" : "text-[#333333]"
                        )}>
                          {formatLimit(tier.maxCampaigns)}
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-3 mb-8">
                      {features.map((feature, featureIndex) => (
                        <li 
                          key={`${tier.tier}-${featureIndex}`} 
                          className="flex items-start gap-3"
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                            isHighlighted ? "bg-[#22d3ee]/20" : "bg-[#10b981]/10"
                          )}>
                            <Check className={cn(
                              "w-3 h-3",
                              isHighlighted ? "text-[#22d3ee]" : "text-[#10b981]"
                            )} />
                          </div>
                          <span className={cn(
                            "text-sm",
                            isHighlighted ? "text-white/90" : "text-[#6b7280]"
                          )}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link href="/sign-up" className="block">
                      <Button 
                        className={cn(
                          "w-full font-bold min-h-[52px] text-base rounded-xl transition-all duration-300",
                          isHighlighted
                            ? "bg-white text-[#0e1333] hover:bg-white/90 shadow-lg"
                            : "bg-[#1c2260] text-white hover:bg-[#161c50]"
                        )}
                      >
                        {tier.price === 0 ? "Get Started Free" : "Start free trial"}
                        <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise Callout */}
        <div className="text-center mt-16">
          <p className="text-[#6b7280]">
            Need something custom?{" "}
            <Link href="mailto:hello@saligaffiliate.com" className="text-[#1c2260] font-bold hover:underline">
              Contact us
            </Link>{" "}
            for enterprise pricing.
          </p>
          <p className="text-sm text-[#6b7280]/70 mt-2">
            All plans include {trialDays}-day free trial with full Scale tier access.
          </p>
        </div>
      </div>
    </section>
  );
}