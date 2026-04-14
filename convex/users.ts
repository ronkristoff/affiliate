import { internalMutation, internalQuery, internalAction, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { betterAuthComponent } from "./auth";
import { getTenantId, requireTenantId, getTenant, getAuthenticatedUser } from "./tenantContext";
import { internal } from "./_generated/api";
import { render } from "@react-email/components";
import React from "react";
import { sendEmail, getFromAddress } from "./emailService";
import { readDefaultTrialDays } from "./platformSettings";

/** Milliseconds in one day. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * User document type for type safety.
 */
type UserDoc = Doc<"users">;

/**
 * Generate a unique slug from a company name.
 * Internal helper to avoid circular dependencies.
 */
async function generateUniqueSlug(ctx: any, companyName: string): Promise<string> {
  const baseSlug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  let slug = baseSlug;
  let counter = 1;

  // Check if slug is available, append counter if not
  while (true) {
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .first();

    if (!existing) {
      return slug;
      }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Sync user creation from Better Auth.
 * Links the Better Auth user to an app user record with tenant context.
 * Includes authId to enable auth-based lookups for internal queries.
 *
 * Note: This is an internal function called by the auth system,
 * so it does NOT use tenant-scoped wrappers.
 */
// Helper function to clean and validate domain
function cleanAndValidateDomain(domain: string | undefined): string {
  if (!domain || domain.trim().length === 0) {
    throw new Error("Domain is required");
  }

  let cleaned = domain.toLowerCase().trim();

  // Strip protocol
  cleaned = cleaned.replace(/^https?:\/\//, "");

  // Strip www.
  cleaned = cleaned.replace(/^www\./, "");

  // Strip trailing slashes and path
  cleaned = cleaned.split("/")[0];

  // Strip port if present
  cleaned = cleaned.split(":")[0];

  // Reject localhost
  if (cleaned === "localhost" || cleaned.includes("localhost")) {
    throw new Error("localhost is not allowed. Please provide a production domain");
  }

  // Reject IP addresses
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(cleaned)) {
    throw new Error("IP addresses are not allowed. Please provide a domain name");
  }

  // Basic domain format check
  const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!domainRegex.test(cleaned)) {
    throw new Error("Invalid domain format. Please provide a valid domain like 'yourcompany.com'");
  }

  return cleaned;
}

/**
 * Complete sign-up: create tenant and user record after Better Auth creates the auth user.
 *
 * This is called from the frontend AFTER successful authClient.signUp.email().
 * companyName and domain cannot be passed through Better Auth's additionalFields
 * because the @convex-dev/better-auth component schema does not include them,
 * causing a 422 (FAILED_TO_CREATE_USER) when the adapter tries to insert
 * unknown fields into the component's user table.
 */
export const completeSignUp = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    companyName: v.string(),
    domain: v.string(),
    plan: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args): Promise<Id<"users">> => {
    // Server-side validation
    if (!args.email || args.email.trim().length === 0) {
      throw new Error("Email is required");
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email.trim())) {
      throw new Error("Invalid email format");
    }

    const email = args.email.trim().toLowerCase();

    // Check if user already exists by email (idempotent)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingUser) {
      return existingUser._id;
    }

    // Company name validation
    if (!args.companyName || args.companyName.length < 2) {
      throw new Error("Company name must be at least 2 characters");
    }
    if (args.companyName.length > 100) {
      throw new Error("Company name must be less than 100 characters");
    }

    // Validate and clean domain
    const cleanedDomain = cleanAndValidateDomain(args.domain);

    // Check domain uniqueness
    const existingTenantByDomain = await ctx.db
      .query("tenants")
      .withIndex("by_domain", (q: any) => q.eq("domain", cleanedDomain))
      .first();

    if (existingTenantByDomain) {
      throw new Error("A tenant with this domain already exists");
    }

    const companyName = args.companyName.trim();
    const slug = await generateUniqueSlug(ctx, companyName);
    const plan = args.plan || "starter";

    // Create tenant for this user (they are the owner)
    // Read trial duration from platform settings (admin-configurable)
    const defaultTrialDays: number = await readDefaultTrialDays(ctx);
    const trialEndsAt: number = Date.now() + defaultTrialDays * MS_PER_DAY;

    const tenantId: Id<"tenants"> = await ctx.db.insert("tenants", {
      name: companyName,
      slug,
      domain: cleanedDomain,
      plan,
      trialEndsAt,
      status: "active",
      branding: {
        portalName: companyName,
      },
    });

    // Create audit log entry for tenant creation
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "tenant_created",
      entityType: "tenant",
      entityId: tenantId,
      actorType: "system",
      newValue: { name: companyName, slug, plan },
    });

    // Seed denormalized tenantStats counters
    await ctx.runMutation(internal.tenantStats.seedStats, { tenantId });

    // Create user with owner role
    const userId = await ctx.db.insert("users", {
      tenantId,
      email,
      name: args.name,
      role: "owner",
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "user_created",
      entityType: "user",
      entityId: userId,
      actorType: "system",
      newValue: { email, name: args.name, role: "owner" },
    });

    // Send welcome email (non-blocking — scheduled action runs in Node.js after mutation commits)
    const siteUrl = process.env.SITE_URL || "http://localhost:3000";
    const dashboardUrl = `${siteUrl}/dashboard`;
    const ownerName = args.name || companyName;
    ctx.scheduler.runAfter(0, internal.email.sendOwnerWelcomeEmailAction, {
      to: email,
      ownerName,
      companyName,
      plan,
      dashboardUrl,
      trialDays: defaultTrialDays,
      tenantId,
    });

    return userId;
  },
});

