"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Logo } from "@/components/shared/Logo";

export function MarketingNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const SCROLL_THRESHOLD = 20;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "#how-it-works", label: "How It Works" },
  ];

  return (
    <header
      className={`sticky top-0 z-50 motion-safe:transition-all motion-safe:duration-300 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-xl shadow-sm py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between" aria-label="Main navigation">
          {/* Logo */}
          <Logo href="/" />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-label={link.label}
                className="text-[var(--text-body)] hover:text-[var(--brand-primary)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] rounded"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/sign-in" aria-label="Log in to your account">
              <Button variant="ghost" className="font-medium">
                Log in
              </Button>
            </Link>
            <Link href="/sign-up" aria-label="Start your free trial">
              <Button className="bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white font-semibold px-6 min-h-[44px]">
                Start free trial
              </Button>
            </Link>
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                <Menu className="w-6 h-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-sm">
              <div className="flex flex-col h-full">
                {/* Mobile Header */}
                <div className="flex items-center justify-between pb-6 border-b">
                  <Logo href="/" />
                </div>

                {/* Mobile Nav Links */}
                <nav className="flex-1 py-8 space-y-4" aria-label="Mobile navigation">
                  {navLinks.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <a
                        href={link.href}
                        aria-label={link.label}
                        className="block text-lg font-medium text-[var(--text-heading)] hover:text-[var(--brand-primary)] py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] rounded"
                      >
                        {link.label}
                      </a>
                    </SheetClose>
                  ))}
                </nav>

                {/* Mobile CTAs */}
                <div className="space-y-4 pt-6 border-t">
                  <SheetClose asChild>
                    <Link href="/sign-in" className="block" aria-label="Log in to your account">
                      <Button variant="ghost" className="w-full font-medium">
                        Log in
                      </Button>
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/sign-up" className="block" aria-label="Start your free trial">
                      <Button className="w-full bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white font-semibold min-h-[44px]">
                        Start free trial
                      </Button>
                    </Link>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </header>
  );
}
