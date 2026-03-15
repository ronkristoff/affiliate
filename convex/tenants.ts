/** @jsxImportSource react */
import { query, mutation, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./tenantContext";
import { hasPermission } from "./permissions";
import type { Role } from "./permissions";
import { obfuscate, deobfuscate } from "./encryption";
import DeletionReminderEmail from "./emails/DeletionReminderEmail";
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
 * Create a new tenant with the given name and slug.
 * Used during user registration to create a tenant for the new SaaS owner.
 */
export const createTenant = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
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

    // Create tenant with default settings
    const trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000; // 14 days from now

    const tenantId = await ctx.db.insert("tenants", {
      name: args.name,
      slug: args.slug,
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
      newValue: { name: args.name, slug: args.slug, plan: "starter" },
    });

    return tenantId;
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

    // Remove SaligPay credentials
    await ctx.db.patch(args.tenantId, {
      saligPayCredentials: undefined,
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
