import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { betterAuthComponent } from "./auth";

const TEST_PASSWORD_HASH = "b1fb84d0f1c6feb781d661faecc3eeb6:4840a3170ce388473977f0fef10160e603fc9d95a74f55b2bfbf7626d0879e545a1fe515d12b36f0230bce85f6d4f6de3cf8f98f9a1daca3deeefd06e76a2000";

/**
 * Verify that an app-level user exists with admin role.
 */
export const _verifyAdminUser = internalQuery({
  args: { email: v.string() },
  returns: v.object({
    exists: v.boolean(),
    role: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      return { exists: false };
    }

    return { exists: true, role: user.role, userId: user._id };
  },
});

/**
 * Find or create the platform admin tenant.
 * Returns the tenant's Convex ID.
 */
async function getOrCreatePlatformTenant(ctx: any) {
  // Try to find existing platform tenant by slug
  const existing = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q: any) => q.eq("slug", "salig-platform"))
    .first();

  if (existing) {
    return existing._id;
  }

  // Create platform tenant
  const tenantId = await ctx.db.insert("tenants", {
    name: "Salig Affiliate Platform",
    slug: "salig-platform",
    domain: "salig-platform.test",
    plan: "starter",
    status: "active",
    trialEndsAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    trackingVerifiedAt: Date.now(),
    branding: {
      portalName: "Salig Affiliate Platform",
      primaryColor: "#1c2260",
    },
  });

  return tenantId;
}

/**
 * Ensure the app-level user exists with admin role.
 * Creates if missing, patches role if wrong.
 */
export const _ensureAdminAppUser = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      if (existing.role !== "admin") {
        await ctx.db.patch(existing._id, { role: "admin" });
        return { success: true, message: `Patched user ${existing._id} to admin role` };
      }
      return { success: true, message: `User already admin: ${existing._id}` };
    }

    const platformTenantId = await getOrCreatePlatformTenant(ctx);

    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      role: "admin",
      emailVerified: true,
      tenantId: platformTenantId,
    });

    return { success: true, message: `Created admin user: ${userId}` };
  },
});

/**
 * Create a platform admin entirely via the Better Auth adapter.
 * Used when HTTP signup is unavailable (e.g., SITE_URL not set or app not running).
 */
export const _createAdminViaAdapter = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();

    // Initialize adapter
    const factory: any = betterAuthComponent.adapter(ctx);
    const db: any = factory({ options: {} });

    // Check if auth user already exists
    let allUsers: any[];
    try {
      allUsers = await db.findMany({ model: "user" });
    } catch (e: any) {
      return { success: false, message: `Adapter findMany failed: ${e.message}` };
    }

    const existingAuthUser = allUsers.find(
      (u: any) => (u.email || "").toLowerCase() === cleanEmail,
    );

    let authUserId: string;

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
    } else {
      // Create auth user via adapter
      const now = Date.now();
      try {
        const newUser = await db.create({
          model: "user",
          data: {
            email: cleanEmail,
            name: args.name,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          },
        });
        authUserId = newUser.id;
      } catch (e: any) {
        return { success: false, message: `Failed to create auth user: ${e.message}` };
      }
    }

    // Ensure credential account exists
    try {
      const allAccounts = await db.findMany({ model: "account" });
      const hasAccount = allAccounts.some(
        (a: any) => a.userId === authUserId && a.providerId === "credential",
      );

      if (!hasAccount) {
        const now = Date.now();
        await db.create({
          model: "account",
          data: {
            userId: authUserId,
            accountId: cleanEmail,
            providerId: "credential",
            password: TEST_PASSWORD_HASH,
            createdAt: now,
            updatedAt: now,
          },
        });
      }
    } catch (e: any) {
      return { success: false, message: `Failed to create credential account: ${e.message}` };
    }

    // Ensure app-level user exists with admin role
    const appUserResult: { success: boolean; message: string } = await ctx.runMutation(
      internal.qaSeedInternal._ensureAdminAppUser,
      { email: cleanEmail, name: args.name },
    );

    if (!appUserResult.success) {
      return { success: false, message: `Auth created but app user failed: ${appUserResult.message}` };
    }

    return {
      success: true,
      message: existingAuthUser
        ? `Ensured existing auth user ${authUserId} has admin access`
        : `Created auth user ${authUserId} and admin app user`,
    };
  },
});
