"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: 1,
    title: "Connect SaligPay",
    description: "Paste your SaligPay API key. That's it — no webhooks, no callback URLs.",
    tag: "~30 seconds",
    icon: "⚡",
  },
  {
    number: 2,
    title: "Create Campaign & Invite",
    description: "Set up your commission structure and invite affiliates via email or share your referral link.",
    tag: "~2 minutes",
    icon: "🎯",
  },
  {
    number: 3,
    title: "Track, Pay, Grow",
    description: "Watch real-time clicks and conversions. Pay affiliates monthly with one click.",
    tag: "Ongoing",
    icon: "💰",
  },
];

function StepCard({ step, index, isVisible }: { step: typeof steps[0]; index: number; isVisible: boolean }) {
  return (
    <div 
      className="relative"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.6s ease-out ${index * 150}ms, transform 0.6s ease-out ${index * 150}ms`,
      }}
    >
      {/* Step Card - elevated */}
      <div className="bg-[#fafafa] rounded-3xl border-2 border-[#e5e7eb] p-10 relative z-10 hover:border-[#10409a]/30 hover:shadow-2xl transition-all duration-500 group">
        {/* Number badge */}
        <div 
          className="absolute -top-5 left-10 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#10409a] to-[#1659d6] text-white flex items-center justify-center font-black text-xl shadow-lg shadow-[#10409a]/30 transition-transform duration-300 group-hover:scale-110"
          style={{
            boxShadow: isVisible 
              ? '0 10px 25px -5px rgba(16, 64, 154, 0.3)' 
              : '0 4px 10px -2px rgba(16, 64, 154, 0.2)',
          }}
        >
          {step.number}
        </div>
        
        {/* Icon */}
        <div className="w-14 h-14 flex items-center justify-center mb-6 text-3xl">
          <span>
            {step.icon}
          </span>
        </div>

        <h3 className="font-bold text-2xl text-[#333333] mb-3 group-hover:text-[#10409a] transition-colors duration-300">
          {step.title}
        </h3>
        <p className="text-[#6b7280] mb-6 leading-relaxed">
          {step.description}
        </p>

        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#10409a]/10 text-[#10409a] text-sm font-bold group-hover:bg-[#10409a]/20 transition-colors duration-300">
          <Check className="w-4 h-4" />
          {step.tag}
        </span>
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [lineWidth, setLineWidth] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Animate line width after cards start appearing
          setTimeout(() => setLineWidth(100), 200);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      id="how-it-works" 
      className="py-24 bg-white relative overflow-hidden"
      ref={sectionRef}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 2px 2px, #10409a 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header - left aligned */}
        <div 
          className="max-w-3xl mb-20"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#10409a]/10 text-[#10409a] text-sm font-bold mb-6">
            How It Works
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#10409a] mb-6 leading-[1.1]">
            Your affiliate program in{" "}
            <span className="text-[#022232]">three steps</span>
          </h2>
          <p className="text-xl text-[#6b7280] leading-relaxed">
            From signup to first affiliate payment — less time than it takes to configure a webhook.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector Line - animated */}
          <div className="hidden lg:block absolute top-16 left-[16.67%] right-[16.67%] h-1 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#10409a]/20 via-[#10409a] to-[#10409a]/20 rounded-full"
              style={{
                width: `${lineWidth}%`,
                transition: 'width 1s ease-out 0.3s',
              }}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <StepCard 
                key={step.number} 
                step={step} 
                index={index}
                isVisible={isVisible}
              />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div 
          className="text-center mt-16"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 0.6s ease-out 0.6s, transform 0.6s ease-out 0.6s`,
          }}
        >
          <Link href="/sign-up">
            <Button className="bg-[#10409a] hover:bg-[#0c3280] text-white font-bold px-12 py-6 text-lg shadow-lg shadow-[#10409a]/20 btn-motion">
              Start your free trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}