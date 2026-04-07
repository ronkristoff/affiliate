/** @jsxImportSource react */
import { query, mutation, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./tenantContext";
import { hasPermission } from "./permissions";
import type { Role } from "./permissions";
import { obfuscate, deobfuscate } from "./encryption";
import { seedStats } from "./tenantStats";
import DeletionReminderEmail from "./emails/DeletionReminderEmail";
import DomainChangeNotificationEmail from "./emails/DomainChangeNotificationEmail";
import { render } from "@react-email/components";
import React from "react";
import { components } from "./_generated/api";
import { Resend } from "@convex-dev/resend";

const resendInstance: Resend = new Resend(components.resend, {
  testMode: false,
});


/**
 * SaligPay connection status types
 */
export type SaligPayConnectionMode = "mock" | "real";

export interface SaligPayCredentials {
  mode: SaligPayConnectionMode;
  connectedAt: number;
  mockMerchantId?: string;
  mockAccessToken?: string;
  mockRefreshToken?: string;
  realMerchantId?: string;
  realAccessToken?: string;
  realRefreshToken?: string;
  expiresAt?: number;
}

/**
 * Create a new tenant with the given name, slug, and domain.
 * Used during user registration to create a tenant for the new SaaS owner.
 */
export const createTenant = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    domain: v.string(),
  },
  returns: v.id("tenants"),
  handler: async (ctx, args) => {
    // Check if slug is already taken
    const existingTenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existingTenant) {
      throw new Error(`Tenant slug "${args.slug}" is already taken`);
    }

    // Check if domain is already taken
    const existingTenantByDomain = await ctx.db
      .query("tenants")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .first();

    if (existingTenantByDomain) {
      throw new Error(`A tenant with domain "${args.domain}" already exists`);
    }

    // Create tenant with default settings
    const trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000; // 14 days from now

    const tenantId = await ctx.db.insert("tenants", {
      name: args.name,
      slug: args.slug,
      domain: args.domain,
      plan: "starter",
      trialEndsAt,
      status: "active",
      branding: {
        portalName: args.name,
      },
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "tenant_created",
      entityType: "tenant",
      entityId: tenantId,
      actorType: "system",
      newValue: { name: args.name, slug: args.slug, domain: args.domain, plan: "starter" },
    });

    // Seed denormalized tenantStats counters
    await ctx.runMutation(internal.tenantStats.seedStats, { tenantId });

    return tenantId;
  },
});

/**
 * Update the tenant's main website domain.
 * This is the domain where the tenant's product is hosted and where referral links point to.
 * Changing this domain will invalidate all existing referral links.
 * @security Requires 'settings:manage', 'settings:*', or 'manage:*' permission.
 */
