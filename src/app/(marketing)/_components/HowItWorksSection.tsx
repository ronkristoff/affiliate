"use client";

import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: 1,
    title: "Connect SaligPay",
    description: "Paste your SaligPay API key. That's it — no webhooks, no callback URLs.",
    tag: "~30 seconds",
  },
  {
    number: 2,
    title: "Create Campaign & Invite",
    description: "Set up your commission structure and invite affiliates via email or share your referral link.",
    tag: "~2 minutes",
  },
  {
    number: 3,
    title: "Track, Pay, Grow",
    description: "Watch real-time clicks and conversions. Pay affiliates monthly with one click.",
    tag: "Ongoing",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 bg-[var(--bg-page)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[var(--brand-light)] text-[var(--brand-primary)] text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-heading)] mb-4">
            Your affiliate program in{" "}
            <span className="text-[var(--brand-primary)]">three steps</span>
          </h2>
          <p className="text-lg text-[var(--text-body)]">
            From signup to first affiliate payment — less time than it takes to configure a webhook.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--border)] to-transparent -translate-y-1/2" />

          <div className="grid lg:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {/* Step Card */}
                <div className="bg-white rounded-2xl border border-[var(--border)] p-8 relative z-10">
                  {/* Number Circle */}
                  <div className="w-12 h-12 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center font-bold text-xl mb-6">
                    {step.number}
                  </div>

                  <h3 className="font-semibold text-xl text-[var(--text-heading)] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-[var(--text-muted)] mb-4">
                    {step.description}
                  </p>

                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--brand-light)] text-[var(--brand-primary)] text-sm font-medium">
                    <Check className="w-4 h-4" />
                    {step.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <Link href="/sign-up">
            <Button className="bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white font-semibold px-8">
              Start your free trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