export const syncUserCreation = internalMutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    companyName: v.optional(v.string()),
    domain: v.optional(v.string()),
    authId: v.string(), // Better Auth user ID
  },
  returns: v.id("users"),
  handler: async (ctx, args): Promise<Id<"users">> => {
    // Server-side validation
    if (!args.email || args.email.trim().length === 0) {
      throw new Error("Email is required");
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email.trim())) {
      throw new Error("Invalid email format");
    }

    const email = args.email.trim().toLowerCase();

    // Check if user already exists by email (idempotent)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingUser) {
      // Update authId if missing, then return existing user
      if (!existingUser.authId) {
        await ctx.db.patch(existingUser._id, { authId: args.authId });
      }
      return existingUser._id;
    }

    // If no domain provided, skip — the frontend will call completeSignUp
    // to create the tenant + user record with companyName and domain.
    // This is expected during the normal signup flow where additionalFields
    // cannot be passed through Better Auth's component adapter.
    if (!args.domain || !args.companyName) {
      throw new Error("Domain and companyName are required for new user registration via syncUserCreation");
    }

    // Generate a slug from company name or email
    const companyName = args.companyName || args.email.split("@")[0];

    // Company name validation
    if (companyName.length < 2) {
      throw new Error("Company name must be at least 2 characters");
    }
    if (companyName.length > 100) {
      throw new Error("Company name must be less than 100 characters");
    }

    // Validate and clean domain
    const cleanedDomain = cleanAndValidateDomain(args.domain);

    // Check domain uniqueness
    const existingTenantByDomain = await ctx.db
      .query("tenants")
      .withIndex("by_domain", (q: any) => q.eq("domain", cleanedDomain))
      .first();

    if (existingTenantByDomain) {
      throw new Error("A tenant with this domain already exists");
    }

    const slug = await generateUniqueSlug(ctx, companyName);

    // Create tenant for this user (they are the owner)
    // Read trial duration from platform settings (admin-configurable)
    const defaultTrialDays: number = await readDefaultTrialDays(ctx);
    const trialEndsAt: number = Date.now() + defaultTrialDays * MS_PER_DAY;

    const tenantId: Id<"tenants"> = await ctx.db.insert("tenants", {
      name: companyName,
      slug,
      domain: cleanedDomain,
      plan: "starter",
      trialEndsAt,
      status: "active",
      branding: {
        portalName: companyName,
      },
    });

    // Create audit log entry for tenant creation
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "tenant_created",
      entityType: "tenant",
      entityId: tenantId,
      actorType: "system",
      newValue: { name: companyName, slug, plan: "starter" },
    });

    // Seed denormalized tenantStats counters
    await ctx.runMutation(internal.tenantStats.seedStats, { tenantId });

    // Create user with owner role AND store the Better Auth authId
    const userId = await ctx.db.insert("users", {
      tenantId,
      email,
      name: args.name,
      role: "owner",
      authId: args.authId, // Link to Better Auth user
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "user_created",
      entityType: "user",
      entityId: userId,
      actorType: "system",
      newValue: { email, name: args.name, role: "owner" },
    });

    return userId;
  },
});

/**
 * Sync user deletion from Better Auth.
 * Note: In a real SaaS, you might want to soft-delete instead.
 *
 * Note: This is an internal function called by the auth system,
 * so it does NOT use tenant-scoped wrappers.
 */
export const syncUserDeletion = internalMutation({
  args: {
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find user by email using index
    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    for (const user of users) {
      // Create audit log entry before deletion
      await ctx.db.insert("auditLogs", {
        tenantId: user.tenantId,
        action: "user_deleted",
        entityType: "user",
        entityId: user._id,
        actorType: "system",
        previousValue: user,
      });

      await ctx.db.delete(user._id);
    }

    return null;
  },
});