export const updateTenantWebsiteDomain = mutation({
  args: {
    domain: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Check permission - require settings:* or manage:* permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "settings:*") && !hasPermission(role, "settings:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId: authUser.tenantId,
        action: "permission_denied",
        entityType: "tenant",
        entityId: authUser.tenantId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=settings:manage, attemptedAction=updateTenantWebsiteDomain`,
        },
      });
      throw new Error("Access denied: You require 'settings:manage' permission to update domain settings");
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Validate domain format
    let cleanedDomain = args.domain.trim().toLowerCase();
    
    // Strip protocol if provided
    cleanedDomain = cleanedDomain.replace(/^https?:\/\//, "");
    
    // Strip www.
    cleanedDomain = cleanedDomain.replace(/^www\./, "");
    
    // Strip trailing slashes and path
    cleanedDomain = cleanedDomain.split("/")[0];
    
    // Strip port if present
    cleanedDomain = cleanedDomain.split(":")[0];

    // Reject empty domain
    if (!cleanedDomain || cleanedDomain.length < 3) {
      throw new Error("Domain is required and must be at least 3 characters");
    }

    // Reject localhost
    if (cleanedDomain === "localhost" || cleanedDomain.includes("localhost")) {
      throw new Error("localhost is not allowed. Please provide a production domain");
    }

    // Reject IP addresses
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(cleanedDomain)) {
      throw new Error("IP addresses are not allowed. Please provide a domain name");
    }

    // Basic domain format check
    const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
    if (!domainRegex.test(cleanedDomain)) {
      throw new Error("Invalid domain format. Please provide a valid domain like 'yourcompany.com'");
    }

    // Check if domain is already taken by another tenant
    if (cleanedDomain !== tenant.domain) {
      const existingTenant = await ctx.db
        .query("tenants")
        .withIndex("by_domain", (q) => q.eq("domain", cleanedDomain))
        .first();

      if (existingTenant) {
        throw new Error("A tenant with this domain already exists");
      }
    }

    const previousDomain = tenant.domain;

    // Update tenant domain and clear tracking verification
    await ctx.db.patch(authUser.tenantId, {
      domain: cleanedDomain,
      trackingVerifiedAt: undefined, // Require re-verification
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "tenant_domain_updated",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { domain: previousDomain },
      newValue: { domain: cleanedDomain },
      metadata: {
        warning: "Domain change breaks all existing referral links",
        trackingVerificationCleared: true,
      },
    });

    // Notify all active affiliates about the domain change
    const affiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", authUser.tenantId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    for (const affiliate of affiliates) {
      await ctx.scheduler.runAfter(0, internal.tenants.sendDomainChangeNotification, {
        affiliateId: affiliate._id,
        tenantId: authUser.tenantId,
        oldDomain: previousDomain,
        newDomain: cleanedDomain,
      });
    }

    return {
      success: true,
      message: `Domain updated to ${cleanedDomain}. Tracking verification has been reset - please reinstall the tracking snippet on your new domain. All active affiliates have been notified of the change.`,
    };
  },
});

/**
 * Send domain change notification to an affiliate.
 * Internal action - called by updateTenantWebsiteDomain mutation.
 */
export const sendDomainChangeNotification = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    tenantId: v.id("tenants"),
    oldDomain: v.string(),
    newDomain: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get affiliate details
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.status !== "active") {
      return null;
    }

    // Get tenant details
    const tenant = await ctx.runQuery(internal.tenants.getTenantInternal, {
      tenantId: args.tenantId,
    });

    if (!tenant) {
      console.error("Cannot send domain change notification: tenant not found");
      return null;
    }

    try {
      await resendInstance.sendEmail(ctx, {
        from: "Affiliate Notifications <notifications@boboddy.business>",
        to: affiliate.email,
        subject: `Important: ${tenant.name} has updated their website domain`,
        html: await render(
          React.createElement(DomainChangeNotificationEmail, {
            affiliateName: affiliate.name || "Affiliate",
            tenantName: tenant.name,
            oldDomain: args.oldDomain,
            newDomain: args.newDomain,
          })
        ),
      });

      console.log(`Domain change notification sent to ${affiliate.email}`);
    } catch (error) {
      console.error("Failed to send domain change notification:", error);
    }

    return null;
  },
});

/**
 * Get tenant by ID.
 */
export const getTenant = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      plan: v.string(),
      trialEndsAt: v.optional(v.number()),
      status: v.string(),
      branding: v.optional(v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        portalName: v.optional(v.string()),
        customDomain: v.optional(v.string()),
        domainStatus: v.optional(v.string()),
        domainVerifiedAt: v.optional(v.number()),
        sslProvisionedAt: v.optional(v.number()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tenantId);
  },
});

/**
 * Get tenant by slug.
 */
export const getTenantBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      plan: v.string(),
      trialEndsAt: v.optional(v.number()),
      status: v.string(),
      branding: v.optional(v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        portalName: v.optional(v.string()),
        customDomain: v.optional(v.string()),
        domainStatus: v.optional(v.string()),
        domainVerifiedAt: v.optional(v.number()),
        sslProvisionedAt: v.optional(v.number()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/**
 * Get tenant context including branding and subscription info.
 * Used to load tenant context for authenticated requests.
 */
export const getTenantContext = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.object({
      tenantId: v.id("tenants"),
      name: v.string(),
      slug: v.string(),
      plan: v.string(),
      status: v.string(),
      isTrial: v.boolean(),
      trialDaysRemaining: v.optional(v.number()),
      branding: v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        portalName: v.optional(v.string()),
        customDomain: v.optional(v.string()),
        domainStatus: v.optional(v.string()),
        domainVerifiedAt: v.optional(v.number()),
        sslProvisionedAt: v.optional(v.number()),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      return null;
    }

    const now = Date.now();
    const isTrial = tenant.trialEndsAt ? tenant.trialEndsAt > now : false;
    const trialDaysRemaining = tenant.trialEndsAt && isTrial
      ? Math.ceil((tenant.trialEndsAt - now) / (24 * 60 * 60 * 1000))
      : undefined;

    return {
      tenantId: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      status: tenant.status,
      isTrial,
      trialDaysRemaining,
      branding: tenant.branding || { portalName: tenant.name },
    };
  },
});

/**
 * Get tenant branding for the current authenticated user.
 * Used by settings pages to get tenant branding without passing tenantId.
 */
export const getCurrentUserTenantBranding = query({
  args: {},
  returns: v.union(
    v.object({
      tenantId: v.id("tenants"),
      name: v.string(),
      branding: v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        portalName: v.optional(v.string()),
        customDomain: v.optional(v.string()),
        domainStatus: v.optional(v.string()),
        domainVerifiedAt: v.optional(v.number()),
        sslProvisionedAt: v.optional(v.number()),
      }),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return null;
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      return null;
    }

    return {
      tenantId: tenant._id,
      name: tenant.name,
      branding: tenant.branding || { portalName: tenant.name },
    };
  },
});

/**
 * Update tenant information.
 * @security Requires 'settings:manage' or 'manage:*' permission.
 */
export const updateTenant = mutation({
  args: {
    tenantId: v.id("tenants"),
    updates: v.object({
      name: v.optional(v.string()),
      branding: v.optional(v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        portalName: v.optional(v.string()),
      })),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }
    
    // Check permission - require billing:* or billing:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "billing:*") && !hasPermission(role, "billing:manage") && !hasPermission(role, "manage:*")) {
      // Log unauthorized access attempt
      await ctx.db.insert("auditLogs", {
        tenantId: args.tenantId,
        action: "permission_denied",
        entityType: "tenant",
        entityId: args.tenantId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=settings:manage, attemptedAction=updateTenant`,
        },
      });
      throw new Error("Access denied: You require 'settings:manage' permission to update tenant settings");
    }
    
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Validate tenant ownership
    if (tenant._id !== authUser.tenantId) {
      throw new Error("Tenant not found or access denied");
    }

    await ctx.db.patch(args.tenantId, args.updates);

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "tenant_updated",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: tenant,
      newValue: { ...tenant, ...args.updates },
    });

    return null;
  },
});

/**
 * Update tenant branding settings.
 * @security Requires 'settings:manage', 'settings:*', or 'manage:*' permission.
 */
