"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface PricingTier {
  name: string;
  monthlyPrice: number;
  description: string;
  features: string[];
  affiliateLimit: string;
  campaignLimit: string;
  highlighted?: boolean;
  customDomain?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: "Starter",
    monthlyPrice: 1999,
    description: "Perfect for small teams getting started with affiliate marketing.",
    affiliateLimit: "1,000",
    campaignLimit: "3",
    features: [
      "Up to 1,000 affiliates",
      "3 campaigns",
      "Native SaligPay integration",
      "Basic reporting",
      "Email support",
      "14-day free trial",
    ],
  },
  {
    name: "Growth",
    monthlyPrice: 4499,
    description: "For growing businesses ready to scale their affiliate program.",
    affiliateLimit: "5,000",
    campaignLimit: "10",
    highlighted: true,
    features: [
      "Up to 5,000 affiliates",
      "10 campaigns",
      "Everything in Starter",
      "Advanced analytics",
      "Priority support",
      "Custom affiliate portal",
      "A/B testing",
      "API access",
    ],
  },
  {
    name: "Scale",
    monthlyPrice: 8999,
    description: "For enterprises with complex affiliate program needs.",
    affiliateLimit: "Unlimited",
    campaignLimit: "Unlimited",
    customDomain: true,
    features: [
      "Unlimited affiliates",
      "Unlimited campaigns",
      "Everything in Growth",
      "Custom domain",
      "Dedicated account manager",
      "SLA guarantee",
      "Custom integrations",
      "White-label options",
    ],
  },
];

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);

  const getPrice = (monthlyPrice: number) => {
    if (isAnnual) {
      // Annual = monthly × 10 (2 months free)
      return Math.round(monthlyPrice * 10);
    }
    return monthlyPrice;
  };

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
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={`relative ${
                tier.highlighted
                  ? 'border-[var(--brand-primary)] shadow-lg scale-[1.04]'
                  : 'border-[var(--border)]'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[var(--brand-primary)] text-white text-sm font-medium rounded-full">
                  Most Popular
                </div>
              )}
              <CardContent className="p-8">
                <h3 className="font-semibold text-xl text-[var(--text-heading)] mb-2">
                  {tier.name}
                </h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  {tier.description}
                </p>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[var(--text-heading)]">
                    ₱{getPrice(tier.monthlyPrice).toLocaleString()}
                  </span>
                  <span className="text-[var(--text-muted)]">/{isAnnual ? 'year' : 'month'}</span>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <span className="text-[var(--text-muted)]">Affiliates:</span>
                    <span className="font-medium text-[var(--text-heading)] ml-1">{tier.affiliateLimit}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Campaigns:</span>
                    <span className="font-medium text-[var(--text-heading)] ml-1">{tier.campaignLimit}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={`${tier.name}-${featureIndex}`} className="flex items-start gap-2 text-sm">
                      <Check className="w-5 h-5 text-[var(--success)] flex-shrink-0 mt-0.5" />
                      <span className="text-[var(--text-body)]">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link href="/sign-up" className="block">
                  <Button 
                    className={`w-full font-semibold min-h-[44px] ${
                      tier.highlighted
                        ? 'bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white'
                        : 'bg-[var(--bg-page)] hover:bg-[var(--border)] text-[var(--text-heading)]'
                    }`}
                  >
                    Start free trial
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
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
