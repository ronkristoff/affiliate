"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ReducedMotionHero = () => (
  <section className="relative pt-8 pb-16 lg:pt-12 lg:pb-24 overflow-hidden">
    <div className="absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-[#f8f9ff] via-white to-[#f0f4ff]" />
      <div className="absolute -top-20 -right-20 w-[600px] h-[600px] opacity-[0.03]">
        <svg viewBox="0 0 600 600" fill="none" className="w-full h-full">
          <circle cx="300" cy="300" r="300" stroke="#1c2260" strokeWidth="2"/>
          <circle cx="300" cy="300" r="200" stroke="#1c2260" strokeWidth="2"/>
          <circle cx="300" cy="300" r="100" stroke="#1c2260" strokeWidth="2"/>
        </svg>
      </div>
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] opacity-[0.04]">
        <svg viewBox="0 0 500 500" fill="none" className="w-full h-full">
          <rect x="50" y="50" width="400" height="400" stroke="#1c2260" strokeWidth="1.5" transform="rotate(15 250 250)"/>
          <rect x="100" y="100" width="300" height="300" stroke="#1c2260" strokeWidth="1.5" transform="rotate(15 250 250)"/>
        </svg>
      </div>
    </div>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        <div className="lg:col-span-7 text-left">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#1c2260]/5 border border-[#1c2260]/10 mb-8">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1c2260] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1c2260]"></span>
            </span>
            <span className="text-sm font-semibold text-[#1c2260] tracking-wide">
              14-day free trial · No credit card required
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-[#1c2260] leading-[0.95] mb-8">
            Track every<br />
            <span className="text-[#0e1333]">commission.</span>{" "}
            <span className="relative inline-block">
              <span className="relative z-10">Down to the last peso.</span>
              <span className="absolute -bottom-2 left-0 right-0 h-4 bg-[#1c2260]/10 -skew-x-3 -z-0" />
            </span>
          </h1>
          <p className="text-xl sm:text-2xl text-[#474747] mb-10 max-w-xl leading-relaxed font-medium">
            The only affiliate platform built natively on SaligPay. Launch in 15 minutes 
            with automatic tracking, fraud detection, and payouts your affiliates can trust.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 mb-12">
            <Link href="/sign-up">
              <Button 
                size="lg"
                className="bg-[#1c2260] hover:bg-[#161c50] text-white font-bold text-lg px-10 py-7 h-auto shadow-lg shadow-[#1c2260]/20 btn-motion"
              >
                Start your free trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button 
                variant="outline" 
                size="lg"
                className="text-[#1c2260] border-2 border-[#1c2260]/20 hover:border-[#1c2260]/40 hover:bg-[#1c2260]/5 font-semibold text-lg px-10 py-7 h-auto btn-motion"
              >
                See how it works
              </Button>
            </Link>
          </div>
          <p className="text-sm text-[#6b7280] tracking-wide">
            14 days free · No credit card required · Cancel anytime
          </p>
        </div>
        <div className="lg:col-span-5 relative">
          <div className="absolute -top-8 -right-8 -bottom-8 -left-8 bg-gradient-to-br from-[#1c2260]/5 to-[#1c2260]/10 rounded-3xl -z-10" />
          <div className="relative rounded-2xl shadow-2xl shadow-[#1c2260]/15 overflow-hidden bg-white border border-[#e5e7eb] transform lg:translate-x-6">
            <Image
              src="/dashboard-preview.svg"
              alt="Affilio dashboard showing affiliate program analytics"
              width={700}
              height={460}
              priority
              quality={90}
              className="w-full h-auto"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div className="absolute -left-4 top-1/4 bg-white rounded-2xl shadow-xl shadow-[#1c2260]/10 border border-[#e5e7eb] p-5 w-72">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#d1fae5] flex items-center justify-center flex-shrink-0">
                <span className="text-[#065f46] text-lg font-bold">₱</span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#333333]">New conversion!</p>
                <p className="text-xs text-[#6b7280]">Jamie L. made a sale</p>
                <p className="text-lg font-black text-[#10b981] mt-1">+₱1,500</p>
              </div>
            </div>
            <div className="mt-4 h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
              <div className="h-full w-3/4 bg-gradient-to-r from-[#10b981] to-[#34d399] rounded-full" />
            </div>
          </div>
          <div className="absolute -right-2 bottom-1/4 bg-[#0e1333] rounded-2xl shadow-xl border border-white/10 p-4 w-48">
            <p className="text-white/60 text-xs font-medium mb-1">Total Earnings</p>
            <p className="text-white text-2xl font-black">₱48,295</p>
            <p className="text-[#34d399] text-xs font-semibold mt-1">↑ 12.5% this month</p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export function HeroSection() {
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

  if (prefersReducedMotion) {
    return <ReducedMotionHero />;
  }

  return (
    <section ref={sectionRef} className="relative pt-8 pb-16 lg:pt-12 lg:pb-24 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#f8f9ff] via-white to-[#f0f4ff]" />
        <div className="absolute -top-20 -right-20 w-[600px] h-[600px] opacity-[0.03]">
          <svg viewBox="0 0 600 600" fill="none" className="w-full h-full">
            <circle cx="300" cy="300" r="300" stroke="#1c2260" strokeWidth="2"/>
            <circle cx="300" cy="300" r="200" stroke="#1c2260" strokeWidth="2"/>
            <circle cx="300" cy="300" r="100" stroke="#1c2260" strokeWidth="2"/>
          </svg>
        </div>
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] opacity-[0.04]">
          <svg viewBox="0 0 500 500" fill="none" className="w-full h-full">
            <rect x="50" y="50" width="400" height="400" stroke="#1c2260" strokeWidth="1.5" transform="rotate(15 250 250)"/>
            <rect x="100" y="100" width="300" height="300" stroke="#1c2260" strokeWidth="1.5" transform="rotate(15 250 250)"/>
          </svg>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 text-left">
            <div 
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#1c2260]/5 border border-[#1c2260]/10 mb-8"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease-out 0.1s, transform 0.6s ease-out 0.1s',
              }}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1c2260] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1c2260]"></span>
              </span>
              <span className="text-sm font-semibold text-[#1c2260] tracking-wide">
                14-day free trial · No credit card required
              </span>
            </div>

            <h1 
              className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-[#1c2260] leading-[0.95] mb-8"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                transition: 'opacity 0.7s ease-out 0.2s, transform 0.7s ease-out 0.2s',
              }}
            >
              Track every<br />
              <span className="text-[#0e1333]">commission.</span>{" "}
              <span className="relative inline-block">
                <span className="relative z-10">Down to the last peso.</span>
                <span className="absolute -bottom-2 left-0 right-0 h-4 bg-[#1c2260]/10 -skew-x-3 -z-0" />
              </span>
            </h1>

            <p 
              className="text-xl sm:text-2xl text-[#474747] mb-10 max-w-xl leading-relaxed font-medium"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease-out 0.35s, transform 0.6s ease-out 0.35s',
              }}
            >
              The only affiliate platform built natively on SaligPay. Launch in 15 minutes 
              with automatic tracking, fraud detection, and payouts your affiliates can trust.
            </p>

            <div 
              className="flex flex-col sm:flex-row gap-5 mb-12"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease-out 0.5s, transform 0.6s ease-out 0.5s',
              }}
            >
              <Link href="/sign-up">
                <Button 
                  size="lg"
                  className="bg-[#1c2260] hover:bg-[#161c50] text-white font-bold text-lg px-10 py-7 h-auto shadow-lg shadow-[#1c2260]/20 btn-motion"
                >
                  Start your free trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="#features">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="text-[#1c2260] border-2 border-[#1c2260]/20 hover:border-[#1c2260]/40 hover:bg-[#1c2260]/5 font-semibold text-lg px-10 py-7 h-auto btn-motion"
                >
                  See how it works
                </Button>
              </Link>
            </div>

            <p 
              className="text-sm text-[#6b7280] tracking-wide"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.5s ease-out 0.6s, transform 0.5s ease-out 0.6s',
              }}
            >
              14 days free · No credit card required · Cancel anytime
            </p>
          </div>

          <div 
            className="lg:col-span-5 relative"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)',
              transition: 'opacity 0.8s ease-out 0.4s, transform 0.8s ease-out 0.4s',
            }}
          >
            <div className="absolute -top-8 -right-8 -bottom-8 -left-8 bg-gradient-to-br from-[#1c2260]/5 to-[#1c2260]/10 rounded-3xl -z-10" />
            <div className="relative rounded-2xl shadow-2xl shadow-[#1c2260]/15 overflow-hidden bg-white border border-[#e5e7eb] transform lg:translate-x-6">
              <Image
                src="/dashboard-preview.svg"
                alt="Affilio dashboard showing affiliate program analytics"
                width={700}
                height={460}
                priority
                quality={90}
                className="w-full h-auto"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="absolute -left-4 top-1/4 bg-white rounded-2xl shadow-xl shadow-[#1c2260]/10 border border-[#e5e7eb] p-5 w-72 animate-[float_4s_ease-in-out_infinite]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#d1fae5] flex items-center justify-center flex-shrink-0">
                  <span className="text-[#065f46] text-lg font-bold">₱</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#333333]">New conversion!</p>
                  <p className="text-xs text-[#6b7280]">Jamie L. made a sale</p>
                  <p className="text-lg font-black text-[#10b981] mt-1">+₱1,500</p>
                </div>
              </div>
              <div className="mt-4 h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-gradient-to-r from-[#10b981] to-[#34d399] rounded-full" />
              </div>
            </div>
            <div className="absolute -right-2 bottom-1/4 bg-[#0e1333] rounded-2xl shadow-xl border border-white/10 p-4 w-48 animate-[float_4s_ease-in-out_infinite_1s]">
              <p className="text-white/60 text-xs font-medium mb-1">Total Earnings</p>
              <p className="text-white text-2xl font-black">₱48,295</p>
              <p className="text-[#34d399] text-xs font-semibold mt-1">↑ 12.5% this month</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}