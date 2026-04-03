"use client";

import React, { useEffect, useRef, useState } from "react";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    id: "alex-r",
    name: "Alex R.",
    role: "SaaS Founder",
    location: "Philippines",
    quote: "We launched our affiliate program in under an hour. The SaligPay integration means every sale is tracked perfectly — no more spreadsheet gymnastics.",
    initials: "AR",
  },
  {
    id: "jamie-l",
    name: "Jamie L.",
    role: "Newsletter Creator",
    location: "Cebu",
    quote: "Finally, an affiliate platform that doesn't feel like it was built in 2005. The portal looks like part of my own brand. My conversion rates doubled in a month.",
    initials: "JL",
  },
];

export function TestimonialsSection(): React.JSX.Element {
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
    <section
      ref={sectionRef}
      className="py-24 bg-[#f8fafc] relative overflow-hidden"
      aria-labelledby="testimonials-heading"
    >
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-[#1c2260]/[0.03] to-transparent pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div 
          className="max-w-3xl mb-16"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#1c2260]/10 text-[#1c2260] text-sm font-bold mb-6">
            Testimonials
          </span>
          <h2
            id="testimonials-heading"
            className="text-4xl sm:text-5xl font-black text-[#1c2260] mb-4 leading-[1.1]"
          >
            Loved by SaaS founders in{" "}
            <span className="text-[#0e1333]">Southeast Asia</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl">
          {testimonials.length === 0 ? (
            <p className="text-center text-[#6b7280] col-span-2">
              No testimonials available yet.
            </p>
          ) : (
            testimonials.map((testimonial, index) => (
              <div
                key={testimonial.id}
                className={`relative bg-white rounded-2xl p-8 border border-[#e5e7eb] shadow-lg hover:shadow-xl transition-all duration-500 ${
                  index === 1 ? 'md:transform md:-translate-y-4' : ''
                }`}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                  transition: `opacity 0.6s ease-out ${index * 150}ms, transform 0.6s ease-out ${index * 150}ms`,
                }}
              >
                <div className="absolute -top-4 left-8 w-10 h-10 rounded-xl bg-[#1c2260] flex items-center justify-center shadow-lg">
                  <Quote className="w-5 h-5 text-white" />
                </div>
                
                <div className="pt-6">
                  <div className="flex gap-1 mb-6" aria-label="5 out of 5 stars rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className="w-5 h-5 fill-amber-400 text-amber-400"
                        aria-hidden="true"
                      />
                    ))}
                  </div>

                <blockquote className="text-xl text-[#333333] mb-8 leading-relaxed font-medium">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>

                <figcaption className="flex items-center gap-4 not-italic">
                  <div
                    className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1c2260] to-[#1fb5a5] text-white flex items-center justify-center font-bold text-lg shadow-lg"
                    aria-hidden="true"
                  >
                    {testimonial.initials}
                  </div>
                  <div>
                    <div className="font-bold text-[#333333] text-lg">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-[#6b7280] font-medium">
                      {testimonial.role} · {testimonial.location}
                    </div>
                  </div>
                </figcaption>
                </div>
              </div>
            ))
          )}
        </div>

        <div 
          className="mt-16 flex flex-wrap items-center justify-center gap-8 text-[#6b7280]"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out 0.5s, transform 0.6s ease-out 0.5s',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span className="text-sm font-medium">50+ active affiliates</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span className="text-sm font-medium">₱2M+ paid out</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span className="text-sm font-medium">4.9/5 rating</span>
          </div>
        </div>
      </div>
    </section>
  );
}