export const updateTenantBranding = mutation({
  args: {
    branding: v.object({
      logoUrl: v.optional(v.string()),
      primaryColor: v.optional(v.string()),
      portalName: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    branding: v.optional(v.object({
      logoUrl: v.optional(v.string()),
      primaryColor: v.optional(v.string()),
      portalName: v.optional(v.string()),
    })),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }
    
    // Check permission - require settings:* or manage:* permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "settings:*") && !hasPermission(role, "settings:manage") && !hasPermission(role, "manage:*")) {
      // Log unauthorized access attempt
      await ctx.db.insert("auditLogs", {
        tenantId: authUser.tenantId,
        action: "permission_denied",
        entityType: "tenant",
        entityId: authUser.tenantId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=settings:manage, attemptedAction=updateTenantBranding`,
        },
      });
      throw new Error("Access denied: You require 'settings:manage' permission to update branding");
    }
    
    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Validate color format if provided
    if (args.branding.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(args.branding.primaryColor)) {
      throw new Error("Invalid color format. Use #RRGGBB");
    }
    
    // Validate portal name length if provided
    if (args.branding.portalName && args.branding.portalName.length > 50) {
      throw new Error("Portal name must be 50 characters or less");
    }

    // Validate logo URL if provided (basic URL validation)
    if (args.branding.logoUrl) {
      try {
        new URL(args.branding.logoUrl);
      } catch {
        throw new Error("Invalid logo URL format");
      }
    }
    
    // Update tenant branding
    const updatedBranding = {
      ...tenant.branding,
      logoUrl: args.branding.logoUrl ?? tenant.branding?.logoUrl,
      primaryColor: args.branding.primaryColor ?? tenant.branding?.primaryColor,
      portalName: args.branding.portalName ?? tenant.branding?.portalName,
    };
    
    await ctx.db.patch(authUser.tenantId, {
      branding: updatedBranding,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "branding_updated",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: tenant.branding,
      newValue: updatedBranding,
    });

    return {
      success: true,
      branding: updatedBranding,
    };
  },
});

/**
 * Reset tenant branding to defaults.
 * @security Requires 'settings:manage', 'settings:*', or 'manage:*' permission.
 */
export const resetTenantBranding = mutation({
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Check permission - require settings:* or manage:* permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "settings:*") && !hasPermission(role, "settings:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId: authUser.tenantId,
        action: "permission_denied",
        entityType: "tenant",
        entityId: authUser.tenantId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=settings:manage, attemptedAction=resetTenantBranding`,
        },
      });
      throw new Error("Access denied: You require 'settings:manage' permission to reset branding");
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const previousBranding = tenant.branding;

    // Reset branding to empty/undefined
    await ctx.db.patch(authUser.tenantId, {
      branding: {},
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "branding_reset",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: previousBranding,
      newValue: {},
    });

    return {
      success: true,
    };
  },
});

/**
 * Internal mutation to update tenant logo URL.
 */
export const _updateTenantLogoInternal = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    logoUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    await ctx.db.patch(args.tenantId, {
      branding: {
        ...tenant.branding,
        logoUrl: args.logoUrl,
      },
    });

    return null;
  },
});

/**
 * Check if a tenant slug is available.
 */
export const isSlugAvailable = query({
  args: {
    slug: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    return existing === null;
  },
});

/**
 * Generate a unique slug from a company name.
 */
export const generateSlug = query({
  args: {
    companyName: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const baseSlug = args.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    let slug = baseSlug;
    let counter = 1;

    // Check if slug is available, append counter if not
    while (true) {
      const existing = await ctx.db
        .query("tenants")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  },
});

/**
 * Get SaligPay connection status for a tenant
 */
export const getSaligPayConnectionStatus = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.object({
      isConnected: v.boolean(),
      mode: v.optional(v.string()),
      connectedAt: v.optional(v.number()),
      merchantId: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || !tenant.saligPayCredentials) {
      return null;
    }

    const creds = tenant.saligPayCredentials;
    return {
      isConnected: true,
      mode: creds.mode,
      connectedAt: creds.connectedAt,
      merchantId: creds.mockMerchantId || creds.realMerchantId,
      expiresAt: creds.expiresAt,
    };
  },
});

/**
 * Connect SaligPay with mock credentials
 * Used for development/testing - generates mock tokens
 */
export const connectMockSaligPay = mutation({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    success: v.boolean(),
    mode: v.union(v.literal("mock"), v.literal("real")),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Validate tenant ownership
    if (authUser.tenantId !== args.tenantId) {
      throw new Error("Access denied: Cannot connect SaligPay for another tenant");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Generate mock credentials
    const mockMerchantId = `mock-merchant-${Date.now()}`;
    const mockClientId = `mock-client-${Date.now()}`;
    const mockClientSecret = `mock-secret-${Date.now()}`;
    const mockAccessToken = `mock-access-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const mockRefreshToken = `mock-refresh-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const expiresAt = Date.now() + 3600 * 1000; // 1 hour

    // Obfuscate credentials before storing
    const obfuscatedAccessToken = obfuscate(mockAccessToken);
    const obfuscatedRefreshToken = obfuscate(mockRefreshToken);

    // Store mock credentials (obfuscated)
    await ctx.db.patch(args.tenantId, {
      billingProvider: "saligpay",
      saligPayCredentials: {
        mode: "mock",
        connectedAt: Date.now(),
        mockMerchantId,
        clientId: mockClientId,
        clientSecret: mockClientSecret,
        mockAccessToken: obfuscatedAccessToken,
        mockRefreshToken: obfuscatedRefreshToken,
        expiresAt,
      },
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "saligpay_connected",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      newValue: { mode: "mock", merchantId: mockMerchantId },
    });

    return {
      success: true,
      mode: "mock" as const,
    };
  },
});

/**
 * Disconnect SaligPay integration
 */
