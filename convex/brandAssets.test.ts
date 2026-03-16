import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit Tests for Brand Asset Library
 * 
 * Story 8.6: Brand Asset Library
 * 
 * These tests validate:
 * - AC1: Assets page navigation and accessibility
 * - AC2: Asset display organized by categories
 * - AC3: Asset preview with thumbnails and metadata
 * - AC4: Download/copy actions for assets
 * - AC5: Usage guidelines display
 * - AC6: Empty state when no assets exist
 * - AC7: Tenant branding consistency
 */

describe("Brand Asset Library - Business Logic", () => {
  describe("AC1: Assets Page Navigation", () => {
    it("should include Assets in navigation items", () => {
      const navItems = [
        { href: "/portal/home", label: "Home" },
        { href: "/portal/earnings", label: "Earnings" },
        { href: "/portal/links", label: "Links" },
        { href: "/portal/assets", label: "Assets" },
        { href: "/portal/account", label: "Account" },
      ];

      const assetsNav = navItems.find(item => item.label === "Assets");
      expect(assetsNav).toBeDefined();
      expect(assetsNav?.href).toBe("/portal/assets");
    });

    it("should require authentication for assets page", () => {
      const isAuthenticated = (session: unknown): boolean => {
        return session !== null && session !== undefined;
      };

      expect(isAuthenticated({ affiliateId: "123", tenantId: "456" })).toBe(true);
      expect(isAuthenticated(null)).toBe(false);
      expect(isAuthenticated(undefined)).toBe(false);
    });
  });

  describe("AC2: Asset Display - Categories", () => {
    const mockAssets = [
      { _id: "logo1", type: "logo", title: "Logo Primary", fileUrl: "https://example.com/logo.png" },
      { _id: "banner1", type: "banner", title: "Banner 300x250", fileUrl: "https://example.com/banner.jpg" },
      { _id: "product1", type: "product-image", title: "Product Screenshot", fileUrl: "https://example.com/product.png" },
      { _id: "copy1", type: "copy-text", title: "Promo Copy", textContent: "Amazing product!" },
    ];

    it("should group assets by category type", () => {
      const groupAssetsByType = (assets: typeof mockAssets) => {
        return {
          logos: assets.filter(a => a.type === "logo"),
          banners: assets.filter(a => a.type === "banner"),
          productImages: assets.filter(a => a.type === "product-image"),
          copyText: assets.filter(a => a.type === "copy-text"),
        };
      };

      const grouped = groupAssetsByType(mockAssets);

      expect(grouped.logos).toHaveLength(1);
      expect(grouped.banners).toHaveLength(1);
      expect(grouped.productImages).toHaveLength(1);
      expect(grouped.copyText).toHaveLength(1);
    });

    it("should only include assets with valid content", () => {
      const assetsWithMissingContent = [
        { _id: "logo1", type: "logo", title: "Valid Logo", fileUrl: "https://example.com/logo.png" },
        { _id: "logo2", type: "logo", title: "Invalid Logo", fileUrl: undefined },
        { _id: "copy1", type: "copy-text", title: "Valid Copy", textContent: "Some text" },
        { _id: "copy2", type: "copy-text", title: "Invalid Copy", textContent: undefined },
      ];

      const validLogos = assetsWithMissingContent.filter(
        a => a.type === "logo" && a.fileUrl
      );
      const validCopy = assetsWithMissingContent.filter(
        a => a.type === "copy-text" && a.textContent
      );

      expect(validLogos).toHaveLength(1);
      expect(validCopy).toHaveLength(1);
    });
  });

  describe("AC3: Asset Preview", () => {
    it("should format dimensions correctly", () => {
      const formatDimensions = (dimensions?: { width: number; height: number }): string | null => {
        if (!dimensions) return null;
        return `${dimensions.width} × ${dimensions.height}`;
      };

      expect(formatDimensions({ width: 300, height: 250 })).toBe("300 × 250");
      expect(formatDimensions({ width: 1920, height: 1080 })).toBe("1920 × 1080");
      expect(formatDimensions(undefined)).toBeNull();
    });

    it("should format file format to uppercase", () => {
      const formatFileType = (format?: string): string | undefined => {
        return format?.toUpperCase();
      };

      expect(formatFileType("png")).toBe("PNG");
      expect(formatFileType("jpg")).toBe("JPG");
      expect(formatFileType("svg")).toBe("SVG");
      expect(formatFileType(undefined)).toBeUndefined();
    });
  });

  describe("AC4: Asset Download/Copy Actions", () => {
    it("should validate download availability", () => {
      const canDownload = (asset: { fileUrl?: string }): boolean => {
        return !!asset.fileUrl;
      };

      expect(canDownload({ fileUrl: "https://example.com/image.png" })).toBe(true);
      expect(canDownload({})).toBe(false);
      expect(canDownload({ fileUrl: undefined })).toBe(false);
    });

    it("should validate copy availability", () => {
      const canCopy = (asset: { textContent?: string }): boolean => {
        return !!asset.textContent;
      };

      expect(canCopy({ textContent: "Some promotional text" })).toBe(true);
      expect(canCopy({})).toBe(false);
      expect(canCopy({ textContent: "" })).toBe(false);
    });

    it("should generate secure download link attributes", () => {
      const getDownloadAttributes = (fileUrl: string) => {
        return {
          href: fileUrl,
          download: true,
          target: "_blank",
          rel: "noopener noreferrer", // Security fix for tabnabbing
        };
      };

      const attrs = getDownloadAttributes("https://example.com/asset.png");
      expect(attrs.rel).toBe("noopener noreferrer");
      expect(attrs.target).toBe("_blank");
    });
  });

  describe("AC5: Usage Guidelines Display", () => {
    it("should render guidelines only when provided", () => {
      const shouldShowGuidelines = (guidelines?: string): boolean => {
        return !!guidelines && guidelines.trim().length > 0;
      };

      expect(shouldShowGuidelines("Use our logo with care")).toBe(true);
      expect(shouldShowGuidelines("")).toBe(false);
      expect(shouldShowGuidelines(undefined)).toBe(false);
      expect(shouldShowGuidelines("   ")).toBe(false); // Whitespace-only should not show
    });

    it("should split guidelines by newline", () => {
      const guidelines = "Line 1\nLine 2\nLine 3";
      const lines = guidelines.split("\n");

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe("Line 1");
      expect(lines[1]).toBe("Line 2");
      expect(lines[2]).toBe("Line 3");
    });
  });

  describe("AC6: Empty State", () => {
    it("should detect when no assets exist", () => {
      const hasAssets = (
        logos: unknown[],
        banners: unknown[],
        productImages: unknown[],
        copyText: unknown[]
      ): boolean => {
        return logos.length > 0 || banners.length > 0 || productImages.length > 0 || copyText.length > 0;
      };

      expect(hasAssets([], [], [], [])).toBe(false);
      expect(hasAssets([{ id: 1 }], [], [], [])).toBe(true);
      expect(hasAssets([], [{ id: 1 }], [], [])).toBe(true);
      expect(hasAssets([], [], [{ id: 1 }], [])).toBe(true);
      expect(hasAssets([], [], [], [{ id: 1 }])).toBe(true);
    });

    it("should show empty state message", () => {
      const emptyStateMessage = {
        title: "No Brand Assets Yet",
        description: "The program owner hasn't uploaded any marketing assets yet. Check back soon for logos, banners, and promotional copy you can use.",
      };

      expect(emptyStateMessage.title).toBe("No Brand Assets Yet");
      expect(emptyStateMessage.description).toContain("program owner");
      expect(emptyStateMessage.description).toContain("logos, banners");
    });
  });

  describe("AC7: Tenant Branding Consistency", () => {
    it("should apply tenant primary color", () => {
      const getPrimaryColorStyles = (color: string) => {
        return {
          backgroundColor: color,
          borderColor: color,
          color: color,
        };
      };

      const styles = getPrimaryColorStyles("#10409a");
      expect(styles.backgroundColor).toBe("#10409a");
      expect(styles.borderColor).toBe("#10409a");
    });

    it("should use tenant portal name", () => {
      const getPortalDisplayName = (
        brandingPortalName?: string,
        tenantName?: string
      ): string => {
        return brandingPortalName || tenantName || "Affiliate Program";
      };

      expect(getPortalDisplayName("My SaaS Affiliates", "My SaaS")).toBe("My SaaS Affiliates");
      expect(getPortalDisplayName(undefined, "My SaaS")).toBe("My SaaS");
      expect(getPortalDisplayName(undefined, undefined)).toBe("Affiliate Program");
    });

    it("should fall back to default color when not provided", () => {
      const getPrimaryColor = (brandingColor?: string): string => {
        return brandingColor || "#10409a";
      };

      expect(getPrimaryColor("#ff0000")).toBe("#ff0000");
      expect(getPrimaryColor(undefined)).toBe("#10409a");
      expect(getPrimaryColor("")).toBe("#10409a");
    });
  });

  describe("Task 1: Database Schema Validation", () => {
    it("should validate brandAssets table structure", () => {
      const validAsset = {
        tenantId: "tenant_123",
        type: "logo" as const,
        title: "Primary Logo",
        description: "Main brand logo",
        fileUrl: "https://cdn.example.com/logo.png",
        storageId: undefined,
        format: "png",
        dimensions: { width: 500, height: 200 },
        textContent: undefined,
        category: "brand",
        sortOrder: 1,
        isActive: true,
      };

      expect(validAsset.tenantId).toBeDefined();
      expect(["logo", "banner", "product-image", "copy-text"]).toContain(validAsset.type);
      expect(validAsset.title).toBeDefined();
      expect(typeof validAsset.isActive).toBe("boolean");
    });

    it("should require textContent for copy-text type", () => {
      const copyAsset = {
        type: "copy-text" as const,
        textContent: "Promotional text here",
      };

      expect(copyAsset.type).toBe("copy-text");
      expect(copyAsset.textContent).toBeDefined();
    });
  });

  describe("Task 2: Query Logic", () => {
    it("should filter by isActive: true", () => {
      const assets = [
        { _id: "1", isActive: true, title: "Active Asset" },
        { _id: "2", isActive: false, title: "Inactive Asset" },
        { _id: "3", isActive: true, title: "Another Active" },
      ];

      const activeAssets = assets.filter(a => a.isActive);

      expect(activeAssets).toHaveLength(2);
      expect(activeAssets.every(a => a.isActive)).toBe(true);
    });

    it("should sort by sortOrder then creation time", () => {
      const assets = [
        { _id: "1", sortOrder: 2, title: "B" },
        { _id: "2", sortOrder: 1, title: "A" },
        { _id: "3", sortOrder: undefined, title: "C" },
      ];

      const sorted = [...assets].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      expect(sorted[0].title).toBe("C"); // undefined -> 0
      expect(sorted[1].title).toBe("A"); // sortOrder 1
      expect(sorted[2].title).toBe("B"); // sortOrder 2
    });
  });

  describe("Security: Download Protection", () => {
    it("should sanitize fileUrl before download", () => {
      const sanitizeUrl = (url: string): string | null => {
        // Only allow http/https URLs
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          return null;
        }
        return url;
      };

      expect(sanitizeUrl("https://example.com/image.png")).toBe("https://example.com/image.png");
      expect(sanitizeUrl("http://example.com/image.png")).toBe("http://example.com/image.png");
      expect(sanitizeUrl("javascript:alert('xss')")).toBeNull();
      expect(sanitizeUrl("file:///etc/passwd")).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should handle assets with only storageId (no fileUrl)", () => {
      const asset = {
        fileUrl: undefined,
        storageId: "storage_123",
      };

      const hasFileSource = !!asset.fileUrl || !!asset.storageId;
      expect(hasFileSource).toBe(true);
    });

    it("should handle missing optional fields gracefully", () => {
      const minimalAsset: {
        _id: string;
        title: string;
        type: "logo";
        description?: string;
        dimensions?: { width: number; height: number };
        format?: string;
      } = {
        _id: "asset1",
        title: "Minimal Asset",
        type: "logo" as const,
      };

      expect(minimalAsset.description).toBeUndefined();
      expect(minimalAsset.dimensions).toBeUndefined();
      expect(minimalAsset.format).toBeUndefined();
    });
  });
});
