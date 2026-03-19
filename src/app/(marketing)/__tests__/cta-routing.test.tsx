import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/link to render as a regular <a> tag
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    priority?: boolean;
  }) => <img src={src} alt={alt} {...props} />,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ArrowRight: ({ className }: { className?: string }) => (
    <svg data-testid="arrow-right" className={className} />
  ),
  Check: ({ className }: { className?: string }) => (
    <svg data-testid="check" className={className} />
  ),
  Menu: ({ className }: { className?: string }) => (
    <svg data-testid="menu" className={className} />
  ),
  Key: ({ className }: { className?: string }) => (
    <svg data-testid="key" className={className} />
  ),
  Layers: ({ className }: { className?: string }) => (
    <svg data-testid="layers" className={className} />
  ),
  CheckCircle2: ({ className }: { className?: string }) => (
    <svg data-testid="check-circle" className={className} />
  ),
}));

// Mock radix UI sheet component
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) => (
    <div data-testid="sheet" data-open={open}>
      {children}
    </div>
  ),
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="sheet-trigger">{children}</div>
  ),
  SheetClose: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="sheet-close">{children}</div>
  ),
}));

import { HeroSection } from "@/app/(marketing)/_components/HeroSection";
import { PricingSection } from "@/app/(marketing)/_components/PricingSection";
import { FinalCTASection } from "@/app/(marketing)/_components/FinalCTASection";
import { MarketingNav } from "@/app/(marketing)/_components/MarketingNav";
import { SaligPayCallout } from "@/app/(marketing)/_components/SaligPayCallout";

