import { 
  query, 
  mutation, 
  internalQuery, 
  internalMutation
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Helper function to get the current user with their tenant context
 */
async function getCurrentUser(ctx: { auth: { getUserIdentity(): Promise<{ email?: string } | null> }; db: { query(table: "users"): any } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: { eq: (field: string, value: string) => unknown }) => q.eq("email", identity.email!))
    .first();

  return user;
}

/**
 * Helper function to get tenant by ID with proper typing
 */
async function getTenantById(ctx: { db: { get(id: Id<"tenants">): Promise<unknown | null> } }, tenantId: Id<"tenants">) {
  const doc = await ctx.db.get(tenantId);
  if (!doc) return null;
  
  // Return typed document
  return doc as unknown as {
    _id: Id<"tenants">;
    trackingPublicKey?: string;
    trackingVerifiedAt?: number;
  };
}

/**
 * Patch tenant - used only in mutation contexts
 */
async function patchTenant(ctx: { db: { patch(id: Id<"tenants">, data: unknown): Promise<void> } }, tenantId: Id<"tenants">, data: { trackingPublicKey?: string; trackingVerifiedAt?: number | undefined }) {
  await ctx.db.patch(tenantId, data);
}

/**
 * Sanitize domain to prevent injection attacks and ensure valid format
 */
function sanitizeDomain(domain: string): string {
  // Remove protocol and path, keep only hostname
  try {
    const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
    return url.hostname.toLowerCase();
  } catch {
    // If URL parsing fails, sanitize manually
    return domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/[^a-z0-9.-]/g, '');
  }
}

/**
 * Strip PII from URLs by removing query parameters and fragments
 */
function stripPiiFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Return only protocol, hostname, and pathname
    return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
  } catch {
    // If URL parsing fails, try basic sanitization
    return url.split('?')[0].split('#')[0];
  }
}

/**
 * Generate a unique public key for tenant tracking
 * Uses crypto-secure random UUID with 'sk_' prefix
 */
function generatePublicKey(): string {
  // Generate cryptographically secure random bytes
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  
  // Convert to hex string
  const hex = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return "sk_" + hex;
}

/**
 * Query to check if tracking public key exists (read-only)
 * Returns null if key doesn't exist (frontend should call mutation to generate)
 */