// =============================================================================
// TENANT-SCOPED FUNCTIONS
// =============================================================================

/**
 * Create a new user within the current tenant.
 * 
 * @security Requires authentication. User is created in the authenticated user's tenant.
 */
export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    role: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    // Check if user already exists in this tenant
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", tenantId).eq("email", args.email)
      )
      .first();

    if (existingUser) {
      throw new Error(`User with email "${args.email}" already exists in this tenant`);
    }

    // Create user in the authenticated user's tenant
    const userId = await ctx.db.insert("users", {
      tenantId,
      email: args.email,
      name: args.name,
      role: args.role,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "user_created",
      entityType: "user",
      entityId: userId,
      actorType: "system",
      newValue: { email: args.email, name: args.name, role: args.role },
    });

    return userId;
  },
});

/**
 * Remove a team member from the current tenant.
 * Only owners and managers can remove team members.
 * Cannot remove the last owner.
 */
export const removeTeamMember = mutation({
  args: {
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getAuthenticatedUser(ctx);
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    // Get the user to be removed
    const userToRemove = await ctx.db.get(args.userId);
    if (!userToRemove) {
      throw new Error("User not found");
    }

    // Check permission: must be owner or manager, and same tenant
    if (currentUser.role !== "owner" && currentUser.role !== "manager") {
      throw new Error("Only owners and managers can remove team members");
    }

    if (userToRemove.tenantId !== currentUser.tenantId) {
      throw new Error("User not found in your tenant");
    }

    // Cannot remove the last owner
    if (userToRemove.role === "owner") {
      const owners = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", currentUser.tenantId))
        .filter((q) => q.eq(q.field("role"), "owner"))
        .collect();

      if (owners.length <= 1) {
        throw new Error("Cannot remove the last owner");
      }
    }

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: currentUser.tenantId,
      action: "user_deleted",
      entityType: "user",
      entityId: args.userId,
      actorType: "user",
      actorId: currentUser.userId,
      metadata: {
        removedUserEmail: userToRemove.email,
        removedUserRole: userToRemove.role,
        reason: args.reason,
      },
    });

    // Delete the user
    await ctx.db.delete(args.userId);

    return null;
  },
});

/**
 * Get all users in the current tenant.
 * Returns users sorted by role (owner first) then by creation time.
 */
export const getUsersByTenant = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      email: v.string(),
      name: v.optional(v.string()),
      role: v.string(),
      emailVerified: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx, _args) => {
    const currentUser = await getAuthenticatedUser(ctx);
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", currentUser.tenantId))
      .collect();

    // Sort by role priority (owner > manager > viewer) then by creation time
    const rolePriority: Record<string, number> = { owner: 0, manager: 1, viewer: 2 };
    users.sort((a, b) => {
      const priorityDiff = (rolePriority[a.role] ?? 3) - (rolePriority[b.role] ?? 3);
      if (priorityDiff !== 0) return priorityDiff;
      return a._creationTime - b._creationTime;
    });

    return users;
  },
});

// =============================================================================
// TENANT-SCOPED FUNCTIONS
// =============================================================================
// PROFILE FUNCTIONS
// =============================================================================

/**
 * Get the current user's profile with tenant information.
 * This query returns the authenticated user's profile data for the settings page.
 * 
 * @security Requires authentication. Returns null if not authenticated.
 */
export const getCurrentUserProfile = query({
  args: {},
  returns: v.union(
    v.object({
      user: v.object({
        _id: v.id("users"),
        _creationTime: v.number(),
        tenantId: v.id("tenants"),
        email: v.string(),
        name: v.optional(v.string()),
        role: v.string(),
        emailVerified: v.optional(v.boolean()),
      }),
      tenant: v.object({
        _id: v.id("tenants"),
        name: v.string(),
        plan: v.string(),
        domain: v.string(),
        trackingVerifiedAt: v.optional(v.number()),
      }),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return null;
    }

    // Get full user record
    const user = await ctx.db.get(authUser.userId);
    if (!user) {
      return null;
    }

    // Get tenant information
    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      return null;
    }

    return {
      user: {
        _id: user._id,
        _creationTime: user._creationTime,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        plan: tenant.plan,
        domain: tenant.domain,
        trackingVerifiedAt: tenant.trackingVerifiedAt,
      },
    };
  },
});

/**
 * Update the current user's profile.
 * Only allows updating name (email is read-only for security).
 * 
 * @security Requires authentication. Only updates the current user's own profile.
 */
