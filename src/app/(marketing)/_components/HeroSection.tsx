"use client";

import Link from "next/link";
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

          {/* Right Visual - Dashboard Mockup */}
          <div className="relative hidden lg:block">
            <div className="relative">
              {/* Browser Chrome */}
              <div className="bg-[var(--bg-surface)] rounded-t-xl border border-[var(--border)] border-b-0 shadow-xl overflow-hidden">
                {/* Browser Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-[var(--bg-page)]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 text-center">
                    <div className="inline-block px-4 py-1 rounded-md bg-white border text-xs text-[var(--text-muted)]">
                      saligaffiliate.com
                    </div>
                  </div>
                </div>
                
                {/* Dashboard Content */}
                <div className="p-4 bg-white">
                  <div className="flex gap-4">
                    {/* Sidebar */}
                    <div className="w-16 flex-shrink-0 space-y-2">
                      <div className="h-8 w-full rounded-md bg-[var(--brand-light)]" />
                      <div className="h-6 w-10 rounded bg-[var(--bg-page)]" />
                      <div className="h-6 w-10 rounded bg-[var(--bg-page)]" />
                      <div className="h-6 w-10 rounded bg-[var(--bg-page)]" />
                    </div>
                    
                    {/* Main Content */}
                    <div className="flex-1 space-y-4">
                      {/* KPIs */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg border bg-white">
                          <div className="h-3 w-16 bg-[var(--bg-page)] rounded mb-2" />
                          <div className="h-6 w-12 bg-[var(--brand-primary)] rounded" />
                        </div>
                        <div className="p-3 rounded-lg border bg-white">
                          <div className="h-3 w-16 bg-[var(--bg-page)] rounded mb-2" />
                          <div className="h-6 w-12 bg-[var(--success)] rounded" />
                        </div>
                        <div className="p-3 rounded-lg border bg-white">
                          <div className="h-3 w-16 bg-[var(--bg-page)] rounded mb-2" />
                          <div className="h-6 w-12 bg-[var(--warning)] rounded" />
                        </div>
                      </div>
                      
                      {/* Table */}
                      <div className="rounded-lg border overflow-hidden">
                        <div className="bg-[var(--bg-page)] px-3 py-2 flex gap-4 text-xs font-medium text-[var(--text-muted)]">
                          <span className="w-20">Affiliate</span>
                          <span className="w-20">Campaign</span>
                          <span className="w-16">Clicks</span>
                          <span className="w-16">Conversions</span>
                          <span className="w-16">Commission</span>
                          <span className="w-16">Status</span>
                        </div>
                        <div className="divide-y">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="px-3 py-2 flex gap-4 text-xs">
                              <span className="w-20">Alex R.</span>
                              <span className="w-20">Summer Sale</span>
                              <span className="w-16">{234 * i}</span>
                              <span className="w-16">{12 * i}</span>
                              <span className="w-16">₱{4500 * i}</span>
                              <span className="w-16">
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--success-bg)] text-[var(--success-text)]">
                                  Active
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
