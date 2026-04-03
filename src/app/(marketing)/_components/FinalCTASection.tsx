"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCTASection() {
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
    <section ref={sectionRef} className="py-24 bg-[#1c2260] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 3px 3px, white 1px, transparent 0)`,
          backgroundSize: '48px 48px'
        }} />
      </div>
      
      <div className="absolute top-0 left-0 w-64 h-64 bg-[#22d3ee]/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#1fb5a5]/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <div 
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-8"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out 0.1s, transform 0.6s ease-out 0.1s',
          }}
        >
          <Sparkles className="w-8 h-8 text-[#22d3ee]" />
        </div>
        
        <h2 
          className="text-5xl sm:text-6xl lg:text-7xl font-black mb-6 leading-[1.05]"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 0.7s ease-out 0.2s, transform 0.7s ease-out 0.2s',
          }}
        >
          Your affiliate program<br />
          <span className="text-[#22d3ee]">15 minutes</span> away.
        </h2>
        
        <p 
          className="text-xl sm:text-2xl text-white/80 mb-12 max-w-2xl mx-auto leading-relaxed"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out 0.35s, transform 0.6s ease-out 0.35s',
          }}
        >
          14-day free trial. Full Scale tier access. No credit card required.
        </p>
        
        <div 
          className="flex flex-col sm:flex-row gap-5 justify-center"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out 0.5s, transform 0.6s ease-out 0.5s',
          }}
        >
          <Link href="/sign-up">
            <Button 
              size="lg"
              className="bg-white text-[#1c2260] hover:bg-white/90 font-black text-xl px-14 py-8 h-auto shadow-2xl shadow-black/20 btn-motion"
            >
              Start your free trial
              <ArrowRight className="ml-3 w-6 h-6" />
            </Button>
          </Link>
        </div>
        
        <div 
          className="mt-16 flex flex-wrap items-center justify-center gap-8 text-white/60 text-sm font-medium"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out 0.7s, transform 0.6s ease-out 0.7s',
          }}
        >
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
            No credit card required
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
            14 days free
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
            Cancel anytime
          </span>
        </div>
      </div>
    </section>
  );
}