export const updateUserProfile = mutation({
  args: {
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Validate name field
    if (args.name.length < 2) {
      throw new Error("Name must be at least 2 characters");
    }
    if (args.name.length > 100) {
      throw new Error("Name must be less than 100 characters");
    }

    // Validate name format (letters, spaces, hyphens, apostrophes only)
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(args.name)) {
      throw new Error("Name can only contain letters, spaces, hyphens, and apostrophes");
    }

    // Get current user record for audit logging
    const currentUser = await ctx.db.get(authUser.userId);
    if (!currentUser) {
      throw new Error("User not found");
    }

    // Multi-tenant isolation: verify user belongs to current tenant
    if (currentUser.tenantId !== authUser.tenantId) {
      throw new Error("Access denied: Cannot update profile for another tenant");
    }

    // Store previous values for audit log
    const previousName = currentUser.name;

    // Update user profile (only name can be updated - email is read-only)
    await ctx.db.patch(authUser.userId, {
      name: args.name,
    });

    // Log audit trail for profile update
    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "USER_PROFILE_UPDATED",
      entityType: "user",
      entityId: authUser.userId,
      targetId: authUser.userId, // Target is the user being updated (self)
      actorId: authUser.userId,
      actorType: "user",
      previousValue: {
        name: previousName,
      },
      newValue: {
        name: args.name,
      },
      metadata: {
        additionalInfo: "Profile update - changed fields: name",
      },
    });

    return null;
  },
});

/**
 * Internal query to get owners by tenant.
 * Used by actions that need to contact tenant owners.
 */
export const _getOwnersByTenantInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.optional(v.string()),
      role: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("role"), "owner"))
      .collect();

    return users.map((user) => ({
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    }));
  },
});

/**
 * Internal query to get the first owner user by tenant ID.
 * Used by fraud alert email to find the SaaS owner to notify.
 */
export const getOwnerByTenantInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.optional(v.string()),
      role: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("role"), "owner"))
      .first();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  },
});

/**
 * Internal query to get user by Better Auth ID.
 * Used by actions that need to authenticate via auth identity.
 * 
 * Falls back to email lookup if authId lookup fails (for users created before authId was added).
 */
export const _getUserByAuthIdInternal = internalQuery({
  args: {
    authId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.optional(v.string()),
      role: v.string(),
      tenantId: v.id("tenants"),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // First try to find by authId
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .first();

    if (user) {
      return {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      };
    }

    // If not found by authId, this might be a legacy user
    // We can't easily fall back without knowing the email
    // The admin should run the backfill migration
    console.warn(`User not found by authId: ${args.authId}. May need to run backfill migration.`);
    return null;
  },
});

export const _getUserByEmailInternal = internalQuery({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.optional(v.string()),
      role: v.string(),
      tenantId: v.id("tenants"),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) return null;

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    };
  },
});

/**
 * Backfill authId for existing users who signed up before authId was implemented.
 * This links existing Better Auth users to their app user records.
 *
 * IMPORTANT: Run this migration once after deploying the authId fix.
 * Can be safely run multiple times (idempotent).
 */
export const backfillAuthIdForExistingUsers = internalMutation({
  args: {
    email: v.string(),
    authId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find user by email
    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    for (const user of users) {
      // Only update if authId is not already set
      if (!user.authId) {
        await ctx.db.patch(user._id, {
          authId: args.authId,
        });
        console.log(`Backfilled authId for user ${user.email}: ${args.authId}`);
      } else {
        console.log(`User ${user.email} already has authId: ${user.authId}`);
      }
    }

    return null;
  },
});

/**
 * Get all users without an authId (for migration purposes).
 */
export const getUsersWithoutAuthId = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.optional(v.string()),
      tenantId: v.id("tenants"),
      role: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Scan all users (note: this is a full table scan, only for admin use)
    const allUsers = await ctx.db.query("users").collect();

    return allUsers
      .filter((user) => !user.authId)
      .map((user) => ({
        _id: user._id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
      }));
  },
});

/**
 * Sync authId for the currently authenticated user.
 * This bridges the gap for users who existed before authId was implemented.
 *
 * Call this mutation after login for users who need to backfill their authId.
 */
export const syncCurrentUserAuthId = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Get the current Better Auth user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Authentication required");
    }

    if (!identity.email) {
      throw new Error("User email not available from authentication provider");
    }

    // Store in a const to help TypeScript narrow the type
    const userEmail = identity.email;

    // Find the app user by email
    const appUsers = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", userEmail))
      .collect();

    // Find the user without authId (or the first one if multiple)
    const userToUpdate = appUsers.find((u) => !u.authId);

    if (!userToUpdate) {
      // All users already have authId set
      console.log(`User ${identity.email} already has authId or not found`);
      return null;
    }

    // Update the user's authId
    await ctx.db.patch(userToUpdate._id, {
      authId: identity.subject,
    });

    console.log(`Synced authId for ${identity.email}: ${identity.subject}`);
    return null;
  },
});
