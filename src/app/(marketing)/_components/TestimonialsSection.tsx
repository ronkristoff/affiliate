import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

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
  return (
    <section
      className="py-20 bg-[var(--bg-page)]"
      aria-labelledby="testimonials-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[var(--brand-light)] text-[var(--brand-primary)] text-sm font-medium mb-4">
            Testimonials
          </span>
          <h2
            id="testimonials-heading"
            className="text-3xl sm:text-4xl font-bold text-[var(--text-heading)] mb-4"
          >
            Loved by SaaS founders in{" "}
            <span className="text-[var(--brand-primary)]">Southeast Asia</span>
          </h2>
        </div>

        {/* Testimonial Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {testimonials.length === 0 ? (
            <p className="text-center text-[var(--text-muted)] col-span-2">
              No testimonials available yet.
            </p>
          ) : (
            testimonials.map((testimonial) => (
              <Card
                key={testimonial.id}
                role="article"
                className="border-[var(--border)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md transition-shadow duration-200"
              >
                <CardContent className="p-8">
                  <figure>
                    {/* Stars */}
                    <div className="flex gap-1 mb-4" aria-label="5 out of 5 stars rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className="w-5 h-5 fill-amber-400 text-amber-400"
                          aria-hidden="true"
                        />
                      ))}
                    </div>

                  {/* Quote */}
                  <blockquote className="text-lg text-[var(--text-body)] mb-6">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>

                  {/* Author */}
                  <figcaption className="flex items-center gap-4 not-italic">
                    <div
                      className="w-12 h-12 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center font-semibold shrink-0"
                      aria-hidden="true"
                    >
                      {testimonial.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--text-heading)]">
                        {testimonial.name}
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">
                        {testimonial.role}, {testimonial.location}
                      </div>
                    </div>
                  </figcaption>
                </figure>
              </CardContent>
            </Card>
          ))
          )}
        </div>

        {/* Note */}
        <p className="text-center text-sm text-[var(--text-muted)] mt-8">
          * Replace with real quotes within 30 days of launch
        </p>
      </div>
    </section>
  );
}