export const disconnectSaligPay = mutation({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Validate tenant ownership
    if (authUser.tenantId !== args.tenantId) {
      throw new Error("Access denied: Cannot disconnect SaligPay for another tenant");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const wasConnected = !!tenant.saligPayCredentials;

    // Remove SaligPay credentials and billing provider
    await ctx.db.patch(args.tenantId, {
      saligPayCredentials: undefined,
      billingProvider: undefined,
    });

    // Create audit log entry if there was a connection
    if (wasConnected) {
      await ctx.db.insert("auditLogs", {
        tenantId: args.tenantId,
        action: "saligpay_disconnected",
        entityType: "tenant",
        entityId: args.tenantId,
        actorId: authUser.userId,
        actorType: "user",
        previousValue: tenant.saligPayCredentials,
      });
    }

    return true;
  },
});

// =============================================================================
// Stripe Connection (MVP — Manual Signing Secret)
// =============================================================================

/**
 * Connect Stripe integration (MVP: manual signing secret input)
 * Merchant pastes their Stripe webhook signing secret from Stripe Dashboard.
 */
export const connectStripe = mutation({
  args: {
    tenantId: v.id("tenants"),
    signingSecret: v.string(),
    stripeAccountId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    connectedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    if (authUser.tenantId !== args.tenantId) {
      throw new Error("Access denied: Cannot connect Stripe for another tenant");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // If a different provider is already connected, disconnect it first
    if (tenant.billingProvider && tenant.billingProvider !== "stripe") {
      if (tenant.billingProvider === "saligpay" && tenant.saligPayCredentials) {
        await ctx.db.patch(args.tenantId, {
          saligPayCredentials: undefined,
        });
        await ctx.db.insert("auditLogs", {
          tenantId: args.tenantId,
          action: "saligpay_disconnected",
          entityType: "tenant",
          entityId: args.tenantId,
          actorId: authUser.userId,
          actorType: "user",
          previousValue: { reason: "switched_to_stripe" },
        });
      }
    }

    const connectedAt = Date.now();

    // Obfuscate the signing secret before storing
    const obfuscatedSecret = obfuscate(args.signingSecret);

    await ctx.db.patch(args.tenantId, {
      billingProvider: "stripe",
      stripeCredentials: {
        signingSecret: obfuscatedSecret,
        mode: "live",
        connectedAt,
      },
      stripeAccountId: args.stripeAccountId || undefined,
    });

    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "stripe_connected",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      newValue: { stripeAccountId: args.stripeAccountId, mode: "live" },
    });

    return { success: true, connectedAt };
  },
});

/**
 * Disconnect Stripe integration
 */
export const disconnectStripe = mutation({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    if (authUser.tenantId !== args.tenantId) {
      throw new Error("Access denied: Cannot disconnect Stripe for another tenant");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const wasConnected = !!tenant.stripeCredentials;

    await ctx.db.patch(args.tenantId, {
      stripeCredentials: undefined,
      stripeAccountId: undefined,
      billingProvider: undefined,
    });

    if (wasConnected) {
      await ctx.db.insert("auditLogs", {
        tenantId: args.tenantId,
        action: "stripe_disconnected",
        entityType: "tenant",
        entityId: args.tenantId,
        actorId: authUser.userId,
        actorType: "user",
        previousValue: { stripeAccountId: tenant.stripeAccountId },
      });
    }

    return true;
  },
});

/**
 * Get Stripe connection status for a tenant
 */
export const getStripeConnectionStatus = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.object({
      isConnected: v.literal(true),
      stripeAccountId: v.optional(v.string()),
      mode: v.optional(v.string()),
      connectedAt: v.optional(v.number()),
    }),
    v.object({
      isConnected: v.literal(false),
    })
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || !tenant.stripeCredentials) {
      return { isConnected: false as const };
    }

    return {
      isConnected: true as const,
      stripeAccountId: tenant.stripeAccountId,
      mode: tenant.stripeCredentials.mode,
      connectedAt: tenant.stripeCredentials.connectedAt,
    };
  },
});

/**
 * Internal Query: Get tenant by Stripe Account ID
 * Used by Stripe webhook handler to resolve tenant from event payload
 */
export const getTenantByStripeAccountId = internalQuery({
  args: {
    stripeAccountId: v.string(),
  },
  returns: v.nullable(
    v.object({
      _id: v.id("tenants"),
      name: v.string(),
      stripeCredentials: v.optional(v.object({
        signingSecret: v.string(),
        mode: v.optional(v.string()),
        connectedAt: v.optional(v.number()),
      })),
    })
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_stripe_account_id", (q) => q.eq("stripeAccountId", args.stripeAccountId))
      .first();

    if (!tenant) {
      return null;
    }

    return {
      _id: tenant._id,
      name: tenant.name,
      stripeCredentials: tenant.stripeCredentials,
    };
  },
});

/**
 * Internal query to get tenant details by ID.
 * Used by internal actions (like email notifications).
 */
export const getTenantInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.object({
      name: v.string(),
      slug: v.string(),
      branding: v.optional(v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        portalName: v.optional(v.string()),
        customDomain: v.optional(v.string()),
        domainStatus: v.optional(v.string()),
        domainVerifiedAt: v.optional(v.number()),
        sslProvisionedAt: v.optional(v.number()),
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
      name: tenant.name,
      slug: tenant.slug,
      branding: tenant.branding,
    };
  },
});

/**
 * Delete all tenant data including affiliates, campaigns, commissions, etc.
 * Called 30 days after subscription cancellation.
 * 
 * @param tenantId - The tenant to delete
 */
