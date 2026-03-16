import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Brand Asset Library Queries
 *
 * Provides access to marketing assets uploaded by the SaaS Owner.
 * Assets are organized by type: logos, banners, product-images, copy-text.
 */

/**
 * Get tenant context by ID for affiliate portal.
 * Returns tenant branding and settings using tenantId from session.
 */
export const getAffiliateTenantContextById = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.object({
      tenantId: v.id("tenants"),
      name: v.string(),
      slug: v.string(),
      branding: v.optional(v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        portalName: v.optional(v.string()),
        assetGuidelines: v.optional(v.string()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);

    if (!tenant) {
      return null;
    }

    return {
      tenantId: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      branding: tenant.branding,
    };
  },
});

/**
 * Get all brand assets for an affiliate portal, grouped by category.
 * Returns active assets filtered by tenant, organized by type.
 */
export const getAffiliateBrandAssets = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    logos: v.array(v.object({
      _id: v.id("brandAssets"),
      title: v.string(),
      description: v.optional(v.string()),
      fileUrl: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
      format: v.optional(v.string()),
      dimensions: v.optional(v.object({
        width: v.number(),
        height: v.number(),
      })),
      sortOrder: v.optional(v.number()),
    })),
    banners: v.array(v.object({
      _id: v.id("brandAssets"),
      title: v.string(),
      description: v.optional(v.string()),
      fileUrl: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
      format: v.optional(v.string()),
      dimensions: v.optional(v.object({
        width: v.number(),
        height: v.number(),
      })),
      sortOrder: v.optional(v.number()),
    })),
    productImages: v.array(v.object({
      _id: v.id("brandAssets"),
      title: v.string(),
      description: v.optional(v.string()),
      fileUrl: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
      format: v.optional(v.string()),
      dimensions: v.optional(v.object({
        width: v.number(),
        height: v.number(),
      })),
      sortOrder: v.optional(v.number()),
    })),
    copyText: v.array(v.object({
      _id: v.id("brandAssets"),
      title: v.string(),
      description: v.optional(v.string()),
      textContent: v.optional(v.string()),
      sortOrder: v.optional(v.number()),
    })),
    usageGuidelines: v.optional(v.string()),
    hasAssets: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Verify tenant exists
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Fetch all active assets for tenant
    const assets = await ctx.db
      .query("brandAssets")
      .withIndex("by_tenant_and_active", (q) => 
        q.eq("tenantId", args.tenantId).eq("isActive", true)
      )
      .order("asc")
      .collect();

    // Group by type
    const logos = assets
      .filter(a => a.type === "logo" && (a.fileUrl || a.storageId))
      .map(a => ({
        _id: a._id,
        title: a.title,
        description: a.description,
        fileUrl: a.fileUrl,
        storageId: a.storageId,
        format: a.format,
        dimensions: a.dimensions,
        sortOrder: a.sortOrder,
      }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const banners = assets
      .filter(a => a.type === "banner" && (a.fileUrl || a.storageId))
      .map(a => ({
        _id: a._id,
        title: a.title,
        description: a.description,
        fileUrl: a.fileUrl,
        storageId: a.storageId,
        format: a.format,
        dimensions: a.dimensions,
        sortOrder: a.sortOrder,
      }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const productImages = assets
      .filter(a => a.type === "product-image" && (a.fileUrl || a.storageId))
      .map(a => ({
        _id: a._id,
        title: a.title,
        description: a.description,
        fileUrl: a.fileUrl,
        storageId: a.storageId,
        format: a.format,
        dimensions: a.dimensions,
        sortOrder: a.sortOrder,
      }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const copyText = assets
      .filter(a => a.type === "copy-text" && a.textContent)
      .map(a => ({
        _id: a._id,
        title: a.title,
        description: a.description,
        textContent: a.textContent,
        sortOrder: a.sortOrder,
      }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    // Get usage guidelines from tenant branding
    const usageGuidelines = tenant.branding?.assetGuidelines;

    const hasAssets = logos.length > 0 || banners.length > 0 || productImages.length > 0 || copyText.length > 0;

    return {
      logos,
      banners,
      productImages,
      copyText,
      usageGuidelines,
      hasAssets,
    };
  },
});

/**
 * Get a single brand asset by ID.
 * Used for asset detail views or direct downloads.
 */
export const getBrandAssetById = query({
  args: { assetId: v.id("brandAssets") },
  returns: v.union(
    v.object({
      _id: v.id("brandAssets"),
      tenantId: v.id("tenants"),
      type: v.union(
        v.literal("logo"),
        v.literal("banner"),
        v.literal("product-image"),
        v.literal("copy-text"),
      ),
      title: v.string(),
      description: v.optional(v.string()),
      fileUrl: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
      format: v.optional(v.string()),
      dimensions: v.optional(v.object({
        width: v.number(),
        height: v.number(),
      })),
      textContent: v.optional(v.string()),
      category: v.optional(v.string()),
      sortOrder: v.optional(v.number()),
      isActive: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    return asset || null;
  },
});
