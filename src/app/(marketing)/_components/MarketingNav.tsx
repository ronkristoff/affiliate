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

export function MarketingNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#saligpay", label: "SaligPay" },
    { href: "#pricing", label: "Pricing" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-xl shadow-sm py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center">
              <span className="text-white font-bold text-lg font-display">S</span>
            </div>
            <span className="font-bold text-xl text-[var(--text-heading)]">
              salig<span className="text-[var(--brand-primary)]">affiliate</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[var(--text-body)] hover:text-[var(--brand-primary)] font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost" className="font-medium">
                Log in
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button className="bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white font-semibold px-6">
                Start free trial
              </Button>
            </Link>
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-sm">
              <div className="flex flex-col h-full">
                {/* Mobile Header */}
                <div className="flex items-center justify-between pb-6 border-b">
                  <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center">
                      <span className="text-white font-bold text-sm font-display">S</span>
                    </div>
                    <span className="font-bold text-lg">saligaffiliate</span>
                  </Link>
                </div>

                {/* Mobile Nav Links */}
                <nav className="flex-1 py-8 space-y-4">
                  {navLinks.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <a
                        href={link.href}
                        className="block text-lg font-medium text-[var(--text-heading)] hover:text-[var(--brand-primary)] py-2"
                      >
                        {link.label}
                      </a>
                    </SheetClose>
                  ))}
                </nav>

                {/* Mobile CTAs */}
                <div className="space-y-3 pt-6 border-t">
                  <SheetClose asChild>
                    <Link href="/sign-in" className="block">
                      <Button variant="outline" className="w-full font-medium">
                        Log in
                      </Button>
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/sign-up" className="block">
                      <Button className="w-full bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white font-semibold">
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