export const deleteTenantData = internalMutation({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Verify tenant exists and is cancelled
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      console.log(`Tenant ${args.tenantId} not found, skipping deletion`);
      return null;
    }

    if (tenant.subscriptionStatus !== "cancelled") {
      console.log(`Tenant ${args.tenantId} is not cancelled, skipping deletion`);
      return null;
    }

    // Deletion guard: if deletionScheduledDate was cleared (by admin reactivation),
    // abort silently. Convex does not expose ctx.scheduler.cancel(), so reactivation
    // clears deletionScheduledDate instead of cancelling the scheduled job.
    if (!tenant.deletionScheduledDate) {
      console.log(`Tenant ${args.tenantId} deletion was cancelled (deletionScheduledDate cleared), skipping`);
      return null;
    }

    // Cascading deletion of all tenant data
    // Note: Convex doesn't support cascading deletes, so we must do it manually

    // Delete all affiliates
    const affiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const affiliate of affiliates) {
      await ctx.db.delete(affiliate._id);
    }

    // Delete all campaigns
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const campaign of campaigns) {
      await ctx.db.delete(campaign._id);
    }

    // Delete all commissions
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const commission of commissions) {
      await ctx.db.delete(commission._id);
    }

    // Delete all payouts
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const payout of payouts) {
      await ctx.db.delete(payout._id);
    }

    // Delete all referral links
    const referralLinks = await ctx.db
      .query("referralLinks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const link of referralLinks) {
      await ctx.db.delete(link._id);
    }

    // Delete all conversions
    const conversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const conversion of conversions) {
      await ctx.db.delete(conversion._id);
    }

    // Delete all clicks
    const clicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const click of clicks) {
      await ctx.db.delete(click._id);
    }

    // Delete all team invitations
    const invitations = await ctx.db
      .query("teamInvitations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
    }

    // Delete all billing history
    const billingHistory = await ctx.db
      .query("billingHistory")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const entry of billingHistory) {
      await ctx.db.delete(entry._id);
    }

    // Delete all audit logs
    const auditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const log of auditLogs) {
      await ctx.db.delete(log._id);
    }

    // Delete all users (except the one performing the action, if applicable)
    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    for (const user of users) {
      await ctx.db.delete(user._id);
    }

    // Delete all referral leads (universal billing provider integration)
    const referralLeads = await ctx.db
      .query("referralLeads")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(1000);

    for (const lead of referralLeads) {
      await ctx.db.delete(lead._id);
    }

    // Delete all tracking pings
    const trackingPings = await ctx.db
      .query("trackingPings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(1000);

    for (const ping of trackingPings) {
      await ctx.db.delete(ping._id);
    }

    // Delete all referral pings
    const referralPings = await ctx.db
      .query("referralPings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(1000);

    for (const rPing of referralPings) {
      await ctx.db.delete(rPing._id);
    }

    // Finally, delete the tenant record itself
    await ctx.db.delete(args.tenantId);

    console.log(`Tenant ${args.tenantId} and all associated data deleted successfully`);
    return null;
  },
});

/**
 * Send deletion reminder email to tenant owner.
 * Called 7 days before scheduled deletion.
 * 
 * @param tenantId - The tenant being deleted
 * @param deletionDate - The scheduled deletion date
 */
export const sendDeletionReminder = internalAction({
  args: {
    tenantId: v.id("tenants"),
    deletionDate: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenant = await ctx.runQuery(internal.tenants.getTenantInternal, {
      tenantId: args.tenantId,
    });
    if (!tenant) {
      console.log(`Tenant ${args.tenantId} not found, skipping reminder`);
      return null;
    }

    // Get all users with owner role
    const users = await ctx.runQuery(internal.users._getOwnersByTenantInternal, {
      tenantId: args.tenantId,
    });

    const owner = users[0];
    if (!owner?.email) {
      console.log(`No owner email found for tenant ${args.tenantId}, skipping reminder`);
      return null;
    }

    const deletionDateStr = new Date(args.deletionDate).toLocaleDateString();
    const daysUntilDeletion = Math.ceil(
      (args.deletionDate - Date.now()) / (1000 * 60 * 60 * 24)
    );

    // Send reminder email
    const emailProps = { deletionDate: deletionDateStr, daysUntilDeletion };
    await resendInstance.sendEmail(ctx, {
      from: "Salig Affiliate <billing@boboddy.business>",
      to: owner.email,
      subject: "Urgent: Your account will be deleted soon",
      html: await render(React.createElement(DeletionReminderEmail, emailProps)),
    });

    // Log email to tenant's email history
    await ctx.runMutation(internal.tenants._logEmailSentInternal, {
      tenantId: args.tenantId,
      type: "deletion_reminder",
      recipientEmail: owner.email,
      subject: "Urgent: Your account will be deleted soon",
    });

    // Log to audit
    await ctx.runMutation(internal.tenants._logAuditEventInternal, {
      tenantId: args.tenantId,
      action: "DELETION_REMINDER_SENT",
      entityType: "tenant",
      entityId: args.tenantId,
      actorType: "system",
      newValue: {
        deletionDate: args.deletionDate,
        recipientEmail: owner.email,
      },
    });

    return null;
  },
});

/**
 * Internal helper to log email sent to tenant's email history.
 * Called by actions that send emails.
 */
export const _logEmailSentInternal = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    type: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("emails", {
      tenantId: args.tenantId,
      type: args.type,
      recipientEmail: args.recipientEmail,
      subject: args.subject,
      status: "sent",
      sentAt: Date.now(),
    });
    return null;
  },
});

