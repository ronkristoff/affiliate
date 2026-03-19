"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f8f9ff] to-[#f2f2f2] -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--brand-light)] text-[var(--brand-primary)] text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-primary)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--brand-primary)]"></span>
              </span>
              Now in Beta — 14-day free trial
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--text-heading)] leading-tight mb-6">
              The affiliate program your SaaS{" "}
              <span className="text-[var(--brand-primary)]">actually needs.</span>
            </h1>

            {/* Sub-headline */}
            <p className="text-lg sm:text-xl text-[var(--text-body)] mb-8 max-w-xl mx-auto lg:mx-0">
              Launch a professional affiliate program in minutes. Built natively on SaligPay 
              for perfect commission tracking — no webhooks, no integrations headaches.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
              <Link href="/sign-up">
                <Button 
                  size="lg"
                  className="bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white font-semibold text-lg px-8 py-6 h-auto"
                >
                  Start your free trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="#features">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="text-[var(--text-body)] border-[var(--border)] hover:bg-[var(--bg-page)] font-medium text-lg px-8 py-6 h-auto"
                >
                  See how it works
                </Button>
              </Link>
            </div>

            {/* Sub-copy */}
            <p className="text-sm text-[var(--text-muted)]">
              14 days free · No credit card required · Cancel anytime
            </p>
          </div>

          {/* Right Visual - Dashboard Preview */}
          <div className="relative hidden lg:block">
            <div className="relative">
              {/* Dashboard Preview Image - Optimized for LCP */}
              <div className="relative rounded-xl shadow-2xl overflow-hidden bg-white border border-[var(--border)]">
                <Image
                  src="/dashboard-preview.svg"
                  alt="salig-affiliate dashboard showing affiliate program analytics"
                  width={600}
                  height={400}
                  priority
                  quality={85}
                  className="w-full h-auto"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>

              {/* Floating Notification Card */}
              <div className="absolute -right-4 top-1/4 bg-white rounded-xl shadow-lg border p-4 w-64 animate-[float_3s_ease-in-out_infinite]">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--success-bg)] flex items-center justify-center flex-shrink-0">
                    <span className="text-[var(--success)] text-sm">₱</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-heading)]">New conversion!</p>
                    <p className="text-xs text-[var(--text-muted)]">Jamie L. made a sale</p>
                    <p className="text-sm font-bold text-[var(--success)] mt-1">+₱1,500</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
