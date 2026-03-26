import { query, mutation, action, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { sendAffiliateWelcomeEmail, sendNewAffiliateNotificationEmail } from "./email";
import { getAuthenticatedUser } from "./tenantContext";

/**
 * Affiliate Session Management
 * 
 * This module provides authentication for the affiliate portal.
 * Unlike SaaS Owner authentication (which uses Better Auth),
 * affiliates use a simpler password-based authentication stored directly
 * in the affiliates table.
 * 
 * Session flow:
 * 1. Affiliate registers on tenant's portal
 * 2. Affiliate status is "pending" until approved by owner
 * 3. Once approved, affiliate can login
 * 4. Session is created and returned to client
 */

/**
 * Generate a cryptographically secure random session token.
 */
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Session expiration time (7 days in milliseconds)
 */
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Create a new affiliate session with server-side tracking.
 * Returns the session token to be stored client-side.
 */
async function createAffiliateSession(
  ctx: any,
  affiliateId: Id<"affiliates">,
  tenantId: Id<"tenants">,
  userAgent?: string,
  ipAddress?: string
): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = Date.now() + SESSION_EXPIRY_MS;
  const createdAt = Date.now();
  
  // Clean up expired sessions for this affiliate
  const existingSessions = await ctx.db
    .query("affiliateSessions")
    .withIndex("by_affiliate", (q: any) => q.eq("affiliateId", affiliateId))
    .collect();
  
  for (const session of existingSessions) {
    if (session.expiresAt < Date.now()) {
      await ctx.db.delete(session._id);
    }
  }
  
  // Create new session
  await ctx.db.insert("affiliateSessions", {
    affiliateId,
    tenantId,
    token,
    expiresAt,
    createdAt,
    userAgent,
    ipAddress,
  });
  
  return token;
}

/**
 * Validate a session token.
 */
