import { createClient } from "@convex-dev/better-auth";
import { components } from "./_generated/api";
import { query, mutation, internalQuery } from "./_generated/server";
import { DataModel, Id } from "./_generated/dataModel";
import { v } from "convex/values";

export const betterAuthComponent = createClient<DataModel>(
  components.betterAuth
);

/**
 * Get the current authenticated user with tenant context.
 * Returns null if not authenticated.
 */
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.optional(v.string()),
      role: v.string(),
      tenant: v.object({
        _id: v.id("tenants"),
        _creationTime: v.number(),
        name: v.string(),
        slug: v.string(),
        plan: v.string(),
        status: v.string(),
        trackingVerifiedAt: v.optional(v.number()),
      }),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    // Get user data from Better Auth
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      // User is not authenticated
      return null;
    }

    if (!betterAuthUser) {
      return null;
    }

    // Find user by email across all tenants using index
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", betterAuthUser.email))
      .first();

    if (!appUser) {
      console.warn(`No app user found for email: ${betterAuthUser.email}`);
      return null;
    }

    // Check if user has been removed (soft-deleted)
    if (appUser.status === "removed") {
      console.warn(`Removed user attempted login: ${betterAuthUser.email}`);
      return null;
    }

    // Get tenant data
    const tenant = await ctx.db.get(appUser.tenantId);
    if (!tenant) {
      console.warn(`No tenant found for user: ${appUser._id}`);
      return null;
    }

    return {
      _id: appUser._id,
      _creationTime: appUser._creationTime,
      tenantId: appUser.tenantId,
      email: appUser.email,
      name: appUser.name,
      role: appUser.role,
      tenant: {
        _id: tenant._id,
        _creationTime: tenant._creationTime,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        trackingVerifiedAt: tenant.trackingVerifiedAt,
      },
    };
  },
});

/**
 * Get session information for the current user.
 */
export const getSession = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      tenantId: v.id("tenants"),
      role: v.string(),
      email: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    return {
      userId: user._id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };
  },
});

/**
 * Validate that a user belongs to a specific tenant.
 * Used for multi-tenant data isolation.
 */
export const validateTenantAccess = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Get current user
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return false;
    }

    if (!betterAuthUser) {
      return false;
    }

    // Find user and check tenant using index
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", betterAuthUser.email))
      .first();

    if (!appUser) {
      return false;
    }

    // Check if user has been removed (soft-deleted)
    if (appUser.status === "removed") {
      return false;
    }

    return appUser.tenantId === args.tenantId;
  },
});

/**
 * Get tenant ID for the current authenticated user.
 */
export const getCurrentTenantId = query({
  args: {},
  returns: v.union(v.id("tenants"), v.null()),
  handler: async (ctx) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return null;
    }

    if (!betterAuthUser) {
      return null;
    }

    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", betterAuthUser.email))
      .first();

    // Check if user has been removed (soft-deleted)
    if (!appUser || appUser.status === "removed") {
      return null;
    }

    return appUser.tenantId;
  },
});

/**
 * Determine whether an email belongs to a SaaS Owner (users table) or
 * an Affiliate (affiliates table).  Used by the sign-in flow to redirect
 * affiliate users to the affiliate portal instead of the owner dashboard.
 *
 * This query does NOT require authentication — it is called from the browser
 * via ConvexHttpClient right after a successful Better Auth sign-in, before
 * the Convex auth token has been exchanged.
 */
export const getUserTypeByEmail = query({
  args: { email: v.string() },
  returns: v.union(
    v.object({ type: v.literal("owner") }),
    v.object({ type: v.literal("affiliate"), tenantSlug: v.string() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // 1. Check users table (SaaS Owners)
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (appUser && appUser.status !== "removed") {
      return { type: "owner" as const };
    }

    // 2. Check affiliates table — resolve tenant slug for portal redirect
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (affiliate) {
      const tenant = await ctx.db.get(affiliate.tenantId);
      return { type: "affiliate" as const, tenantSlug: tenant?.slug ?? "default" };
    }

    return null;
  },
});

/**
 * Determine the authenticated user's type (owner vs affiliate) using the
 * Convex auth session.  Used by the (auth) layout to redirect affiliate
 * users who land on owner pages (e.g. via bookmark or direct URL).
 */
export const getAuthenticatedUserType = query({
  args: {},
  returns: v.union(
    v.object({ type: v.literal("owner") }),
    v.object({ type: v.literal("affiliate"), tenantSlug: v.string() }),
    v.null(),
  ),
  handler: async (ctx) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return null;
    }

    if (!betterAuthUser) {
      return null;
    }

    const email = betterAuthUser.email;

    // 1. Check users table (SaaS Owners)
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (appUser && appUser.status !== "removed") {
      return { type: "owner" as const };
    }

    // 2. Check affiliates table — resolve tenant slug for portal redirect
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (affiliate) {
      const tenant = await ctx.db.get(affiliate.tenantId);
      return { type: "affiliate" as const, tenantSlug: tenant?.slug ?? "default" };
    }

    return null;
  },
});

/**
 * Get the current user's role for client-side redirect logic.
 * Returns "admin" for platform admins, or null if not authenticated.
 */
export const getUserRole = query({
  args: {},
  returns: v.union(v.object({ role: v.string() }), v.null()),
  handler: async (ctx) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return null;
    }

    if (!betterAuthUser) {
      return null;
    }

    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", betterAuthUser.email))
      .first();

    if (!appUser || appUser.status === "removed") {
      return null;
    }

    return { role: appUser.role };
  },
});