/**
 * Internal helper to log audit events.
 * Called by actions that need audit logging.
 */
export const _logAuditEventInternal = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    actorType: v.string(),
    newValue: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      actorType: args.actorType,
      newValue: args.newValue,
    });
    return null;
  },
});

/**
 * Check for tenants needing deletion reminders and send them.
 * Called by cron job daily to catch any missed reminders.
 */
export const checkAndSendDeletionReminders = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
    const eightDaysFromNow = now + 8 * 24 * 60 * 60 * 1000;

    // Find cancelled tenants with deletion scheduled in ~7 days
    // (within the next 24-hour window)
    const tenants = await ctx.runQuery(internal.tenants._getTenantsWithDeletionScheduled, {
      minDate: sevenDaysFromNow,
      maxDate: eightDaysFromNow,
    });

    for (const tenant of tenants) {
      // Send reminder via the action
      await ctx.runAction(internal.tenants.sendDeletionReminder, {
        tenantId: tenant._id,
        deletionDate: tenant.deletionScheduledDate!,
      });
    }

    console.log(`Sent ${tenants.length} deletion reminders`);
    return null;
  },
});

/**
 * Internal query to get tenants with deletion scheduled in a date range.
 */
export const _getTenantsWithDeletionScheduled = internalQuery({
  args: {
    minDate: v.number(),
    maxDate: v.number(),
  },
  returns: v.array(
    v.object({
      _id: v.id("tenants"),
      deletionScheduledDate: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    // Query all cancelled tenants and filter by deletion date
    // Note: In production with many tenants, consider adding an index
    const allTenants = await ctx.db
      .query("tenants")
      .filter((q) => q.eq(q.field("subscriptionStatus"), "cancelled"))
      .collect();

    return allTenants
      .filter(
        (t) =>
          t.deletionScheduledDate &&
          t.deletionScheduledDate >= args.minDate &&
          t.deletionScheduledDate < args.maxDate
      )
      .map((t) => ({
        _id: t._id,
        deletionScheduledDate: t.deletionScheduledDate,
      }));
  },
});

/**
 * Get tenant payout schedule with calculated next payout date.
 * Returns payout schedule configuration and the next expected payout date.
 */
export const getTenantPayoutSchedule = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    payoutDayOfMonth: v.optional(v.number()),
    minimumPayoutAmount: v.optional(v.number()),
    payoutProcessingDays: v.optional(v.number()),
    payoutScheduleNote: v.optional(v.string()),
    nextPayoutDate: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      return {
        payoutDayOfMonth: undefined,
        minimumPayoutAmount: undefined,
        payoutProcessingDays: undefined,
        payoutScheduleNote: undefined,
        nextPayoutDate: undefined,
      };
    }

    const payoutSchedule = tenant.payoutSchedule;

    // If no payout schedule is configured, return undefined values
    if (!payoutSchedule || payoutSchedule.payoutDayOfMonth === undefined) {
      return {
        payoutDayOfMonth: undefined,
        minimumPayoutAmount: undefined,
        payoutProcessingDays: undefined,
        payoutScheduleNote: undefined,
        nextPayoutDate: undefined,
      };
    }

    // Calculate next payout date based on current date
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let nextPayoutMonth = currentMonth;
    let nextPayoutYear = currentYear;
    const payoutDay = payoutSchedule.payoutDayOfMonth;

    // If we're before the payout day this month, next payout is this month
    // Otherwise, it's next month
    if (currentDay >= payoutDay) {
      nextPayoutMonth = currentMonth + 1;
      if (nextPayoutMonth > 11) {
        nextPayoutMonth = 0;
        nextPayoutYear = currentYear + 1;
      }
    }

    // Create next payout date
    const nextPayoutDate = new Date(nextPayoutYear, nextPayoutMonth, payoutDay);

    // Add processing days if configured
    const processingDays = payoutSchedule.payoutProcessingDays || 0;
    if (processingDays > 0) {
      nextPayoutDate.setDate(nextPayoutDate.getDate() + processingDays);
    }

    return {
      payoutDayOfMonth: payoutSchedule.payoutDayOfMonth,
      minimumPayoutAmount: payoutSchedule.minimumPayoutAmount,
      payoutProcessingDays: payoutSchedule.payoutProcessingDays,
      payoutScheduleNote: payoutSchedule.payoutScheduleNote,
      nextPayoutDate: nextPayoutDate.getTime(),
    };
  },
});

/**
 * Domain status types
 */
export type DomainStatus = "pending" | "dns_verification" | "ssl_provisioning" | "active" | "failed";

/**
 * Platform domain constant - used for custom domain CNAME records
 * TODO: Move to environment variable or configuration
 */
const PLATFORM_DOMAIN = "app.saligaffiliate.com";

/**
 * Get tenant domain configuration for the current authenticated user.
 * Returns the current custom domain and its status.
 * @security Requires 'settings:read', 'settings:*', or 'manage:*' permission
 */