async function validateSessionToken(
  ctx: any,
  token: string
): Promise<{ affiliateId: Id<"affiliates">; tenantId: Id<"tenants"> } | null> {
  const session = await ctx.db
    .query("affiliateSessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
  
  if (!session) return null;
  
  // Check expiration
  if (session.expiresAt < Date.now()) {
    return null;
  }
  
  return { affiliateId: session.affiliateId, tenantId: session.tenantId };
}

/**
 * Hash password using PBKDF2 with SHA-256.
 * Uses cryptographically secure key derivation with random salt.
 * This is suitable for production use in serverless environments.
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  const hashBuffer = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  
  const exportedKey = await crypto.subtle.exportKey("raw", hashBuffer);
  const saltArray = Array.from(salt);
  const hashArray = Array.from(new Uint8Array(exportedKey));
  
  // Format: salt:hash (both as hex)
  return saltArray.map(b => b.toString(16).padStart(2, "0")).join("") + ":" + 
         hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify password against stored hash.
 */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  
  const salt = new Uint8Array(parts[0].match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const expectedHash = parts[1];
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  const hashBuffer = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  
  const exportedKey = await crypto.subtle.exportKey("raw", hashBuffer);
  const hashArray = Array.from(new Uint8Array(exportedKey));
  const actualHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  
  return actualHash === expectedHash;
}

/**
 * Internal mutation for creating affiliate account.
 * Separated from the action to allow proper transaction handling.
 */
export const createAffiliateAccountInternal = internalMutation({
  args: {
    tenantSlug: v.string(),
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    promotionChannel: v.optional(v.string()),
    uniqueCode: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    affiliateId: v.optional(v.id("affiliates")),
    uniqueCode: v.optional(v.string()),
    status: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get tenant by slug
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Check if affiliate already exists for this tenant
    const existingAffiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", tenant._id).eq("email", args.email)
      )
      .first();

    if (existingAffiliate) {
      return { success: false, error: "An affiliate with this email already exists for this tenant" };
    }

    // Generate unique referral code using cryptographically secure randomness
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    
    function generateSecureCode(): string {
      const array = new Uint8Array(8);
      crypto.getRandomValues(array);
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(array[i] % chars.length);
      }
      return code;
    }
    
    let uniqueCode = generateSecureCode();

    // Check uniqueness
    let attempts = 0;
    while (attempts < 10) {
      const existing = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant_and_code", (q) =>
          q.eq("tenantId", tenant._id).eq("uniqueCode", uniqueCode)
        )
        .first();
      
      if (!existing) break;
      
      uniqueCode = generateSecureCode();
      attempts++;
    }

    if (attempts >= 10) {
      return { success: false, error: "Failed to generate unique referral code" };
    }

    // Create affiliate with pending status
    const affiliateId = await ctx.db.insert("affiliates", {
      tenantId: tenant._id,
      email: args.email,
      name: args.name,
      uniqueCode: args.uniqueCode,
      status: "pending",
      passwordHash: args.passwordHash,
      promotionChannel: args.promotionChannel,
    });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      tenantId: tenant._id,
      action: "affiliate_registered",
      entityType: "affiliate",
      entityId: affiliateId,
      actorType: "system",
      newValue: { email: args.email, name: args.name, uniqueCode, status: "pending" },
    });

    // Send welcome email to affiliate (async, don't fail registration if email fails)
    // Uses retry logic with exponential backoff and automatic error logging
    let welcomeEmailSent = false;
    let welcomeEmailError: string | undefined;
    try {
      // Construct referral URL from tenant domain
      const portalDomain = tenant.branding?.customDomain || `${tenant.slug}.boboddy.business`;
      const referralUrl = `https://${portalDomain}/ref/${uniqueCode}`;

      await sendAffiliateWelcomeEmail(ctx, {
        to: args.email,
        affiliateName: args.name,
        affiliateEmail: args.email,
        uniqueCode,
        portalName: tenant.branding?.portalName || tenant.name,
        referralUrl,
        brandLogoUrl: tenant.branding?.logoUrl,
        brandPrimaryColor: tenant.branding?.primaryColor,
        approvalTimeframe: "1-2 business days",
        contactEmail: undefined, // Could be extended to store in tenant settings
        maxRetries: 3,
        tenantId: tenant._id,
      });
      welcomeEmailSent = true;
    } catch (emailError) {
      welcomeEmailError = emailError instanceof Error ? emailError.message : String(emailError);
      console.error("Failed to send welcome email:", emailError);
    }

    // Send notification to SaaS Owner (async, don't fail registration if email fails)
    let ownerNotificationSent = false;
    let ownerNotificationError: string | undefined;
    let ownerEmail: string | undefined;
    try {
      // Find the owner user for this tenant (role === "owner")
      const ownerUser = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .filter((q) => q.eq(q.field("role"), "owner"))
        .first();

      if (ownerUser?.email) {
        ownerEmail = ownerUser.email;
        await sendNewAffiliateNotificationEmail(ctx, {
          to: ownerUser.email,
          affiliateName: args.name,
          affiliateEmail: args.email,
          promotionChannel: args.promotionChannel,
          uniqueCode,
          merchantName: ownerUser.name || "Merchant",
          portalName: tenant.branding?.portalName || tenant.name,
          brandLogoUrl: tenant.branding?.logoUrl,
          brandPrimaryColor: tenant.branding?.primaryColor,
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/affiliates`,
        });
        ownerNotificationSent = true;
      }
    } catch (emailError) {
      ownerNotificationError = emailError instanceof Error ? emailError.message : String(emailError);
      console.error("Failed to send owner notification email:", emailError);
    }
    
    // Store owner notification email result in emails table (only if we found an owner)
    if (ownerEmail) {
      await ctx.db.insert("emails", {
        tenantId: tenant._id,
        type: "new_affiliate_notification",
        recipientEmail: ownerEmail,
        subject: `New Affiliate Application from ${args.name}`,
        status: ownerNotificationSent ? "sent" : "failed",
        sentAt: ownerNotificationSent ? Date.now() : undefined,
        errorMessage: ownerNotificationError,
      });
    }

    return {
      success: true,
      affiliateId,
      uniqueCode: args.uniqueCode,
      status: "pending",
    };
  },
});

/**
 * Register a new affiliate with reCAPTCHA protection.
 * Creates an affiliate record with "pending" status.
 * The affiliate will be able to login once approved by the SaaS owner.
 * 
 * Security: reCAPTCHA token is validated server-side before account creation.
 */
export const registerAffiliateAccount = action({
  args: {
    tenantSlug: v.string(),
    email: v.string(),
    name: v.string(),
    password: v.string(),
    promotionChannel: v.optional(v.string()),
    recaptchaToken: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    affiliateId: v.optional(v.id("affiliates")),
    uniqueCode: v.optional(v.string()),
    status: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Validate reCAPTCHA token first (bot protection)
    const recaptchaResult: { success: boolean; score?: number; error?: string } = await ctx.runAction(
      internal.affiliateAuth.validateRecaptchaToken,
      { token: args.recaptchaToken }
    );

    if (!recaptchaResult.success) {
      return {
        success: false,
        error: recaptchaResult.error || "Verification failed - please try again",
      };
    }

    // Hash password before storing
    const passwordHash = await hashPassword(args.password);

    // Generate unique referral code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    let uniqueCode = "";
    for (let i = 0; i < 8; i++) {
      uniqueCode += chars.charAt(array[i] % chars.length);
    }

    // Call internal mutation to create affiliate account
    const result: {
      success: boolean;
      affiliateId?: Id<"affiliates">;
      uniqueCode?: string;
      status?: string;
      error?: string;
    } = await ctx.runMutation(internal.affiliateAuth.createAffiliateAccountInternal, {
      tenantSlug: args.tenantSlug,
      email: args.email,
      name: args.name,
      passwordHash,
      promotionChannel: args.promotionChannel,
      uniqueCode,
    });

    return result;
  },
});

/**
 * Login affiliate.
 * Validates credentials and returns session data if successful.
 */
export const loginAffiliate = mutation({
  args: {
    tenantSlug: v.string(),
    email: v.string(),
    password: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    session: v.optional(v.object({
      affiliateId: v.id("affiliates"),
      tenantId: v.id("tenants"),
      sessionToken: v.string(),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
    })),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get tenant by slug
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Find affiliate by email
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", tenant._id).eq("email", args.email)
      )
      .first();

    if (!affiliate) {
      return { success: false, error: "Invalid email or password" };
    }

    // Check password using secure verification
    if (!affiliate.passwordHash || !(await verifyPassword(args.password, affiliate.passwordHash))) {
      return { success: false, error: "Invalid email or password" };
    }

    // Check status
    if (affiliate.status === "pending") {
      return { success: false, error: "Your account is pending approval. Please wait for the merchant to approve your application." };
    }

    if (affiliate.status === "suspended") {
      return { success: false, error: "Your account has been suspended. Please contact support." };
    }

    if (affiliate.status === "rejected") {
      return { success: false, error: "Your application has been rejected." };
    }

    // Create audit log for login
    await ctx.db.insert("auditLogs", {
      tenantId: tenant._id,
      action: "affiliate_login",
      entityType: "affiliate",
      entityId: affiliate._id,
      actorType: "affiliate",
    });

    // Update affiliate login tracking for self-referral detection (Story 5.6)
    // Note: In a real implementation, we'd get the IP from the request context
    // For now, this is a placeholder - the actual IP would come from the HTTP request
    try {
      await ctx.db.patch(affiliate._id, {
        lastLoginIp: undefined, // Would be set from request context in production
        lastDeviceFingerprint: undefined, // Would be set from client in production
      });
    } catch (e) {
      // Don't fail login if tracking update fails
      console.error("Failed to update affiliate login tracking:", e);
    }

    // Create server-side session with expiration
    const sessionToken = await createAffiliateSession(ctx, affiliate._id, tenant._id);

    return {
      success: true,
      session: {
        affiliateId: affiliate._id,
        tenantId: affiliate.tenantId,
        sessionToken,
        email: affiliate.email,
        name: affiliate.name,
        uniqueCode: affiliate.uniqueCode,
        status: affiliate.status,
      },
    };
  },
});

/**
 * Validate session token and return affiliate data.
 * Used by middleware to verify session from cookie.
 */
export const validateAffiliateSession = query({
  args: {
    sessionToken: v.string(),
  },
  returns: v.union(
    v.object({
      affiliateId: v.id("affiliates"),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      expiresAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("affiliateSessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();

    if (!session) return null;
    
    // Check expiration
    if (session.expiresAt < Date.now()) {
      return null;
    }

    const affiliate = await ctx.db.get(session.affiliateId);
    if (!affiliate) return null;

    return {
      affiliateId: affiliate._id,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      expiresAt: session.expiresAt,
    };
  },
});

/**
 * Logout - invalidate session.
 */
export const logoutAffiliate = mutation({
  args: {
    sessionToken: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("affiliateSessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }

    return { success: true };
  },
});

/**
 * Get current affiliate by ID.
 * Used to validate session and get affiliate data.
 */
export const getCurrentAffiliate = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
      payoutMethodLastDigits: v.optional(v.string()),
      tenant: v.object({
        _id: v.id("tenants"),
        name: v.string(),
        slug: v.string(),
        branding: v.optional(v.object({
          logoUrl: v.optional(v.string()),
          primaryColor: v.optional(v.string()),
          portalName: v.optional(v.string()),
        })),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      return null;
    }

    const tenant = await ctx.db.get(affiliate.tenantId);
    if (!tenant) {
      return null;
    }

    return {
      _id: affiliate._id,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      payoutMethod: affiliate.payoutMethod,
      payoutMethodLastDigits: affiliate.payoutMethodLastDigits,
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        branding: tenant.branding,
      },
    };
  },
});

/**
 * Get tenant context for affiliate portal.
 * Returns tenant branding and settings for the affiliate portal.
 */
export const getAffiliateTenantContext = query({
  args: {
    tenantSlug: v.string(),
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
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

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
 * Update affiliate password.
 */
export const changeAffiliatePassword = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      return { success: false, error: "Affiliate not found" };
    }

    if (!affiliate.passwordHash || !(await verifyPassword(args.currentPassword, affiliate.passwordHash))) {
      return { success: false, error: "Current password is incorrect" };
    }

    const newPasswordHash = await hashPassword(args.newPassword);
    await ctx.db.patch(args.affiliateId, { passwordHash: newPasswordHash });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      tenantId: affiliate.tenantId,
      action: "affiliate_password_changed",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorType: "affiliate",
    });

    return { success: true };
  },
});

/**
 * Validate reCAPTCHA token with Google's verification API.
 * Returns validation result with score-based assessment.
 */
export const validateRecaptchaToken = internalAction({
  args: {
    token: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    score: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; score?: number; error?: string }> => {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const scoreThreshold = parseFloat(process.env.RECAPTCHA_SCORE_THRESHOLD || "0.5");

    if (!secretKey) {
      console.error("RECAPTCHA_SECRET_KEY is not configured");
      return { success: false, error: "Server configuration error" };
    }

    try {
      // Make HTTP request to Google's reCAPTCHA verification API
      const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: secretKey,
          response: args.token,
        }).toString(),
      });

      if (!response.ok) {
        console.error("reCAPTCHA verification request failed:", response.statusText);
        return { success: false, error: "Verification service unavailable" };
      }

      const data = await response.json();

      // Check if token is valid
      if (!data.success) {
        console.error("reCAPTCHA token validation failed:", data["error-codes"]);
        return { success: false, error: "Invalid verification token" };
      }

      // Check score threshold (reCAPTCHA v3 returns score from 0.0 to 1.0)
      const score = data.score as number;
      if (score < scoreThreshold) {
        console.warn(`reCAPTCHA score ${score} below threshold ${scoreThreshold}`);
        return {
          success: false,
          score,
          error: "We couldn't verify you're human - please try again",
        };
      }

      return { success: true, score };
    } catch (error) {
      console.error("reCAPTCHA validation error:", error);
      return { success: false, error: "Verification failed - please try again" };
    }
  },
});

/**
 * Request password reset for affiliate.
 * In MVP, this just returns success - actual email sending would be implemented later.
 */
export const requestAffiliatePasswordReset = mutation({
  args: {
    tenantSlug: v.string(),
    email: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get tenant
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      // Don't reveal if tenant exists
      return { success: true, message: "If an account exists, you will receive a password reset email." };
    }

    // Find affiliate
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", tenant._id).eq("email", args.email)
      )
      .first();

    if (!affiliate) {
      // Don't reveal if affiliate exists
      return { success: true, message: "If an account exists, you will receive a password reset email." };
    }

    // TODO: Send password reset email
    // For MVP, we'll just return success

    return { success: true, message: "If an account exists, you will receive a password reset email." };
  },
});

/**
 * Get affiliate portal dashboard statistics (AC: #1, #2, #3)
 * Returns key metrics with period-over-period comparison
 */
export const getAffiliatePortalDashboardStats = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.object({
    // All-time totals
    totalClicks: v.number(),
    totalConversions: v.number(),
    conversionRate: v.number(),
    totalEarnings: v.number(),
    confirmedEarnings: v.number(),
    pendingEarnings: v.number(),
    
    // This month
    thisMonthClicks: v.number(),
    thisMonthConversions: v.number(),
    thisMonthEarnings: v.number(),
    
    // Last month (for comparison)
    lastMonthClicks: v.number(),
    lastMonthEarnings: v.number(),
    
    // Computed deltas
    clickChangePercent: v.number(),
    earningsChangePercent: v.number(),
  }),
  handler: async (ctx, args) => {
    // Validate affiliate belongs to session tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    // Calculate date ranges for this month and last month
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thisMonthEnd = now.getTime();
    
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();

    // PERFORMANCE NOTE: These queries load all historical data for the affiliate.
    // For affiliates with years of data, this could be inefficient.
    // TODO: Consider adding a date-filtered index (by_affiliate_and_date) to the schema
    // or implement incremental statistics updates via scheduled jobs.
    
    // Query clicks using async iteration to reduce memory pressure
    let totalClicks = 0;
    let thisMonthClicks = 0;
    let lastMonthClicks = 0;
    
    const clicksQuery = ctx.db
      .query("clicks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId));
    
    for await (const click of clicksQuery) {
      totalClicks++;
      if (click._creationTime >= thisMonthStart && click._creationTime <= thisMonthEnd) {
        thisMonthClicks++;
      } else if (click._creationTime >= lastMonthStart && click._creationTime <= lastMonthEnd) {
        lastMonthClicks++;
      }
    }

    // Query conversions using async iteration
    let totalConversions = 0;
    let thisMonthConversions = 0;
    
    const conversionsQuery = ctx.db
      .query("conversions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId));
    
    for await (const conversion of conversionsQuery) {
      totalConversions++;
      if (conversion._creationTime >= thisMonthStart && conversion._creationTime <= thisMonthEnd) {
        thisMonthConversions++;
      }
    }

    // Query commissions using async iteration
    let totalCommissions = 0;
    let confirmedCommissions = 0;
    let pendingCommissions = 0;
    let thisMonthEarnings = 0;
    let lastMonthEarnings = 0;
    
    const commissionsQuery = ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId));
    
    for await (const commission of commissionsQuery) {
      if (commission.status === "approved") {
        totalCommissions += commission.amount;
      }
      
      if (commission.status === "approved") {
        confirmedCommissions += commission.amount;
      } else if (commission.status === "pending") {
        pendingCommissions += commission.amount;
      }
      
      if (commission._creationTime >= thisMonthStart && commission._creationTime <= thisMonthEnd && commission.status === "approved") {
        thisMonthEarnings += commission.amount;
      } else if (commission._creationTime >= lastMonthStart && commission._creationTime <= lastMonthEnd && commission.status === "approved") {
        lastMonthEarnings += commission.amount;
      }
    }

    // Calculate conversion rate (avoid division by zero)
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    // Calculate change percentages with safe division
    const clickChangePercent = lastMonthClicks > 0 
      ? ((thisMonthClicks - lastMonthClicks) / lastMonthClicks) * 100 
      : 0;
    
    const earningsChangePercent = lastMonthEarnings > 0 
      ? ((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100 
      : 0;

    return {
      // All-time totals
      totalClicks,
      totalConversions,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalEarnings: totalCommissions,
      confirmedEarnings: confirmedCommissions,
      pendingEarnings: pendingCommissions,
      
      // This month
      thisMonthClicks,
      thisMonthConversions,
      thisMonthEarnings,
      
      // Last month
      lastMonthClicks,
      lastMonthEarnings,
      
      // Deltas
      clickChangePercent: Math.round(clickChangePercent * 100) / 100,
      earningsChangePercent: Math.round(earningsChangePercent * 100) / 100,
    };
  },
});

/**
 * Get affiliate recent activity feed (AC: #4)
 * Returns combined feed of commissions and click batches
 */
export const getAffiliateRecentActivity = query({
  args: {
    affiliateId: v.id("affiliates"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.string(),
    type: v.union(
      v.literal("commission_confirmed"),
      v.literal("commission_pending"),
      v.literal("clicks")
    ),
    title: v.string(),
    description: v.string(),
    amount: v.optional(v.number()),
    status: v.optional(v.string()),
    timestamp: v.number(),
    iconType: v.union(v.literal("green"), v.literal("amber"), v.literal("blue")),
  })),
  handler: async (ctx, args) => {
    const resultLimit = args.limit || 10;
    
    // Get recent commissions (limit 5)
    const recentCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .order("desc")
      .take(5);

    // Get recent clicks grouped by day (limit 5)
    const recentClicks = await ctx.db
      .query("clicks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .order("desc")
      .take(10);

    // Convert commissions to activity items
    const commissionActivities = recentCommissions.map((commission) => {
      const type = commission.status === "approved" 
        ? "commission_confirmed" 
        : "commission_pending";
      
      const iconType = commission.status === "approved" ? "green" : "amber";
      
      return {
        _id: `commission-${commission._id}`,
        type: type as "commission_confirmed" | "commission_pending",
        title: type === "commission_confirmed" ? "Commission Approved" : "Commission Pending",
        description: `From conversion #${commission.conversionId ? commission.conversionId.slice(-6) : "unknown"}`,
        amount: commission.amount,
        status: commission.status,
        timestamp: commission._creationTime,
        iconType: iconType as "green" | "amber",
      };
    });

    // Convert clicks to activity items (group by day)
    const clickActivities: Array<{
      _id: string;
      type: "clicks";
      title: string;
      description: string;
      timestamp: number;
      iconType: "blue";
    }> = [];
    
    const recentClicksGrouped = recentClicks.reduce((groups, click) => {
      const clickDate = new Date(click._creationTime);
      clickDate.setHours(0, 0, 0, 0);
      const dateKey = clickDate.toISOString().split('T')[0];
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(click);
      return groups;
    }, {} as Record<string, typeof recentClicks>);

    // Create activity items for each day with clicks
    Object.entries(recentClicksGrouped).slice(0, 5).forEach(([dateStr, clicks]) => {
      const date = new Date(dateStr);
      const clickCount = clicks.length;
      const timestamp = date.getTime();
      
      clickActivities.push({
        _id: `clicks-${dateStr}`,
        type: "clicks",
        title: "Clicks Recorded",
        description: `${clickCount} click${clickCount !== 1 ? 's' : ''} on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        timestamp,
        iconType: "blue",
      });
    });

    // Merge and sort by timestamp descending
    const allActivities = [...commissionActivities, ...clickActivities];
    allActivities.sort((a, b) => b.timestamp - a.timestamp);

    // Limit the results
    return allActivities.slice(0, resultLimit).map(activity => ({
      ...activity,
      // Ensure type is correctly typed
      type: activity.type as "commission_confirmed" | "commission_pending" | "clicks",
      // Ensure iconType is correctly typed
      iconType: activity.iconType as "green" | "amber" | "blue",
    }));
  },
});

/**
 * Get earnings summary for an affiliate.
 * Returns total earnings, paid out, pending balance, commission rate, and counts.
 * Note: This is called from the affiliate portal - affiliateId is validated via session on the client.
 */
export const getAffiliateEarningsSummary = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.object({
    totalEarnings: v.number(),
    paidOut: v.number(),
    pendingBalance: v.number(),
    confirmedBalance: v.number(),
    confirmedCount: v.number(),
    pendingCount: v.number(),
    paidOutCount: v.number(),
    totalCount: v.number(),
    commissionRate: v.number(),
  }),
  handler: async (ctx, args) => {
    // Verify affiliate exists
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      return {
        totalEarnings: 0,
        paidOut: 0,
        pendingBalance: 0,
        confirmedBalance: 0,
        confirmedCount: 0,
        pendingCount: 0,
        paidOutCount: 0,
        totalCount: 0,
        commissionRate: 0,
      };
    }

    // Query all commissions for this affiliate
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .collect();

    // Calculate totals by status
    let totalEarnings = 0;
    let paidOut = 0;
    let paidOutCount = 0;
    let pendingBalance = 0;
    let confirmedBalance = 0;
    let confirmedCount = 0;
    let pendingCount = 0;
    let totalCount = 0;

    for (const commission of commissions) {
      if (commission.status === "approved") {
        totalEarnings += commission.amount;
      }
      totalCount += 1;

      if (commission.status === "approved") {
        confirmedCount += 1;
        confirmedBalance += commission.amount;
      } else if (commission.status === "pending") {
        pendingCount += 1;
        pendingBalance += commission.amount;
      } else if (commission.status === "paid") {
        paidOut += commission.amount;
        paidOutCount += 1;
      }
    }

    // Calculate commission rate
    // Use affiliate's commissionOverrides if available, otherwise calculate from campaigns they've earned from
    let commissionRate = 0;
    
    if (affiliate.commissionOverrides && affiliate.commissionOverrides.length > 0) {
      // Calculate average from commission overrides
      const activeOverrides = affiliate.commissionOverrides.filter(o => o.status === "active");
      if (activeOverrides.length > 0) {
        const totalRate = activeOverrides.reduce((sum, o) => sum + o.rate, 0);
        commissionRate = Math.round((totalRate / activeOverrides.length) * 100) / 100;
      }
    } else {
      // Calculate average from campaigns they've earned commissions from
      const campaignIds = new Set(commissions.map(c => c.campaignId.toString()));
      let totalCampaignRate = 0;
      let campaignCount = 0;
      
      for (const campaignIdStr of campaignIds) {
        const campaign = await ctx.db.get(campaignIdStr as Id<"campaigns">);
        if (campaign && campaign.commissionValue) {
          totalCampaignRate += campaign.commissionValue;
          campaignCount++;
        }
      }
      
      if (campaignCount > 0) {
        commissionRate = Math.round((totalCampaignRate / campaignCount) * 100) / 100;
      }
    }

    return {
      totalEarnings,
      paidOut,
      pendingBalance,
      confirmedBalance,
      confirmedCount,
      pendingCount,
      paidOutCount,
      totalCount,
      commissionRate,
    };
  },
});

/**
 * Get payout history for an affiliate.
 * Returns recent payouts with batch info and payment details.
 * Note: This is called from the affiliate portal - affiliateId is validated via session on the client.
 */
export const getAffiliatePayoutHistory = query({
  args: {
    affiliateId: v.id("affiliates"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("payouts"),
      amount: v.number(),
      status: v.string(),
      paidAt: v.optional(v.number()),
      paymentReference: v.optional(v.string()),
      batch: v.optional(
        v.object({
          _id: v.id("payoutBatches"),
          generatedAt: v.number(),
          status: v.string(),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    // Verify affiliate exists
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      return [];
    }

    // Query payouts for this affiliate, ordered by paidAt descending
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .order("desc")
      .take(args.limit || 10);

    // Get batch information for each payout
    const payoutsWithBatches = await Promise.all(
      payouts.map(async (payout) => {
        let batchInfo = undefined;
        
        if (payout.batchId) {
          const batch = await ctx.db.get(payout.batchId);
          if (batch) {
            batchInfo = {
              _id: batch._id,
              generatedAt: batch.generatedAt,
              status: batch.status,
            };
          }
        }

        return {
          _id: payout._id,
          amount: payout.amount,
          status: payout.status,
          paidAt: payout.paidAt,
          paymentReference: payout.paymentReference,
          batch: batchInfo,
        };
      })
    );

    return payoutsWithBatches;
  },
});