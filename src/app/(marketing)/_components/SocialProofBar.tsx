"use client";

import React, { useEffect, useRef, useState } from "react";
import { Clock, Zap, Rocket } from "lucide-react";

const stats = [
  {
    id: "free-trial",
    icon: Clock,
    value: "14",
    unit: "days",
    label: "free trial",
    subtext: "No card required",
  },
  {
    id: "payment-integration",
    icon: Zap,
    value: "0",
    unit: "",
    label: "webhook setup",
    subtext: "Connect any payment provider",
  },
  {
    id: "quick-setup",
    icon: Rocket,
    value: "<15",
    unit: "min",
    label: "to launch",
    subtext: "Connect · Configure · Invite",
  },
];

export function SocialProofBar(): React.JSX.Element {
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
      { threshold: 0.2 }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <section
      ref={sectionRef}
      className="py-12 bg-[#1c2260] relative overflow-hidden"
      aria-labelledby="social-proof-heading"
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
      </div>
      
      <h2 id="social-proof-heading" className="sr-only">
        Platform Benefits
      </h2>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/20">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.id}
                className="flex items-center gap-5 px-8 py-6 md:py-4 group"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                  transition: `opacity 0.5s ease-out ${index * 100}ms, transform 0.5s ease-out ${index * 100}ms`,
                }}
              >
                <span
                  className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 group-hover:bg-white/20 transition-colors duration-300 flex-shrink-0"
                  aria-hidden="true"
                >
                  <Icon className="w-7 h-7 text-white" />
                </span>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl md:text-4xl font-black text-white tracking-tight">
                      {stat.value}
                    </span>
                    {stat.unit && (
                      <span className="text-lg font-bold text-white/70">
                        {stat.unit}
                      </span>
                    )}
                    <span className="text-lg font-semibold text-white/90">
                      {stat.label}
                    </span>
                  </div>
                  <p className="text-sm text-white/60 font-medium">
                    {stat.subtext}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}