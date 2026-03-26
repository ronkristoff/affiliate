"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, Webhook, RefreshCw, FileSpreadsheet } from "lucide-react";

const problems = [
  {
    icon: TrendingUp,
    title: "Plan upgrades go untracked",
    description: "When customers upgrade mid-cycle, you manually calculate prorated commissions — if you remember to.",
    stat: "23%",
    statLabel: "missed revenue",
  },
  {
    icon: Webhook,
    title: "Webhooks you have to maintain",
    description: "Third-party integrations fail silently. You wake up to missed referrals and angry affiliates.",
    stat: "67%",
    statLabel: "of integrations fail",
  },
  {
    icon: RefreshCw,
    title: "Refunds don't reverse commissions",
    description: "A customer gets a refund but the affiliate keeps the commission. Your margins disappear overnight.",
    stat: "₱000s",
    statLabel: "lost monthly",
  },
  {
    icon: FileSpreadsheet,
    title: "Spreadsheets break at scale",
    description: "What worked for 50 affiliates falls apart at 500. Data silos, formula errors, and manual exports.",
    stat: "18hrs",
    statLabel: "wasted weekly",
  },
];

export function ProblemSection() {
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
      { threshold: 0.15 }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <section ref={sectionRef} className="py-24 bg-[#f8fafc] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-[#10409a]/[0.02] to-transparent pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          className="max-w-3xl mb-20"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#fef3c7] text-[#92400e] text-sm font-bold mb-6">
            The Problem
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#10409a] mb-6 leading-[1.1]">
            Managing commissions manually is{" "}
            <span className="text-[#ef4444]">costing you</span> — and your affiliates.
          </h2>
          <p className="text-xl text-[#6b7280] leading-relaxed">
            Most affiliate programs are built on webhooks and spreadsheets. 
            Here's what happens when your business actually scales.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {problems.map((problem, index) => (
            <div 
              key={index}
              className={`group relative bg-white rounded-2xl p-8 border border-[#e5e7eb] hover:border-[#ef4444]/30 hover:shadow-xl transition-all duration-500 ${
                index % 2 === 1 ? 'lg:mt-12' : ''
              }`}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                transition: `opacity 0.6s ease-out ${index * 100}ms, transform 0.6s ease-out ${index * 100}ms`,
              }}
            >
              <div className="absolute top-0 left-8 right-8 h-1 bg-gradient-to-r from-[#ef4444] to-[#f87171] rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-xl bg-[#fee2e2] flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-[#fef3c7] transition-all duration-300">
                  <problem.icon className="w-8 h-8 text-[#ef4444] group-hover:text-[#f59e0b] transition-colors" />
                </div>
                
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-[#333333] mb-3 group-hover:text-[#ef4444] transition-colors">
                    {problem.title}
                  </h3>
                  <p className="text-[#6b7280] leading-relaxed mb-4">
                    {problem.description}
                  </p>
                  
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-[#ef4444]/80">
                      {problem.stat}
                    </span>
                    <span className="text-sm font-medium text-[#6b7280]">
                      {problem.statLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}