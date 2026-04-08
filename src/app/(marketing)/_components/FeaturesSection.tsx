"use client";

import { useEffect, useRef, useState } from "react";
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

const features = [
  {
    icon: Zap,
    title: "Multi-Provider Integration",
    description: "Connect Stripe, SaligPay, or any payment provider. Every payment, upgrade, and refund automatically flows through — no manual setup needed.",
    highlight: "Zero configuration",
  },
  {
    icon: RefreshCw,
    title: "Recurring Commission Engine",
    description: "Automatically track recurring subscriptions. When customers upgrade, downgrade, or churn — commissions adjust instantly.",
    highlight: "Always accurate",
  },
  {
    icon: Palette,
    title: "Branded Affiliate Portal",
    description: "Give affiliates a white-labeled experience with your logo, colors, and custom domain. Make it feel like your own product.",
    highlight: "White-label ready",
  },
  {
    icon: Wallet,
    title: "Payout Workflow",
    description: "Batch payouts, track status, and handle rejections — all from one dashboard. Pay affiliates via bank transfer or direct deposit.",
    highlight: "One-click payouts",
  },
  {
    icon: Shield,
    title: "Built-in Fraud Detection",
    description: "Spot suspicious patterns: self-referrals, click fraud, and suspicious conversion spikes. Flag issues before you pay.",
    highlight: "Proactive protection",
  },
  {
    icon: BarChart3,
    title: "Real-Time Reporting",
    description: "Live dashboards show clicks, conversions, and commissions the moment they happen. Export reports anytime.",
    highlight: "Live data",
  },
];

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <section id="features" ref={sectionRef} className="py-24 bg-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 opacity-[0.03] -translate-x-1/2 -translate-y-1/2">
        <svg viewBox="0 0 400 400" fill="none" className="w-full h-full">
          <circle cx="200" cy="200" r="200" stroke="#1c2260" strokeWidth="1"/>
          <circle cx="200" cy="200" r="150" stroke="#1c2260" strokeWidth="1"/>
          <circle cx="200" cy="200" r="100" stroke="#1c2260" strokeWidth="1"/>
        </svg>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          className="max-w-3xl mb-20"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#1c2260]/10 text-[#1c2260] text-sm font-bold mb-6">
            Features
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#1c2260] mb-6 leading-[1.1]">
            Everything you need to run a{" "}
            <span className="text-[#0e1333]">professional</span> affiliate program
          </h2>
          <p className="text-xl text-[#6b7280] leading-relaxed">
            From tracking to payouts, we've handled the hard stuff so you can focus on growing your business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
<div
  key={feature.title}
  className={`group relative bg-[#fafafa] rounded-2xl p-8 border border-[#e5e7eb] hover:bg-white hover:shadow-xl transition-all duration-500 ${
    index === 0 ? 'md:col-span-2 lg:col-span-1 lg:row-span-2' : ''
  } ${index === 3 ? 'lg:col-span-2' : ''}`}
  style={{
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
    transition: `opacity 0.6s ease-out ${index * 100}ms, transform 0.6s ease-out ${index * 100}ms`,
  }}
>
  <div className={`flex flex-col ${index === 0 ? 'h-full' : ''}`}>
                <div className={`relative ${index === 0 ? 'w-20 h-20' : 'w-14 h-14'} rounded-2xl bg-gradient-to-br from-[#1c2260] to-[#1fb5a5] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-[#1c2260]/20`}>
                  <feature.icon className={`${index === 0 ? 'w-10 h-10' : 'w-7 h-7'} text-white`} />
                </div>
                
                <h3 className={`font-bold text-[#333333] mb-3 ${index === 0 ? 'text-2xl' : 'text-lg'}`}>
                  {feature.title}
                </h3>
                
                <p className="text-[#6b7280] leading-relaxed mb-4 flex-1">
                  {feature.description}
                </p>
                
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1c2260]/5 text-[#1c2260] text-sm font-semibold w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1c2260]"></span>
                  {feature.highlight}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div 
          className="text-center mt-16"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out 0.8s, transform 0.6s ease-out 0.8s',
          }}
        >
          <Link href="/sign-up">
            <Button className="bg-[#1c2260] hover:bg-[#161c50] text-white font-bold px-12 py-6 text-lg shadow-lg shadow-[#1c2260]/20 btn-motion">
              Start your free trial
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}