export const getTenantDomainConfig = query({
  args: {},
  returns: v.union(
    v.object({
      customDomain: v.optional(v.string()),
      domainStatus: v.optional(v.string()),
      domainVerifiedAt: v.optional(v.number()),
      sslProvisionedAt: v.optional(v.number()),
      platformDomain: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return null;
    }

    // Check permission - require settings:* or manage:* permission to view domain config
    const role = authUser.role as Role;
    if (!hasPermission(role, "settings:*") && !hasPermission(role, "settings:read") && !hasPermission(role, "manage:*")) {
      // Note: Cannot log from query context - mutations only
      // Unauthorized access is silently denied
      return null;
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      return null;
    }

    return {
      customDomain: tenant.branding?.customDomain,
      domainStatus: tenant.branding?.domainStatus,
      domainVerifiedAt: tenant.branding?.domainVerifiedAt,
      sslProvisionedAt: tenant.branding?.sslProvisionedAt,
      platformDomain: PLATFORM_DOMAIN,
    };
  },
});

/**
 * Update tenant custom domain configuration.
 * @security Requires 'settings:manage', 'settings:*', or 'manage:*' permission.
 * @security Requires Scale tier (checked in mutation)
 * @transaction All operations in this mutation are atomic - if any operation fails,
 *   all changes are rolled back (Convex mutation guarantee)
 */
export const updateTenantDomain = mutation({
  args: {
    domain: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    domain: v.optional(v.string()),
    status: v.string(),
    dnsInstructions: v.object({
      recordType: v.string(),
      recordName: v.string(),
      recordValue: v.string(),
    }),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Check permission - require settings:* or manage:* permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "settings:*") && !hasPermission(role, "settings:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId: authUser.tenantId,
        action: "permission_denied",
        entityType: "tenant",
        entityId: authUser.tenantId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=settings:manage, attemptedAction=updateTenantDomain`,
        },
      });
      throw new Error("Access denied: You require 'settings:manage' permission to update domain settings");
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Verify Scale tier - custom domain is only available on Scale tier
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", q => q.eq("tier", tenant.plan))
      .first();

    if (!tierConfig?.features.customDomain) {
      throw new Error("Custom domain is only available on Scale tier. Please upgrade to use this feature.");
    }

    // Validate domain format - no protocol, no path, just hostname
    const domainInput = args.domain.trim().toLowerCase();
    
    // Strip protocol if provided
    const cleanDomain = domainInput
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .trim();

    // Validate domain format (hostname pattern)
    // Rejects: double dots (..), leading/trailing hyphens, IP addresses
    const domainRegex = /^(?!.*\.\.)(?!.*-$)(?!^-)[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(cleanDomain)) {
      throw new Error("Invalid domain format. Please enter a valid domain like 'affiliates.mycompany.com'");
    }

    // Get previous domain for audit log
    const previousDomain = tenant.branding?.customDomain;

    // Platform domain - this should come from env or config
    const platformDomain = "app.saligaffiliate.com";

    // Update tenant with new domain
    const currentBranding = tenant.branding || {};
    await ctx.db.patch(authUser.tenantId, {
      branding: {
        ...currentBranding,
        customDomain: cleanDomain,
        domainStatus: "pending",
        domainVerifiedAt: undefined,
        sslProvisionedAt: undefined,
      },
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "domain_updated",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { customDomain: previousDomain },
      newValue: { customDomain: cleanDomain, domainStatus: "pending" },
    });

    return {
      success: true,
      domain: cleanDomain,
      status: "pending",
      dnsInstructions: {
        recordType: "CNAME",
        recordName: cleanDomain,
        recordValue: platformDomain,
      },
    };
  },
});

/**
 * Verify domain DNS configuration.
 * Checks if the CNAME record is properly configured.
 * @security Requires 'settings:manage', 'settings:*', or 'manage:*' permission.
 * @rate-limit Max 5 attempts per minute per tenant to prevent API abuse
 */
export const verifyDomainDns = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    verified: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Check permission - require settings:* or manage:* permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "settings:*") && !hasPermission(role, "settings:manage") && !hasPermission(role, "manage:*")) {
      throw new Error("Access denied: You require 'settings:manage' permission to verify domain DNS");
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const customDomain = tenant.branding?.customDomain;
    if (!customDomain) {
      throw new Error("No custom domain configured");
    }

    // Rate limiting: Check for recent verification attempts (last minute)
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const recentAttempts = await ctx.db
      .query("auditLogs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", authUser.tenantId))
      .filter((q) => 
        q.and(
          q.eq(q.field("action"), "domain_dns_verification_attempt"),
          q.gte(q.field("_creationTime"), oneMinuteAgo)
        )
      )
      .collect();

    if (recentAttempts.length >= 5) {
      throw new Error("Rate limit exceeded. Please wait before trying again.");
    }

    // Log the verification attempt for rate limiting
    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "domain_dns_verification_attempt",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      newValue: { customDomain },
    });

    const platformDomain = PLATFORM_DOMAIN;

    try {
      // Use DNS over HTTPS (Google DNS API) to check CNAME record
      // AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(customDomain)}&type=CNAME`,
        {
          method: "GET",
          headers: {
            "Accept": "application/dns-json",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`DNS lookup failed with status: ${response.status}`);
      }

      const data = await response.json();

      // Check if CNAME record exists and points to the correct domain
      const cnameRecord = data.Answer?.find((record: { type: number; data: string }) => record.type === 5); // Type 5 = CNAME

      if (cnameRecord && cnameRecord.data.endsWith(platformDomain + ".")) {
        // DNS verified - update status
        const currentBranding = tenant.branding || {};
        await ctx.db.patch(authUser.tenantId, {
          branding: {
            ...currentBranding,
            domainStatus: "dns_verification",
            domainVerifiedAt: Date.now(),
          },
        });

        // Create audit log entry
        await ctx.db.insert("auditLogs", {
          tenantId: authUser.tenantId,
          action: "domain_dns_verified",
          entityType: "tenant",
          entityId: authUser.tenantId,
          actorId: authUser.userId,
          actorType: "user",
          newValue: { customDomain, verifiedAt: Date.now() },
        });

        return {
          success: true,
          verified: true,
          message: "DNS configuration verified successfully. Your domain is pointing to the correct location.",
        };
      } else {
        // DNS not verified
        return {
          success: true,
          verified: false,
          message: `DNS verification failed. Expected CNAME record pointing to '${platformDomain}'. Please check your DNS configuration.`,
        };
      }
    } catch (error) {
      console.error("DNS verification error:", error);
      return {
        success: false,
        verified: false,
        message: "Unable to verify DNS configuration. Please try again later or check your DNS settings.",
      };
    }
  },
});