export const getTrackingSnippetConfigQuery = query({
  args: {},
  returns: v.union(
    v.object({
      publicKey: v.string(),
      tenantId: v.id("tenants"),
      attributionWindow: v.number(),
      cdnUrl: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const tenant = await getTenantById(ctx, currentUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Return null if key doesn't exist (frontend should call mutation)
    if (!tenant.trackingPublicKey) {
      return null;
    }

    return {
      publicKey: tenant.trackingPublicKey,
      tenantId: tenant._id,
      attributionWindow: 30,
      cdnUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/track.js`,
    };
  },
});

/**
 * Mutation to generate tracking snippet configuration
 * AC1: Personalized Snippet Display
 * AC7: Snippet Configuration API
 */
export const getTrackingSnippetConfig = mutation({
  args: {},
  returns: v.object({
    publicKey: v.string(),
    tenantId: v.id("tenants"),
    attributionWindow: v.number(),
    cdnUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const tenant = await getTenantById(ctx, currentUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Generate public key if not exists
    if (!tenant.trackingPublicKey) {
      const publicKey = generatePublicKey();
      await ctx.db.patch(tenant._id, { trackingPublicKey: publicKey });
      tenant.trackingPublicKey = publicKey;
    }

    return {
      publicKey: tenant.trackingPublicKey!,
      tenantId: tenant._id,
      attributionWindow: 30,
      cdnUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/track.js`,
    };
  },
});

/**
 * Check the snippet installation verification status
 * AC3: Snippet Verification
 * Note: Returns default unverified state if not authenticated (for dashboard loading)
 */
export const checkSnippetInstallation = query({
  args: {},
  returns: v.object({
    isVerified: v.boolean(),
    lastPingAt: v.optional(v.number()),
    domain: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      // Return default unverified state during auth transition
      // This prevents errors during login redirect before auth is fully established
      return {
        isVerified: false,
        lastPingAt: undefined,
        domain: undefined,
      };
    }

    // Check for recent ping from this tenant
    const recentPing = await ctx.db
      .query("trackingPings")
      .withIndex("by_tenant_and_time", (q) =>
        q.eq("tenantId", currentUser.tenantId)
      )
      .order("desc")
      .first();

    const tenant = await getTenantById(ctx, currentUser.tenantId);

    return {
      isVerified: !!tenant?.trackingVerifiedAt,
      lastPingAt: recentPing?.timestamp,
      domain: recentPing?.domain,
    };
  },
});

/**
 * Record a tracking ping from the snippet
 * AC3: Snippet Verification
 * AC7: Tracking ping mutation
 */
export const recordTrackingPing = mutation({
  args: {
    publicKey: v.string(),
    domain: v.string(),
    url: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Find tenant by public key
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_tracking_key", (q: any) => q.eq("trackingPublicKey", args.publicKey))
      .first() as { _id: Id<"tenants">; trackingVerifiedAt?: number } | null;

    if (!tenant) {
      return { success: false, message: "Invalid public key" };
    }

    // Get full tenant record to check domain
    const fullTenant = await ctx.db.get(tenant._id);
    if (!fullTenant) {
      return { success: false, message: "Tenant not found" };
    }

    // Normalize domains for comparison (lowercase, strip www.)
    const normalizedPingDomain = args.domain.toLowerCase().replace(/^www\./, '');
    const normalizedTenantDomain = (fullTenant.domain || '').toLowerCase().replace(/^www\./, '');

    // Validate domain match
    if (normalizedPingDomain !== normalizedTenantDomain) {
      return { 
        success: false, 
        message: "Domain mismatch",
        details: {
          expectedDomain: fullTenant.domain,
          receivedDomain: args.domain,
        }
      };
    }

    // Record the ping
    await ctx.db.insert("trackingPings", {
      tenantId: tenant._id,
      trackingKey: args.publicKey,
      domain: args.domain,
      userAgent: args.userAgent,
      timestamp: Date.now(),
    });

    // Update tenant verification status only if domain matches
    if (!tenant.trackingVerifiedAt) {
      await patchTenant(ctx, tenant._id, { trackingVerifiedAt: Date.now() });
    }

    return { success: true, message: "Ping recorded" };
  },
});

/**
 * Get public tracking configuration by public key (for HTTP endpoint)
 * AC7: Snippet Configuration API
 */
export const getPublicTrackingConfig = query({
  args: {
    publicKey: v.string(),
  },
  returns: v.object({
    exists: v.boolean(),
    attributionWindow: v.number(),
    cdnUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_tracking_key", (q: any) => q.eq("trackingPublicKey", args.publicKey))
      .first();

    return {
      exists: !!tenant,
      attributionWindow: 30,
      cdnUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/track.js`,
    };
  },
});

/**
 * Mark tracking as verified manually (from settings)
 */
export const markTrackingVerified = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    await patchTenant(ctx, currentUser.tenantId, { trackingVerifiedAt: Date.now() });
    return null;
  },
});

/**
 * Reset tracking verification (for re-verification)
 */
export const resetTrackingVerification = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    // Clear verification status
    await patchTenant(ctx, currentUser.tenantId, { trackingVerifiedAt: undefined });

    // Clear existing pings
    const pings = await ctx.db
      .query("trackingPings")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", currentUser.tenantId))
      .collect();

    for (const ping of pings) {
      await ctx.db.delete(ping._id);
    }

    return null;
  },
});

/**
 * Internal mutation to record tracking ping (called from HTTP endpoint)
 */
export const recordPingInternal = internalMutation({
  args: {
    publicKey: v.string(),
    domain: v.string(),
    url: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Find tenant by public key
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_tracking_key", (q: any) => q.eq("trackingPublicKey", args.publicKey))
      .first() as { _id: Id<"tenants">; trackingVerifiedAt?: number } | null;

    if (!tenant) {
      return { success: false, message: "Invalid public key" };
    }

    // Get full tenant record to check domain
    const fullTenant = await ctx.db.get(tenant._id);
    if (!fullTenant) {
      return { success: false, message: "Tenant not found" };
    }

    // Normalize domains for comparison (lowercase, strip www.)
    const normalizedPingDomain = args.domain.toLowerCase().replace(/^www\./, '');
    const normalizedTenantDomain = (fullTenant.domain || '').toLowerCase().replace(/^www\./, '');

    // Validate domain match
    if (normalizedPingDomain !== normalizedTenantDomain) {
      return { 
        success: false, 
        message: "Domain mismatch",
      };
    }

    // Record the ping
    await ctx.db.insert("trackingPings", {
      tenantId: tenant._id,
      trackingKey: args.publicKey,
      domain: args.domain,
      userAgent: args.userAgent,
      timestamp: Date.now(),
    });

    // Update tenant verification status only if domain matches
    if (!tenant.trackingVerifiedAt) {
      await ctx.db.patch(tenant._id, { trackingVerifiedAt: Date.now() });
    }

    return { success: true, message: "Ping recorded" };
  },
});

/**
 * Internal query to get public tracking config (called from HTTP endpoint)
 */
export const getPublicTrackingConfigInternal = internalQuery({
  args: {
    publicKey: v.string(),
  },
  returns: v.object({
    exists: v.boolean(),
    attributionWindow: v.number(),
    cdnUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_tracking_key", (q: any) => q.eq("trackingPublicKey", args.publicKey))
      .first();

    return {
      exists: !!tenant,
      attributionWindow: 30,
      cdnUrl: "/track.js",
    };
  },
});

/**
 * Internal query to resolve a referral link by code
 * Story 4.5 AC #3: Returns 404 for archived campaigns
 */
export const resolveReferralLinkInternal = internalQuery({
  args: {
    code: v.string(),
  },
  returns: v.object({
    found: v.boolean(),
    reason: v.optional(v.string()),
    affiliateId: v.optional(v.id("affiliates")),
    campaignId: v.optional(v.id("campaigns")),
    affiliateName: v.optional(v.string()),
    campaignName: v.optional(v.string()),
    campaignStatus: v.optional(v.string()),
    destinationUrl: v.optional(v.string()),
    tenantId: v.optional(v.id("tenants")),
  }),
  handler: async (ctx, args) => {
    // Find the referral link by code
    const referralLink = await ctx.db
      .query("referralLinks")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!referralLink) {
      return {
        found: false,
        reason: "Referral link not found",
      };
    }

    const tenantId = referralLink.tenantId;

    // Get affiliate details
    const affiliate = await ctx.db.get(referralLink.affiliateId);
    if (!affiliate) {
      return {
        found: false,
        reason: "Affiliate not found",
      };
    }

    // If no campaign is associated, return basic info
    if (!referralLink.campaignId) {
      return {
        found: true,
        affiliateId: affiliate._id,
        campaignId: undefined,
        affiliateName: affiliate.name,
        campaignName: undefined,
        campaignStatus: undefined,
        destinationUrl: "/", // Default destination
        tenantId,
      };
    }

    // Get campaign details
    const campaign = await ctx.db.get(referralLink.campaignId);
    if (!campaign) {
      return {
        found: false,
        reason: "Campaign not found",
      };
    }

    // CRITICAL: Story 4.5 AC #3 - Archived campaigns return 404
    if (campaign.status === "archived") {
      return {
        found: false,
        reason: "This campaign has been archived and is no longer active",
      };
    }

    // Return full details including campaign status
    return {
      found: true,
      affiliateId: affiliate._id,
      campaignId: campaign._id,
      affiliateName: affiliate.name,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      destinationUrl: "/", // In production, this would be the actual landing page
      tenantId,
    };
  },
});

/**
 * Internal Mutation: Record a referral health ping
 * Called from POST /api/tracking/referral-ping HTTP endpoint
 */
export const recordReferralPingInternal = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    trackingKey: v.string(),
    domain: v.string(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("referralPings", {
      tenantId: args.tenantId,
      trackingKey: args.trackingKey,
      timestamp: Date.now(),
      domain: args.domain,
      userAgent: args.userAgent,
      ipAddress: args.ipAddress,
      pingType: "referral",
      email: args.email,
    });
    return null;
  },
});
