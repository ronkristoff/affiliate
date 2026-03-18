"use client";

import Link from "next/link";
import { ArrowRight, Key, Layers, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  { value: "1", label: "API key", icon: Key },
  { value: "7", label: "event types", icon: Layers },
  { value: "99.99%", label: "commission accuracy", icon: CheckCircle2 },
];

export function SaligPayCallout() {
  return (
    <section id="saligpay" className="py-20 bg-[var(--brand-dark)] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-sm font-medium mb-4">
              Native Integration
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Built natively on SaligPay.{" "}
              <span className="text-[#22d3ee]">Not bolted on.</span>
            </h2>
            <p className="text-lg text-white/70 mb-8">
              Most affiliate tools connect via webhooks — fragile pipes that break, lag, or miss events entirely. 
              salig-affiliate runs directly on SaligPay's infrastructure, so every payment event flows through instantly and reliably.
            </p>

            {/* Stats */}
            <div className="grid sm:grid-cols-3 gap-6 mb-8">
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className="bg-white/5 rounded-xl p-4 border border-white/10"
                >
                  <stat.icon className="w-5 h-5 text-[#22d3ee] mb-2" />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-white/60">{stat.label}</div>
                </div>
              ))}
            </div>

            <Link href="/sign-up">
              <Button className="bg-white text-[var(--brand-dark)] hover:bg-white/90 font-semibold px-8">
                Start your free trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>

          {/* Right Visual */}
          <div className="hidden lg:block">
            <div className="relative">
              <div className="bg-[#0a1929] rounded-xl border border-white/10 p-6 shadow-2xl">
                {/* Code-like visualization */}
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[#22d3ee]">event</span>
                    <span className="text-white/60">payment.completed</span>
                  </div>
                  <div className="pl-4 space-y-2">
                    <div className="text-white/60">
                      <span className="text-[#f472b6]">customer_id</span>: <span className="text-[#a5f3fc]">"cus_xxx"</span>
                    </div>
                    <div className="text-white/60">
                      <span className="text-[#f472b6]">amount</span>: <span className="text-[#a5f3fc]">4999</span>
                    </div>
                    <div className="text-white/60">
                      <span className="text-[#f472b6]">status</span>: <span className="text-[#86efac]">"succeeded"</span>
                    </div>
                    <div className="text-white/60">
                      <span className="text-[#f472b6]">commission_generated</span>: <span className="text-[#86efac]">true</span>
                    </div>
                  </div>
                  <div className="pt-2">
                    <span className="text-[#fbbf24]">✓ Commission ₱500 credited to affiliate</span>
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
