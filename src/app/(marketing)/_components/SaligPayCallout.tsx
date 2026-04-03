"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Key, Layers, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  { value: "1", label: "API key", icon: Key },
  { value: "7", label: "event types", icon: Layers },
  { value: "99.99%", label: "accuracy", icon: CheckCircle2 },
];

export function SaligPayCallout() {
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
    <section id="saligpay" ref={sectionRef} className="py-24 bg-[#0e1333] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(90deg, white 1px, transparent 1px), linear-gradient(white 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>
      
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-[#1c2260]/30 rounded-full blur-3xl -translate-y-1/2" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span 
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-sm font-semibold mb-6"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease-out 0.1s, transform 0.6s ease-out 0.1s',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-[#22d3ee]" />
              Native Integration
            </span>
            
            <h2 
              className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 leading-[1.05]"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                transition: 'opacity 0.6s ease-out 0.2s, transform 0.6s ease-out 0.2s',
              }}
            >
              Built natively on{" "}
              <span className="text-[#22d3ee]">SaligPay</span>.<br />
              Not bolted on.
            </h2>
            
            <p 
              className="text-xl text-white/70 mb-10 leading-relaxed"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease-out 0.3s, transform 0.6s ease-out 0.3s',
              }}
            >
              Most affiliate tools connect via webhooks — fragile pipes that break, lag, or miss events entirely. 
              Affilio runs directly on SaligPay's infrastructure, so every payment event flows through instantly and reliably.
            </p>

            <div 
              className="grid sm:grid-cols-3 gap-4 mb-10"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease-out 0.4s, transform 0.6s ease-out 0.4s',
              }}
            >
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className="bg-white/5 rounded-2xl p-5 border border-white/10 hover:bg-white/10 transition-colors"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: `opacity 0.5s ease-out ${0.5 + index * 100}ms, transform 0.5s ease-out ${0.5 + index * 100}ms`,
                  }}
                >
                  <stat.icon className="w-6 h-6 text-[#22d3ee] mb-3" />
                  <div className="text-3xl font-black text-white mb-1">{stat.value}</div>
                  <div className="text-sm text-white/60 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>

            <Link 
              href="/sign-up"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease-out 0.7s, transform 0.6s ease-out 0.7s',
              }}
            >
              <Button className="bg-white text-[#0e1333] hover:bg-white/90 font-bold px-8 py-5 text-lg btn-motion">
                Start your free trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>

          <div 
            className="relative"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.8s ease-out 0.5s, transform 0.8s ease-out 0.5s',
            }}
          >
            <div className="absolute -inset-4 bg-gradient-to-br from-[#22d3ee]/20 to-[#1c2260]/20 rounded-3xl blur-xl" />
            
            <div className="relative bg-[#0a1929] rounded-2xl border border-white/10 p-8 shadow-2xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <div className="w-3 h-3 rounded-full bg-[#fbbf24]" />
                <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                <span className="ml-4 text-white/40 text-sm font-mono">payment_event.json</span>
              </div>
              
              <div className="space-y-4 font-mono text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-[#22d3ee]">event</span>
                  <span className="text-white/60">payment.completed</span>
                  <span className="text-[#10b981]">✓</span>
                </div>
                
                <div className="pl-6 space-y-3 border-l-2 border-white/10">
                  <div className="text-white/60">
                    <span className="text-[#f472b6]">customer_id</span>: <span className="text-[#a5f3fc]">"cus_8xKld4mR2"</span>
                  </div>
                  <div className="text-white/60">
                    <span className="text-[#f472b6]">amount</span>: <span className="text-[#a5f3fc]">₱4,999.00</span>
                  </div>
                  <div className="text-white/60">
                    <span className="text-[#f472b6]">currency</span>: <span className="text-[#a5f3fc]">"PHP"</span>
                  </div>
                  <div className="text-white/60">
                    <span className="text-[#f472b6]">status</span>: <span className="text-[#86efac]">"succeeded"</span>
                  </div>
                  <div className="text-white/60">
                    <span className="text-[#f472b6]">affiliate_id</span>: <span className="text-[#a5f3fc]">"aff_jK9mNp3Q"</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/10 mt-6">
                  <div className="flex items-center gap-2 text-[#22d3ee]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-semibold">Commission ₱500 credited</span>
                    <span className="text-white/40">→ affiliate wallet</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="absolute -top-4 -right-4 bg-[#10b981] text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
              Instant Sync
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}