/**
 * Initiate SSL provisioning for the custom domain.
 * 
 * ⚠️ MVP IMPLEMENTATION NOTE:
 * For MVP, this mutation only updates the status to "ssl_provisioning".
 * Actual SSL certificate provisioning must be handled separately by:
 * 1. Infrastructure-level SSL termination (e.g., Cloudflare, AWS ACM)
 * 2. Manual Let's Encrypt integration (future enhancement)
 * 3. Webhook from SSL provider to _completeSslProvisioning mutation
 * 
 * TODO: Implement actual SSL provisioning automation
 * @security Requires 'settings:manage', 'settings:*', or 'manage:*' permission.
 */
export const initiateSslProvisioning = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    status: v.string(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const customDomain = tenant.branding?.customDomain;
    const domainStatus = tenant.branding?.domainStatus;

    if (!customDomain) {
      throw new Error("No custom domain configured");
    }

    // Must have DNS verified before SSL provisioning
    if (domainStatus !== "dns_verification") {
      throw new Error("DNS must be verified before initiating SSL provisioning");
    }

    // Update status to ssl_provisioning
    const currentBranding = tenant.branding || {};
    await ctx.db.patch(authUser.tenantId, {
      branding: {
        ...currentBranding,
        domainStatus: "ssl_provisioning",
      },
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "domain_ssl_provisioning_started",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      newValue: { customDomain },
    });

    // For MVP: Simulate async SSL provisioning completion
    // In production, this would trigger actual SSL certificate provisioning
    // and the status would be updated via webhook or cron job
    return {
      success: true,
      status: "ssl_provisioning",
      message: "SSL provisioning initiated. This may take up to 24 hours to complete. You will be notified when SSL is active.",
    };
  },
});

/**
 * Complete SSL provisioning (called by async process or cron job).
 * This is an internal mutation for system use.
 */
export const _completeSslProvisioning = internalMutation({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const currentBranding = tenant.branding || {};
    
    // Update status to active
    await ctx.db.patch(args.tenantId, {
      branding: {
        ...currentBranding,
        domainStatus: "active",
        sslProvisionedAt: Date.now(),
      },
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "domain_ssl_provisioned",
      entityType: "tenant",
      entityId: args.tenantId,
      actorType: "system",
      newValue: { 
        customDomain: currentBranding.customDomain,
        sslProvisionedAt: Date.now(),
      },
    });

    return null;
  },
});

/**
 * Mark SSL provisioning as failed (called by async process or for manual retry).
 */
export const _failSslProvisioning = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const currentBranding = tenant.branding || {};
    
    // Update status to failed
    await ctx.db.patch(args.tenantId, {
      branding: {
        ...currentBranding,
        domainStatus: "failed",
      },
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "domain_ssl_failed",
      entityType: "tenant",
      entityId: args.tenantId,
      actorType: "system",
      newValue: { 
        customDomain: currentBranding.customDomain,
        errorMessage: args.errorMessage || "SSL provisioning failed",
      },
    });

    return null;
  },
});

/**
 * Remove tenant custom domain configuration.
 * @security Requires 'settings:manage', 'settings:*', or 'manage:*' permission.
 */
export const removeTenantDomain = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    previousDomain: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Check permission - require settings:* or manage:* permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "settings:*") && !hasPermission(role, "settings:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId: authUser.tenantId,
        action: "permission_denied",
        entityType: "tenant",
        entityId: authUser.tenantId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=settings:manage, attemptedAction=removeTenantDomain`,
        },
      });
      throw new Error("Access denied: You require 'settings:manage' permission to remove domain settings");
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const previousDomain = tenant.branding?.customDomain;
    const previousDomainStatus = tenant.branding?.domainStatus;

    if (!previousDomain) {
      // No domain to remove
      return {
        success: true,
        previousDomain: undefined,
      };
    }

    // Remove domain fields from branding - explicitly clear all domain-related fields
    const currentBranding = tenant.branding || {};
    
    // Create a new branding object without any domain-related fields
    const restBranding: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(currentBranding)) {
      // Skip all domain-related fields
      if (!['customDomain', 'domainStatus', 'domainVerifiedAt', 'sslProvisionedAt'].includes(key)) {
        restBranding[key] = value;
      }
    }

    await ctx.db.patch(authUser.tenantId, {
      branding: restBranding,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "domain_removed",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { customDomain: previousDomain, domainStatus: previousDomainStatus },
      newValue: { customDomain: null },
    });

    return {
      success: true,
      previousDomain,
    };
  },
});

/**
 * Get tier configuration to check if custom domain is available.
 * Used by frontend to determine if domain settings should be accessible.
 */
export const getTierCustomDomainStatus = query({
  args: {},
  returns: v.object({
    isCustomDomainEnabled: v.boolean(),
    currentPlan: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return {
        isCustomDomainEnabled: false,
        currentPlan: undefined,
      };
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      return {
        isCustomDomainEnabled: false,
        currentPlan: undefined,
      };
    }

    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", q => q.eq("tier", tenant.plan))
      .first();

    return {
      isCustomDomainEnabled: tierConfig?.features.customDomain ?? false,
      currentPlan: tenant.plan,
    };
  },
});
