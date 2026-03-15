import { query, mutation, action, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { sendAffiliateWelcomeEmail, sendNewAffiliateNotificationEmail } from "./email";

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
    let welcomeEmailSent = false;
    let welcomeEmailError: string | undefined;
    try {
      await sendAffiliateWelcomeEmail(ctx, {
        to: args.email,
        affiliateName: args.name,
        affiliateEmail: args.email,
        uniqueCode,
        portalName: tenant.branding?.portalName || tenant.name,
        brandLogoUrl: tenant.branding?.logoUrl,
        brandPrimaryColor: tenant.branding?.primaryColor,
        approvalTimeframe: "1-2 business days",
        contactEmail: undefined, // Could be extended to store in tenant settings
      });
      welcomeEmailSent = true;
    } catch (emailError) {
      welcomeEmailError = emailError instanceof Error ? emailError.message : String(emailError);
      console.error("Failed to send welcome email:", emailError);
    }
    
    // Store welcome email result in emails table
    await ctx.db.insert("emails", {
      tenantId: tenant._id,
      type: "affiliate_welcome",
      recipientEmail: args.email,
      subject: `Welcome to ${tenant.branding?.portalName || tenant.name}!`,
      status: welcomeEmailSent ? "sent" : "failed",
      sentAt: welcomeEmailSent ? Date.now() : undefined,
      errorMessage: welcomeEmailError,
    });

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