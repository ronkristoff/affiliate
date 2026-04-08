import { describe, it, expect, vi } from "vitest";

// Mock next/dynamic before any imports
const mockDynamic = vi.fn();
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: unknown }>, options?: Record<string, unknown>) => {
    mockDynamic(loader, options);
    return () => null; // Return a no-op component for testing
  },
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => null, // No-op for server-side tests
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) =>
    <a {...props}>{children}</a>,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ArrowRight: () => null,
  Check: () => null,
  Clock: () => null,
  Zap: () => null,
  Rocket: () => null,
  TrendingUp: () => null,
  Webhook: () => null,
  RefreshCw: () => null,
  FileSpreadsheet: () => null,
  Palette: () => null,
  Wallet: () => null,
  Shield: () => null,
  Lock: () => null,
  BarChart3: () => null,
  Key: () => null,
  Layers: () => null,
  CheckCircle2: () => null,
  Star: () => null,
  Menu: () => null,
}));

// Mock shadcn/ui components
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; className?: string }) =>
    <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) =>
    <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: { children: React.ReactNode }) =>
    <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: (props: Record<string, unknown>) => null,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetClose: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Story 12.7: Responsive Load Time - Performance Optimizations", () => {
  describe("AC #4: Code Splitting - Dynamic Imports for Below-Fold Sections", () => {
    it("should dynamically import all below-fold marketing sections", async () => {
      // Reset mock before importing
      mockDynamic.mockClear();

      // Re-import the page module to trigger dynamic import calls
      // Since dynamic imports are called at module level, we need to re-import
      const pageModule = await import("../page");

      // Verify dynamic() was called for all below-fold sections
      const dynamicCalls = mockDynamic.mock.calls;
      const loadedSections = dynamicCalls.map(
        (call: Array<() => Promise<{ default: unknown }>>) => {
          // Extract the component name from the loader path
          const loaderPath = call[0].toString();
          if (loaderPath.includes("SocialProofBar")) return "SocialProofBar";
          if (loaderPath.includes("ProblemSection")) return "ProblemSection";
          if (loaderPath.includes("FeaturesSection")) return "FeaturesSection";
          if (loaderPath.includes("IntegrationCallout")) return "IntegrationCallout";
          if (loaderPath.includes("HowItWorksSection")) return "HowItWorksSection";
          if (loaderPath.includes("PricingSection")) return "PricingSection";
          if (loaderPath.includes("TestimonialsSection")) return "TestimonialsSection";
          if (loaderPath.includes("FinalCTASection")) return "FinalCTASection";
          if (loaderPath.includes("MarketingFooter")) return "MarketingFooter";
          return "Unknown";
        }
      );

      // All 9 below-fold sections should be dynamically imported
      const expectedSections = [
        "SocialProofBar",
        "ProblemSection",
        "FeaturesSection",
        "IntegrationCallout",
        "HowItWorksSection",
        "PricingSection",
        "TestimonialsSection",
        "FinalCTASection",
        "MarketingFooter",
      ];

      for (const section of expectedSections) {
        expect(loadedSections).toContain(section);
      }
    });

    it("should provide loading placeholders for all dynamic sections", async () => {
      mockDynamic.mockClear();

      await import("../page");

      const dynamicCalls = mockDynamic.mock.calls;
      for (const call of dynamicCalls) {
        const options = call[1] as Record<string, unknown> | undefined;
        // Each dynamic import should have a loading component
        expect(options).toBeDefined();
        expect(options).toHaveProperty("loading");
        expect(typeof options!.loading).toBe("function");
      }
    });
  });

  describe("AC #3: Font Loading Optimization", () => {
    it("should configure Poppins font with display swap and preload", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const layoutContent = fs.readFileSync(
        path.join(process.cwd(), "src/app/(marketing)/layout.tsx"),
        "utf-8"
      );

      // Verify Poppins has display: "swap"
      expect(layoutContent).toMatch(/display:\s*"swap"/);

      // Verify Poppins has preload: true
      expect(layoutContent).toMatch(/preload:\s*true/);

      // Verify Poppins uses latin subset (minimizes font file size)
      expect(layoutContent).toMatch(/subsets:\s*\["latin"\]/);

      // Verify font variable is properly set
      expect(layoutContent).toMatch(/variable:\s*"--font-poppins"/);
      expect(layoutContent).toMatch(/variable:\s*"--font-passion"/);

      // Verify preconnect to Google Fonts
      expect(layoutContent).toMatch(/fonts\.googleapis\.com/);
      expect(layoutContent).toMatch(/fonts\.gstatic\.com/);
      expect(layoutContent).toMatch(/crossOrigin:\s*"anonymous"/);
    });
  });

  describe("AC #2: Image Optimization - Next.js Image Component", () => {
    it("should use Next.js Image component in HeroSection", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const heroContent = fs.readFileSync(
        path.join(process.cwd(), "src/app/(marketing)/_components/HeroSection.tsx"),
        "utf-8"
      );

      // Should import Image from next/image
      expect(heroContent).toMatch(/import Image from "next\/image"/);

      // Should use Image component
      expect(heroContent).toMatch(/<Image/);

      // Should have priority for LCP image
      expect(heroContent).toMatch(/priority/);

      // Should have quality optimization
      expect(heroContent).toMatch(/quality=/);

      // Should have responsive sizes
      expect(heroContent).toMatch(/sizes=/);
    });

    it("should have no raw <img> tags in any marketing component", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const componentsDir = path.join(
        process.cwd(),
        "src/app/(marketing)/_components"
      );
      const files = fs.readdirSync(componentsDir).filter((f: string) => f.endsWith(".tsx"));

      for (const file of files) {
        const content = fs.readFileSync(path.join(componentsDir, file), "utf-8");
        // No raw <img> tags should exist (only next/image is allowed)
        expect(content).not.toMatch(/<img\s/);
        expect(content).not.toMatch(/<\/img>/);
      }
    });

    it("should use no external image URLs without Next.js Image component", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const componentsDir = path.join(
        process.cwd(),
        "src/app/(marketing)/_components"
      );
      const files = fs.readdirSync(componentsDir).filter((f: string) => f.endsWith(".tsx"));

      for (const file of files) {
        const content = fs.readFileSync(path.join(componentsDir, file), "utf-8");
        // No background-image URLs pointing to external resources
        expect(content).not.toMatch(/url\(https?:\/\//);
      }
    });
  });

  describe("AC #1: Compression and Caching Configuration", () => {
    it("should have compression enabled in next.config", async () => {
      const fs = await import("fs");
      const configContent = fs.readFileSync(
        "next.config.ts",
        "utf-8"
      );

      // Verify compression is enabled
      expect(configContent).toMatch(/compress:\s*true/);

      // Verify poweredByHeader is disabled
      expect(configContent).toMatch(/poweredByHeader:\s*false/);
    });

    it("should configure immutable cache headers for static assets", async () => {
      const fs = await import("fs");
      const configContent = fs.readFileSync(
        "next.config.ts",
        "utf-8"
      );

      // Verify cache headers for static assets
      expect(configContent).toMatch(/max-age=31536000/);
      expect(configContent).toMatch(/immutable/);

      // Verify Next.js static bundles caching
      expect(configContent).toMatch(/_next\/static/);
    });

    it("should configure cache headers for image assets", async () => {
      const fs = await import("fs");
      const configContent = fs.readFileSync(
        "next.config.ts",
        "utf-8"
      );

      // Verify image format caching (webp, svg, etc.)
      expect(configContent).toMatch(/webp/);
    });
  });

  describe("AC #3: Critical CSS Inlining", () => {
    it("should have critical CSS inlined in layout head", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const layoutContent = fs.readFileSync(
        path.join(process.cwd(), "src/app/(marketing)/layout.tsx"),
        "utf-8"
      );

      // Should have criticalCSS variable defined
      expect(layoutContent).toMatch(/const criticalCSS/);

      // Should inline critical CSS in head
      expect(layoutContent).toMatch(/<style dangerouslySetInnerHTML/);

      // Should include critical brand colors
      expect(layoutContent).toMatch(/--brand-primary/);
      expect(layoutContent).toMatch(/--bg-page/);

      // Should include font-family fallbacks
      expect(layoutContent).toMatch(/font-family/);

      // Should prevent FOIT
      expect(layoutContent).toMatch(/system-ui/);
    });

    it("should preload critical hero image for LCP", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const layoutContent = fs.readFileSync(
        path.join(process.cwd(), "src/app/(marketing)/layout.tsx"),
        "utf-8"
      );

      // Should preload the hero image
      expect(layoutContent).toMatch(/rel="preload".*as="image"/);
      expect(layoutContent).toMatch(/dashboard-preview\.(svg|png|webp)/);
    });
  });

  describe("Page as Server Component (Zero JS Bundle Cost)", () => {
    it("should NOT have 'use client' directive on the marketing page", async () => {
      const fs = await import("fs");
      const pageContent = fs.readFileSync(
        "src/app/(marketing)/page.tsx",
        "utf-8"
      );

      expect(pageContent).not.toMatch(/^"use client"/m);
    });

    it("should export metadata for SEO (server component behavior)", async () => {
      const fs = await import("fs");
      const pageContent = fs.readFileSync(
        "src/app/(marketing)/page.tsx",
        "utf-8"
      );

      // Metadata export is only available in Server Components
      expect(pageContent).toMatch(/export const metadata/);
    });
  });
});
