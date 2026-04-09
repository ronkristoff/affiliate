import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { requireMutationCtx } from "@convex-dev/better-auth/utils";
import { anonymous, genericOAuth, twoFactor, magicLink, emailOTP } from "better-auth/plugins";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { components, internal } from "./_generated/api";
import { query, internalQuery, QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { DataModel, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  sendMagicLink,
  sendOTPVerification,
  sendEmailVerification,
  sendResetPassword,
} from "./email"; // Relative path within convex/
import authConfig from "./auth.config";

export const betterAuthComponent = createClient<DataModel>(
  components.betterAuth
);

// ── Auth factory (moved from src/lib/auth.ts — eliminates cross-boundary import) ──

const siteUrl = process.env.SITE_URL;
if (!siteUrl) {
  throw new Error("SITE_URL environment variable is required");
}

const createOptions = (ctx: GenericCtx) =>
  ({
    baseURL: siteUrl,
    database: betterAuthComponent.adapter(ctx as any),
    secret: process.env.BETTER_AUTH_SECRET,
    advanced: {
      disableCSRFCheck: false,
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    session: {
      // Session expires in 7 days (604800 seconds)
      expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
      // Update the session age every day to keep it fresh
      updateAge: 60 * 60 * 24, // 24 hours in seconds
      // Cookie cache settings for performance
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: true,
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        if ("runAction" in ctx) {
          // Action context — use sendAuthEmail action (supports Postmark)
          await (ctx as any).runAction(internal.email.sendAuthEmail, {
            type: "verifyEmail",
            to: user.email,
            url,
          });
        } else {
          // Mutation context — use direct sendEmailFromMutation (Resend only)
          await sendEmailVerification(requireMutationCtx(ctx) as any, {
            to: user.email,
            url,
          });
        }
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        if ("runAction" in ctx) {
          await (ctx as any).runAction(internal.email.sendAuthEmail, {
            type: "resetPassword",
            to: user.email,
            url,
          });
        } else {
          await sendResetPassword(requireMutationCtx(ctx) as any, {
            to: user.email,
            url,
          });
        }
      },
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        accessType: "offline",
        prompt: "select_account consent",
      },
    },
    user: {
      // Store company name, domain, and user type for tenant/routing
      additionalFields: {
        companyName: {
          type: "string",
          required: false,
          input: true,
        },
        domain: {
          type: "string",
          required: false,
          input: true,
        },
        userType: {
          type: "string",
          required: false,
          input: true,
        },
      },
      deleteUser: {
        enabled: true,
      },
    },
    plugins: [
      anonymous(),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          if ("runAction" in ctx) {
            await (ctx as any).runAction(internal.email.sendAuthEmail, {
              type: "magicLink",
              to: email,
              url,
            });
          } else {
            await sendMagicLink(requireMutationCtx(ctx) as any, {
              to: email,
              url,
            });
          }
        },
      }),
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          const purpose = type === "forget-password"
            ? "forget-password"
            : type === "sign-in"
              ? "sign-in"
              : "email-verification";
          if ("runAction" in ctx) {
            await (ctx as any).runAction(internal.email.sendAuthEmail, {
              type: "otp",
              to: email,
              otp,
              purpose,
            });
          } else {
            await sendOTPVerification(requireMutationCtx(ctx) as any, {
              to: email,
              code: otp,
              purpose,
            });
          }
        },
      }),
      twoFactor(),
      genericOAuth({
        config: [
          {
            providerId: "slack",
            clientId: process.env.SLACK_CLIENT_ID as string,
            clientSecret: process.env.SLACK_CLIENT_SECRET as string,
            discoveryUrl: "https://slack.com/.well-known/openid-configuration",
            scopes: ["openid", "email", "profile"],
          },
        ],
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if ("runMutation" in ctx) {
              const email = user.email.trim().toLowerCase();
              const userType = (user as any).userType;
              try {
                if (userType === "affiliate") {
                  // Affiliate routing is handled by completeAffiliateSignUp action (Task 19).
                  // This hook is a no-op for affiliates — the affiliate record is created
                  // after Better Auth user creation, not during.
                } else {
                  await ctx.runMutation(internal.users.syncUserCreation, {
                    email,
                    name: user.name || undefined,
                    companyName: (user as any).companyName || undefined,
                    domain: (user as any).domain || undefined,
                    authId: user.id,
                  });
                }
              } catch (err) {
                console.error("[Better Auth] syncUserCreation failed (non-fatal):", err);
              }
            }
          },
        },
        delete: {
          after: async (user) => {
            if ("runMutation" in ctx && "db" in ctx) {
              const mutationCtx = ctx as MutationCtx;
              const email = user.email.trim().toLowerCase();
              try {
                await ctx.runMutation(internal.users.syncUserDeletion, { email });
                // Also mark matching affiliate records as removed (soft-delete).
                // An email can exist in affiliates on multiple tenants — prefer
                // soft-delete over hard-delete to preserve multi-tenant affiliates.
                const affiliates = await mutationCtx.db
                  .query("affiliates")
                  .withIndex("by_email", (q) => q.eq("email", email))
                  .take(50);
                for (const affiliate of affiliates) {
                  if (affiliate.status !== "removed") {
                    await mutationCtx.db.patch(affiliate._id as Id<"affiliates">, { status: "removed" });
                  }
                }
              } catch (err) {
                console.error("[Better Auth] syncUserDeletion failed (non-fatal):", err);
              }
            }
          },
        },
      },
    },
  } satisfies BetterAuthOptions);

export const createAuth = (ctx: GenericCtx) => {
  const options = createOptions(ctx);
  return betterAuth({
    ...options,
    plugins: [
      ...options.plugins,
      convex({ authConfig }),
    ],
  });
};

// Type export for client-side inference
export const authWithoutCtx = createAuth({} as any);

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
    const cleanEmail = betterAuthUser.email.trim().toLowerCase();
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
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
    const cleanEmail = betterAuthUser.email.trim().toLowerCase();
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
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

    const cleanEmail = betterAuthUser.email.trim().toLowerCase();
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
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
    const cleanEmail = args.email.trim().toLowerCase();
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();

    if (appUser && appUser.status !== "removed") {
      return { type: "owner" as const };
    }

    // 2. Check affiliates table — resolve tenant slug for portal redirect
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
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

    const email = betterAuthUser.email.trim().toLowerCase();

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

    const cleanEmail = betterAuthUser.email.trim().toLowerCase();
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();

    if (!appUser || appUser.status === "removed") {
      return null;
    }

    return { role: appUser.role };
  },
});
