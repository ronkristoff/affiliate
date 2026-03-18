"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCTASection() {
  return (
    <section className="py-20 bg-[var(--brand-primary)] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Your affiliate program is 15 minutes away.
        </h2>
        <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
          14-day free trial. Full Scale tier access. No credit card required.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/sign-up">
            <Button 
              size="lg"
              className="bg-white text-[var(--brand-primary)] hover:bg-white/90 font-semibold text-lg px-8 py-6 h-auto"
            >
              Start your free trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