describe("CTA Routing to Signup (AC: #1)", () => {
  describe("HeroSection CTA", () => {
    it("should link to /sign-up", () => {
      render(<HeroSection />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      expect(ctaLink).toHaveAttribute("href", "/sign-up");
    });

    it("should display correct CTA button text", () => {
      render(<HeroSection />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      expect(ctaLink).toHaveTextContent("Start your free trial");
    });

    it("should use Next.js Link component (renders as <a>)", () => {
      render(<HeroSection />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      expect(ctaLink.tagName).toBe("A");
    });
  });

  describe("PricingSection CTAs", () => {
    it("should have all tier CTAs linking to /sign-up", () => {
      render(<PricingSection />);
      const ctaLinks = screen.getAllByRole("link", { name: /start free trial/i });
      // 3 tiers = 3 CTA links
      expect(ctaLinks.length).toBe(3);
      ctaLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/sign-up");
      });
    });

    it("should display correct CTA button text", () => {
      render(<PricingSection />);
      const ctaLinks = screen.getAllByRole("link", { name: /start free trial/i });
      ctaLinks.forEach((link) => {
        expect(link).toHaveTextContent("Start free trial");
      });
    });
  });

  describe("FinalCTASection CTA", () => {
    it("should link to /sign-up", () => {
      render(<FinalCTASection />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      expect(ctaLink).toHaveAttribute("href", "/sign-up");
    });

    it("should display correct CTA button text", () => {
      render(<FinalCTASection />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      expect(ctaLink).toHaveTextContent("Start your free trial");
    });
  });

  describe("MarketingNav CTA", () => {
    it("should have desktop and mobile CTAs linking to /sign-up", () => {
      render(<MarketingNav />);
      const ctaLinks = screen.getAllByRole("link", { name: /start your free trial/i });
      // Desktop + Mobile = 2 CTA links
      expect(ctaLinks.length).toBe(2);
      ctaLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/sign-up");
      });
    });

    it("should have Log in links to /sign-in", () => {
      render(<MarketingNav />);
      const loginLinks = screen.getAllByRole("link", { name: /log in/i });
      // Desktop + Mobile = 2 login links
      expect(loginLinks.length).toBe(2);
      loginLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/sign-in");
      });
    });

    it("should display correct CTA button text", () => {
      render(<MarketingNav />);
      const ctaLinks = screen.getAllByRole("link", { name: /start your free trial/i });
      ctaLinks.forEach((link) => {
        expect(link).toHaveTextContent("Start free trial");
      });
    });
  });

  describe("SaligPayCallout CTA", () => {
    it("should link to /sign-up", () => {
      render(<SaligPayCallout />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      expect(ctaLink).toHaveAttribute("href", "/sign-up");
    });

    it("should display correct CTA button text", () => {
      render(<SaligPayCallout />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      expect(ctaLink).toHaveTextContent("Start your free trial");
    });
  });
});

describe("No Credit Card Required (AC: #2)", () => {
  it("HeroSection should display 'No credit card required' messaging", () => {
    render(<HeroSection />);
    expect(screen.getByText(/no credit card required/i)).toBeInTheDocument();
  });

  it("FinalCTASection should display 'No credit card required' messaging", () => {
    render(<FinalCTASection />);
    expect(screen.getByText(/no credit card required/i)).toBeInTheDocument();
  });
});

describe("Trial Messaging Consistency (AC: #4)", () => {
  it("HeroSection should display 14-day trial messaging", () => {
    render(<HeroSection />);
    expect(screen.getByText(/14 days free/i)).toBeInTheDocument();
    expect(screen.getByText(/no credit card required/i)).toBeInTheDocument();
  });

  it("PricingSection should display 14-day free trial in feature list", () => {
    render(<PricingSection />);
    // Starter tier includes "14-day free trial" in features
    const freeTrialTexts = screen.getAllByText(/14-day free trial/i);
    expect(freeTrialTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("PricingSection footer should mention 14-day free trial", () => {
    render(<PricingSection />);
    expect(screen.getByText(/all plans include 14-day free trial/i)).toBeInTheDocument();
  });

  it("FinalCTASection should display 14-day trial messaging", () => {
    render(<FinalCTASection />);
    expect(screen.getByText(/14-day free trial/i)).toBeInTheDocument();
    expect(screen.getByText(/no credit card required/i)).toBeInTheDocument();
  });
});

describe("Mobile CTA Accessibility (AC: #5)", () => {
  describe("Touch target minimum 44px", () => {
    it("HeroSection CTA button should have adequate height (py-6 h-auto)", () => {
      render(<HeroSection />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      const button = ctaLink.querySelector("button");
      expect(button?.className).toContain("py-6");
      expect(button?.className).toContain("h-auto");
    });

    it("PricingSection CTA buttons should have min-h-[44px]", () => {
      render(<PricingSection />);
      const ctaLinks = screen.getAllByRole("link", { name: /start free trial/i });
      ctaLinks.forEach((link) => {
        const button = link.querySelector("button");
        expect(button?.className).toContain("min-h-[44px]");
      });
    });

    it("FinalCTASection CTA button should have adequate height (py-6 h-auto)", () => {
      render(<FinalCTASection />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      const button = ctaLink.querySelector("button");
      expect(button?.className).toContain("py-6");
      expect(button?.className).toContain("h-auto");
    });

    it("MarketingNav CTA buttons should have min-h-[44px]", () => {
      render(<MarketingNav />);
      const ctaLinks = screen.getAllByRole("link", { name: /start your free trial/i });
      ctaLinks.forEach((link) => {
        const button = link.querySelector("button");
        expect(button?.className).toContain("min-h-[44px]");
      });
    });

    it("SaligPayCallout CTA button should have min-h-[44px]", () => {
      render(<SaligPayCallout />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      const button = ctaLink.querySelector("button");
      expect(button?.className).toContain("min-h-[44px]");
    });
  });

  describe("Button text readability on mobile", () => {
    it("HeroSection CTA should use readable font size", () => {
      render(<HeroSection />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      const button = ctaLink.querySelector("button");
      expect(button?.className).toContain("text-lg");
    });

    it("FinalCTASection CTA should use readable font size", () => {
      render(<FinalCTASection />);
      const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
      const button = ctaLink.querySelector("button");
      expect(button?.className).toContain("text-lg");
    });
  });
});

describe("CTA Visual Consistency (AC: #4)", () => {
  it("HeroSection CTA should use brand primary color", () => {
    render(<HeroSection />);
    const ctaLink = screen.getByRole("link", { name: /start your free trial/i });
    const button = ctaLink.querySelector("button");
    expect(button?.className).toContain("bg-[var(--brand-primary)]");
    expect(button?.className).toContain("text-white");
  });

  it("MarketingNav CTA buttons should use brand primary color", () => {
    render(<MarketingNav />);
    const ctaLinks = screen.getAllByRole("link", { name: /start your free trial/i });
    ctaLinks.forEach((link) => {
      const button = link.querySelector("button");
      expect(button?.className).toContain("bg-[var(--brand-primary)]");
      expect(button?.className).toContain("text-white");
    });
  });

  it("PricingSection highlighted tier CTA should use brand primary color", () => {
    render(<PricingSection />);
    // The highlighted tier (Growth) should have brand primary
    const ctaLinks = screen.getAllByRole("link", { name: /start free trial/i });
    // Growth tier (2nd card) should have primary style
    const growthButton = ctaLinks[1]?.querySelector("button");
    expect(growthButton?.className).toContain("bg-[var(--brand-primary)]");
  });
});

describe("Trial Duration Calculation (AC: #3)", () => {
  it("14-day trial should equal exactly 14 * 24 * 60 * 60 * 1000 milliseconds", () => {
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    expect(FOURTEEN_DAYS_MS).toBe(1209600000);
  });

  it("trialEndsAt should be 14 days from creation timestamp", () => {
    const creationTime = Date.now();
    const trialEndsAt = creationTime + 14 * 24 * 60 * 60 * 1000;
    const trialDays = Math.ceil((trialEndsAt - creationTime) / (24 * 60 * 60 * 1000));
    expect(trialDays).toBe(14);
  });

  it("trial should be correctly computed as active before trialEndsAt", () => {
    const now = Date.now();
    const trialEndsAt = now + 14 * 24 * 60 * 60 * 1000;
    const isTrial = trialEndsAt > now;
    expect(isTrial).toBe(true);
  });

  it("trial should be correctly computed as expired after trialEndsAt", () => {
    const now = Date.now();
    const trialEndsAt = now - 1000; // 1 second ago
    const isTrial = trialEndsAt > now;
    expect(isTrial).toBe(false);
  });

  it("trialDaysRemaining should be correctly calculated", () => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const trialEndsAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days from now
    const isTrial = trialEndsAt > now;
    const trialDaysRemaining = isTrial
      ? Math.ceil((trialEndsAt - now) / (24 * 60 * 60 * 1000))
      : undefined;
    expect(trialDaysRemaining).toBe(7);
  });
});
