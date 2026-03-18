"use client";

import Link from "next/link";
import { 
  Zap, 
  RefreshCw, 
  Palette, 
  Wallet, 
  Shield, 
  BarChart3 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Zap,
    title: "Native SaligPay Integration",
    description: "Built directly on SaligPay's API. Every payment, upgrade, and refund automatically flows through — no webhooks needed.",
  },
  {
    icon: RefreshCw,
    title: "Recurring Commission Engine",
    description: "Automatically track recurring subscriptions. When customers upgrade, downgrade, or churn — commissions adjust instantly.",
  },
  {
    icon: Palette,
    title: "Branded Affiliate Portal",
    description: "Give affiliates a white-labeled experience with your logo, colors, and custom domain. Make it feel like your own product.",
  },
  {
    icon: Wallet,
    title: "Payout Workflow",
    description: "Batch payouts, track status, and handle rejections — all from one dashboard. Pay affiliates via bank transfer or SaligPay.",
  },
  {
    icon: Shield,
    title: "Built-in Fraud Detection",
    description: "Spot suspicious patterns: self-referrals, click fraud, and suspicious conversion spikes. Flag issues before you pay.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Reporting",
    description: "Live dashboards show clicks, conversions, and commissions the moment they happen. Export reports anytime.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[var(--brand-light)] text-[var(--brand-primary)] text-sm font-medium mb-4">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-heading)] mb-4">
            Everything you need to run a{" "}
            <span className="text-[var(--brand-primary)]">professional affiliate program</span>
          </h2>
          <p className="text-lg text-[var(--text-body)]">
            From tracking to payouts, we've handled the hard stuff so you can focus on growing your business.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="group border-[var(--border)] hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <CardContent className="p-6">
                <div className="relative">
                  {/* Gradient top border on hover */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg" />
                  
                  <div className="w-12 h-12 rounded-xl bg-[var(--brand-light)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6 text-[var(--brand-primary)]" />
                  </div>
                  <h3 className="font-semibold text-lg text-[var(--text-heading)] mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <Link href="/sign-up">
            <Button className="bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white font-semibold px-8">
              Start your free trial
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
