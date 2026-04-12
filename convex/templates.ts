import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser } from "./tenantContext";
import { internal } from "./_generated/api";

// ============================================================================
// Task 3: Template Variable System
// ============================================================================

/**
 * Template type definition with metadata for the frontend listing view.
 */
export interface TemplateTypeDefinition {
  type: string;
  label: string;
  description: string;
  variables: string[];
  requiredVariables: string[];
  sampleData: Record<string, string>;
  defaultSubject: string;
  defaultBody: string;
}

/**
 * All customizable affiliate-facing template types with their variable definitions.
 * Maps template type key to available variables.
 *
 * Required variables (first in array) MUST be present in the template.
 * Optional variables have sensible defaults if missing from template content.
 */
export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  affiliate_welcome: [
    "affiliate_name",
    "portal_name",
    "referral_link",
    "brand_logo_url",
    "brand_primary_color",
  ],
  commission_confirmed: [
    "affiliate_name",
    "commission_amount",
    "campaign_name",
    "conversion_date",
    "portal_name",
    "currency",
    "transaction_id",
    "customer_plan_type",
    "brand_logo_url",
    "brand_primary_color",
    "portal_earnings_url",
    "contact_email",
  ],
  payout_sent: [
    "affiliate_name",
    "payout_amount",
    "paid_at",
    "portal_name",
    "currency",
    "payment_reference",
    "brand_logo_url",
    "brand_primary_color",
    "portal_earnings_url",
    "contact_email",
    "batch_generated_at",
  ],
  affiliate_approval: [
    "affiliate_name",
    "portal_name",
    "brand_logo_url",
    "brand_primary_color",
    "portal_login_url",
    "contact_email",
  ],
  affiliate_rejection: [
    "affiliate_name",
    "portal_name",
    "brand_logo_url",
    "brand_primary_color",
    "contact_email",
  ],
  affiliate_suspension: [
    "affiliate_name",
    "portal_name",
    "brand_logo_url",
    "brand_primary_color",
    "contact_email",
    "suspension_reason",
  ],
  affiliate_reactivation: [
    "affiliate_name",
    "portal_name",
    "brand_logo_url",
    "brand_primary_color",
    "portal_login_url",
    "contact_email",
  ],
};

/**
 * Required variables per template type — the first N variables are "required"
 * meaning the template MUST contain them. Remaining variables are optional.
 */
const REQUIRED_VARIABLES: Record<string, string[]> = {
  affiliate_welcome: ["affiliate_name", "portal_name"],
  commission_confirmed: ["affiliate_name", "commission_amount", "portal_name"],
  payout_sent: ["affiliate_name", "payout_amount", "portal_name"],
  affiliate_approval: ["affiliate_name", "portal_name"],
  affiliate_rejection: ["affiliate_name", "portal_name"],
  affiliate_suspension: ["affiliate_name", "portal_name"],
  affiliate_reactivation: ["affiliate_name", "portal_name"],
};

/**
 * Template type definitions for the listing view (AC1).
 * Includes human-readable labels, descriptions, and sample data for live preview.
 */
export const TEMPLATE_DEFINITIONS: TemplateTypeDefinition[] = [
  {
    type: "affiliate_welcome",
    label: "Affiliate Welcome",
    description: "Sent when a new affiliate signs up. Includes their referral code and portal information.",
    variables: TEMPLATE_VARIABLES.affiliate_welcome,
    requiredVariables: REQUIRED_VARIABLES.affiliate_welcome,
    sampleData: {
      affiliate_name: "Jamie Cruz",
      portal_name: "My SaaS",
      referral_link: "https://app.example.com/r/JAMIE2024",
      brand_logo_url: "https://example.com/logo.png",
      brand_primary_color: "#1c2260",
    },
    defaultSubject: "Welcome to {{portal_name}}'s Affiliate Program!",
    defaultBody: `<h1>Welcome, {{affiliate_name}}!</h1>
<p>Your application to join <strong>{{portal_name}}</strong> has been received. Thank you for your interest in becoming an affiliate!</p>
<h3>Your Affiliate Details</h3>
<p>Your referral link: <a href="{{referral_link}}">{{referral_link}}</a></p>
<p>Save this link! You'll need it to track your referrals once approved.</p>
<p>Thank you for your interest in {{portal_name}}!</p>`,
  },
  {
    type: "commission_confirmed",
    label: "Commission Confirmed",
    description: "Sent when an affiliate's commission is approved. Includes amount and campaign details.",
    variables: TEMPLATE_VARIABLES.commission_confirmed,
    requiredVariables: REQUIRED_VARIABLES.commission_confirmed,
    sampleData: {
      affiliate_name: "Jamie Cruz",
      commission_amount: "$150.00",
      campaign_name: "Summer Sale",
      conversion_date: "March 15, 2026",
      portal_name: "My SaaS",
      currency: "USD",
      transaction_id: "TXN-12345",
      customer_plan_type: "Pro",
      brand_logo_url: "https://example.com/logo.png",
      brand_primary_color: "#1c2260",
      portal_earnings_url: "https://app.example.com/earnings",
      contact_email: "support@example.com",
    },
    defaultSubject: "Commission Confirmed: {{commission_amount}} earned!",
    defaultBody: `<h1>Congratulations, {{affiliate_name}}! 🎉</h1>
<p>Your commission has been confirmed and added to your earnings!</p>
<h3>Commission Details</h3>
<p><strong>Amount:</strong> {{commission_amount}}</p>
<p><strong>Campaign:</strong> {{campaign_name}}</p>
<p><strong>Date:</strong> {{conversion_date}}</p>
<p>This commission will be included in your next payout batch.</p>
<p>Thank you for being an affiliate with {{portal_name}}!</p>`,
  },
  {
    type: "payout_sent",
    label: "Payout Sent",
    description: "Sent when a payout batch is processed and funds are sent to the affiliate.",
    variables: TEMPLATE_VARIABLES.payout_sent,
    requiredVariables: REQUIRED_VARIABLES.payout_sent,
    sampleData: {
      affiliate_name: "Jamie Cruz",
      payout_amount: "$500.00",
      paid_at: "March 20, 2026",
      portal_name: "My SaaS",
      currency: "USD",
      payment_reference: "PAY-67890",
      brand_logo_url: "https://example.com/logo.png",
      brand_primary_color: "#1c2260",
      portal_earnings_url: "https://app.example.com/earnings",
      contact_email: "support@example.com",
      batch_generated_at: "March 19, 2026",
    },
    defaultSubject: "Payout of {{payout_amount}} has been sent!",
    defaultBody: `<h1>Good news, {{affiliate_name}}! 💸</h1>
<p>Your payout has been processed and sent. Here are the details:</p>
<h3>Payout Details</h3>
<p><strong>Amount:</strong> {{payout_amount}}</p>
<p><strong>Paid on:</strong> {{paid_at}}</p>
<p>The funds should now be available in your designated payout method.</p>
<p>Thank you for being an affiliate with {{portal_name}}!</p>`,
  },
  {
    type: "affiliate_approval",
    label: "Affiliate Approval",
    description: "Sent when an affiliate application is approved. Encourages them to log in and start promoting.",
    variables: TEMPLATE_VARIABLES.affiliate_approval,
    requiredVariables: REQUIRED_VARIABLES.affiliate_approval,
    sampleData: {
      affiliate_name: "Jamie Cruz",
      portal_name: "My SaaS",
      brand_logo_url: "https://example.com/logo.png",
      brand_primary_color: "#1c2260",
      portal_login_url: "https://app.example.com/portal/login",
      contact_email: "support@example.com",
    },
    defaultSubject: "Your application to {{portal_name}} has been approved!",
    defaultBody: `<h1>Congratulations, {{affiliate_name}}!</h1>
<p>Great news! Your application to join <strong>{{portal_name}}</strong> has been <span style="color: #10B981; font-weight: 600;">approved</span>.</p>
<p>You can now log in to your affiliate portal and start promoting.</p>
<p>Welcome to the {{portal_name}} affiliate program!</p>`,
  },
  {
    type: "affiliate_rejection",
    label: "Affiliate Rejection",
    description: "Sent when an affiliate application is rejected. Provides a polite decline with contact info.",
    variables: TEMPLATE_VARIABLES.affiliate_rejection,
    requiredVariables: REQUIRED_VARIABLES.affiliate_rejection,
    sampleData: {
      affiliate_name: "Jamie Cruz",
      portal_name: "My SaaS",
      brand_logo_url: "https://example.com/logo.png",
      brand_primary_color: "#1c2260",
      contact_email: "support@example.com",
    },
    defaultSubject: "Update on your {{portal_name}} affiliate application",
    defaultBody: `<h1>Hello, {{affiliate_name}}</h1>
<p>Thank you for your interest in the <strong>{{portal_name}}</strong> affiliate program.</p>
<p>After careful review, we regret to inform you that your application has not been approved at this time.</p>
<p>If you believe this decision was made in error, please don't hesitate to reach out.</p>
<p>We wish you the best in your future endeavors.</p>`,
  },
  {
    type: "affiliate_suspension",
    label: "Affiliate Suspension",
    description: "Sent when an affiliate account is suspended. Explains the consequences and how to appeal.",
    variables: TEMPLATE_VARIABLES.affiliate_suspension,
    requiredVariables: REQUIRED_VARIABLES.affiliate_suspension,
    sampleData: {
      affiliate_name: "Jamie Cruz",
      portal_name: "My SaaS",
      brand_logo_url: "https://example.com/logo.png",
      brand_primary_color: "#1c2260",
      contact_email: "support@example.com",
      suspension_reason: "Policy Violation",
    },
    defaultSubject: "Your {{portal_name}} affiliate account has been suspended",
    defaultBody: `<h1>Hello, {{affiliate_name}}</h1>
<p>We regret to inform you that your affiliate account with <strong>{{portal_name}}</strong> has been suspended.</p>
<h3>Reason for suspension:</h3>
<p>{{suspension_reason}}</p>
<h3>While your account is suspended:</h3>
<ul>
<li>You cannot log in to the affiliate portal</li>
<li>Your referral links are temporarily disabled</li>
<li>Pending commissions are preserved but will not be processed</li>
</ul>
<p>If you believe this was made in error, please contact the program administrator.</p>`,
  },
  {
    type: "affiliate_reactivation",
    label: "Affiliate Reactivation",
    description: "Sent when a suspended affiliate account is reactivated. Welcomes them back.",
    variables: TEMPLATE_VARIABLES.affiliate_reactivation,
    requiredVariables: REQUIRED_VARIABLES.affiliate_reactivation,
    sampleData: {
      affiliate_name: "Jamie Cruz",
      portal_name: "My SaaS",
      brand_logo_url: "https://example.com/logo.png",
      brand_primary_color: "#1c2260",
      portal_login_url: "https://app.example.com/portal/login",
      contact_email: "support@example.com",
    },
    defaultSubject: "Your {{portal_name}} affiliate account has been reactivated!",
    defaultBody: `<h1>Welcome back, {{affiliate_name}}!</h1>
<p>Great news! Your affiliate account with <strong>{{portal_name}}</strong> has been reactivated and is now fully operational.</p>
<h3>Your account is now:</h3>
<ul>
<li>Active and ready for you to log in</li>
<li>Your referral links are working again</li>
<li>You can continue earning commissions</li>
</ul>
<p>Thank you for your patience. Welcome back to the team!</p>`,
  },
];

/**
 * Get the list of all customizable template types.
 * Used by the frontend for the template listing view (AC1).
 */
export const CUSTOMIZABLE_TEMPLATE_TYPES = TEMPLATE_DEFINITIONS.map((t) => t.type);

/**
 * Validate that required template variables are present in the content.
 * Returns missing required variables if any.
 *
 * Variable syntax: `{{variable_name}}`
 */
export function validateTemplateVariables(
  templateType: string,
  content: string
): { valid: boolean; missing: string[]; invalidSyntax: string[] } {
  const requiredVars = REQUIRED_VARIABLES[templateType] || [];
  const allVars = TEMPLATE_VARIABLES[templateType] || [];

  // Extract all {{variable}} patterns from content
  const variablePattern = /\{\{(\w+)\}\}/g;
  const foundVars = new Set<string>();
  const invalidSyntax: string[] = [];
  let match: RegExpExecArray | null;

  // Also check for malformed syntax like {{ variable }} (with spaces) or unclosed {{
  const malformedPattern = /\{\{\s*\w+\s*\}\}/g;
  const spacedSyntax: string[] = [];
  let spacedMatch: RegExpExecArray | null;
  const contentWithoutValid = content.replace(variablePattern, "");
  const unclosedPattern = /\{\{[^}]*$/;
  const unclosedMatch = unclosedPattern.exec(contentWithoutValid);
  if (unclosedMatch) {
    invalidSyntax.push("Unclosed template variable: " + unclosedMatch[0]);
  }

  while ((match = variablePattern.exec(content)) !== null) {
    foundVars.add(match[1]);
  }

  // Check for spaces inside braces
  const spacedBracePattern = /\{\{\s+(\w+)\s+\}\}/g;
  while ((spacedMatch = spacedBracePattern.exec(content)) !== null) {
    if (!invalidSyntax.includes(`Spaces inside {{}} are not allowed. Use {{{{${spacedMatch[1]}}}}} without spaces.`)) {
      invalidSyntax.push(`Spaces inside {{}} are not allowed. Use {{{{${spacedMatch[1]}}}}} without spaces.`);
    }
  }

  // Check for unknown variables (variables not in the allowed list for this template type)
  const unknownVars: string[] = [];
  for (const foundVar of foundVars) {
    if (!allVars.includes(foundVar)) {
      unknownVars.push(foundVar);
      invalidSyntax.push(`Unknown variable: {{{{${foundVar}}}}}`);
    }
  }

  const missing = requiredVars.filter((v) => !foundVars.has(v));

  return {
    valid: missing.length === 0 && invalidSyntax.length === 0,
    missing,
    invalidSyntax,
  };
}

/**
 * Render a template string by replacing {{variable}} placeholders with actual values.
 * Variables not found in the data map are left as-is.
 */
export function renderTemplate(
  content: string,
  variables: Record<string, string | number | undefined>
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key];
    if (value === undefined) {
      return `{{${key}}}`; // Keep original if not provided
    }
    return String(value);
  });
}

/**
 * Sanitize HTML content by removing dangerous tags (script, iframe, etc.)
 * while preserving safe HTML for email templates.
 */
export function sanitizeHtmlContent(html: string): string {
  // Remove <script> tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Remove <iframe> tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  // Remove <object> tags
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  // Remove <embed> tags
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, "");
  // Remove javascript: in href/src attributes
  sanitized = sanitized.replace(/(href|src)\s*=\s*["']javascript:[^"']*["']/gi, '$1=""');
  // Remove on* event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*\S+/gi, "");

  return sanitized;
}

// ============================================================================
// Frontend Convenience Queries (auto-resolve tenant from auth)
// ============================================================================

/**
 * Public query: List all customizable email templates for the current user's tenant.
 * Wraps listEmailTemplates with automatic tenant resolution from auth.
 */
export const listMyEmailTemplates = query({
  args: {},
  returns: v.union(
    v.array(
      v.object({
        type: v.string(),
        label: v.string(),
        description: v.string(),
        status: v.union(v.literal("default"), v.literal("customized")),
        customSubject: v.optional(v.string()),
        customBody: v.optional(v.string()),
        variables: v.array(v.string()),
        sampleData: v.record(v.string(), v.string()),
        defaultSubject: v.string(),
        defaultBody: v.string(),
        updatedAt: v.optional(v.number()),
      })
    ),
    v.null()
  ),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return null;
    }

    const customTemplates = await ctx.db
      .query("emailTemplates")
      .withIndex("by_tenant_and_type", (q) =>
        q.eq("tenantId", authUser.tenantId)
      )
      .collect();

    const customMap = new Map<string, (typeof customTemplates)[number]>();
    for (const ct of customTemplates) {
      customMap.set(ct.templateType, ct);
    }

    return TEMPLATE_DEFINITIONS.map((def) => {
      const custom = customMap.get(def.type);
      return {
        type: def.type,
        label: def.label,
        description: def.description,
        status: custom ? "customized" as const : "default" as const,
        customSubject: custom?.customSubject,
        customBody: custom?.customBody,
        variables: def.variables,
        sampleData: def.sampleData,
        defaultSubject: def.defaultSubject,
        defaultBody: def.defaultBody,
        updatedAt: custom?.updatedAt,
      };
    });
  },
});

/**
 * Public query: Get a specific template for the current user's tenant.
 */
export const getMyEmailTemplate = query({
  args: {
    templateType: v.string(),
  },
  returns: v.union(
    v.object({
      type: v.string(),
      label: v.string(),
      description: v.string(),
      status: v.union(v.literal("default"), v.literal("customized")),
      subject: v.string(),
      body: v.string(),
      variables: v.array(v.string()),
      requiredVariables: v.array(v.string()),
      sampleData: v.record(v.string(), v.string()),
      defaultSubject: v.string(),
      defaultBody: v.string(),
      updatedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return null;
    }

    const definition = TEMPLATE_DEFINITIONS.find((d) => d.type === args.templateType);
    if (!definition) {
      return null;
    }

    const custom = await ctx.db
      .query("emailTemplates")
      .withIndex("by_tenant_and_type", (q) =>
        q.eq("tenantId", authUser.tenantId).eq("templateType", args.templateType)
      )
      .unique();

    return {
      type: definition.type,
      label: definition.label,
      description: definition.description,
      status: custom ? "customized" as const : "default" as const,
      subject: custom?.customSubject ?? definition.defaultSubject,
      body: custom?.customBody ?? definition.defaultBody,
      variables: definition.variables,
      requiredVariables: definition.requiredVariables,
      sampleData: definition.sampleData,
      defaultSubject: definition.defaultSubject,
      defaultBody: definition.defaultBody,
      updatedAt: custom?.updatedAt,
    };
  },
});

/**
 * Public mutation: Save or update a custom email template for the current user.
 */
export const upsertMyEmailTemplate = mutation({
  args: {
    templateType: v.string(),
    customSubject: v.string(),
    customBody: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({
      success: v.literal(false),
      error: v.string(),
      details: v.optional(
        v.object({
          missing: v.optional(v.array(v.string())),
          invalidSyntax: v.optional(v.array(v.string())),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return {
        success: false as const,
        error: "Not authenticated",
      };
    }

    const definition = TEMPLATE_DEFINITIONS.find((d) => d.type === args.templateType);
    if (!definition) {
      return {
        success: false as const,
        error: `Unknown template type: ${args.templateType}`,
      };
    }

    const sanitizedBody = sanitizeHtmlContent(args.customBody);

    // Validate combined subject + body for required variables
    // Required variables must appear in at least the subject OR body, not necessarily both
    const combinedContent = args.customSubject + " " + sanitizedBody;
    const combinedValidation = validateTemplateVariables(args.templateType, combinedContent);
    if (!combinedValidation.valid) {
      return {
        success: false as const,
        error: "Template validation failed",
        details: combinedValidation,
      };
    }

    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_tenant_and_type", (q) =>
        q.eq("tenantId", authUser.tenantId).eq("templateType", args.templateType)
      )
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customSubject: args.customSubject,
        customBody: sanitizedBody,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("emailTemplates", {
        tenantId: authUser.tenantId,
        templateType: args.templateType,
        customSubject: args.customSubject,
        customBody: sanitizedBody,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Audit log — email template saved (non-fatal)
    try {
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId: authUser.tenantId,
        action: "EMAIL_TEMPLATE_SAVED",
        entityType: "emailTemplate",
        entityId: existing ? existing._id : args.templateType,
        actorId: authUser.userId,
        actorType: "user",
        metadata: { templateType: args.templateType },
      });
    } catch (err) {
      console.error("[Audit] Failed to log EMAIL_TEMPLATE_SAVED (non-fatal):", err);
    }

    return { success: true as const };
  },
});

/**
 * Public mutation: Reset a custom template for the current user.
 */
export const resetMyEmailTemplate = mutation({
  args: {
    templateType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return null;
    }

    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_tenant_and_type", (q) =>
        q.eq("tenantId", authUser.tenantId).eq("templateType", args.templateType)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Audit log — email template reset/deleted (non-fatal)
    try {
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId: authUser.tenantId,
        action: "EMAIL_TEMPLATE_DELETED",
        entityType: "emailTemplate",
        entityId: (existing as any)?._id ?? args.templateType,
        actorId: authUser.userId,
        actorType: "user",
        metadata: { templateType: args.templateType },
      });
    } catch (err) {
      console.error("[Audit] Failed to log EMAIL_TEMPLATE_DELETED (non-fatal):", err);
    }

    return null;
  },
});



/**
 * Public query: List all customizable email templates for the current tenant.
 * Returns template definitions merged with any custom overrides.
 * Used by AC1: Template Listing View.
 */
export const listEmailTemplates = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.array(
    v.object({
      type: v.string(),
      label: v.string(),
      description: v.string(),
      status: v.union(v.literal("default"), v.literal("customized")),
      customSubject: v.optional(v.string()),
      customBody: v.optional(v.string()),
      variables: v.array(v.string()),
      sampleData: v.record(v.string(), v.string()),
      defaultSubject: v.string(),
      defaultBody: v.string(),
      updatedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    // Fetch all custom templates for this tenant
    const customTemplates = await ctx.db
      .query("emailTemplates")
      .withIndex("by_tenant_and_type", (q) =>
        q.eq("tenantId", args.tenantId)
      )
      .collect();

    // Build a map of custom templates by type
    const customMap = new Map<string, (typeof customTemplates)[number]>();
    for (const ct of customTemplates) {
      customMap.set(ct.templateType, ct);
    }

    // Merge template definitions with custom overrides
    return TEMPLATE_DEFINITIONS.map((def) => {
      const custom = customMap.get(def.type);
      return {
        type: def.type,
        label: def.label,
        description: def.description,
        status: custom ? "customized" as const : "default" as const,
        customSubject: custom?.customSubject,
        customBody: custom?.customBody,
        variables: def.variables,
        sampleData: def.sampleData,
        defaultSubject: def.defaultSubject,
        defaultBody: def.defaultBody,
        updatedAt: custom?.updatedAt,
      };
    });
  },
});

/**
 * Public query: Get a specific template with default/custom merge.
 * Returns the custom subject/body if exists, otherwise the default.
 * Used by the template editor (AC2).
 */
export const getEmailTemplate = query({
  args: {
    tenantId: v.id("tenants"),
    templateType: v.string(),
  },
  returns: v.union(
    v.object({
      type: v.string(),
      label: v.string(),
      description: v.string(),
      status: v.union(v.literal("default"), v.literal("customized")),
      subject: v.string(),
      body: v.string(),
      variables: v.array(v.string()),
      requiredVariables: v.array(v.string()),
      sampleData: v.record(v.string(), v.string()),
      defaultSubject: v.string(),
      defaultBody: v.string(),
      updatedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const definition = TEMPLATE_DEFINITIONS.find((d) => d.type === args.templateType);
    if (!definition) {
      return null;
    }

    const custom = await ctx.db
      .query("emailTemplates")
      .withIndex("by_tenant_and_type", (q) =>
        q.eq("tenantId", args.tenantId).eq("templateType", args.templateType)
      )
      .unique();

    return {
      type: definition.type,
      label: definition.label,
      description: definition.description,
      status: custom ? "customized" as const : "default" as const,
      subject: custom?.customSubject ?? definition.defaultSubject,
      body: custom?.customBody ?? definition.defaultBody,
      variables: definition.variables,
      requiredVariables: definition.requiredVariables,
      sampleData: definition.sampleData,
      defaultSubject: definition.defaultSubject,
      defaultBody: definition.defaultBody,
      updatedAt: custom?.updatedAt,
    };
  },
});

/**
 * Internal query: Get custom template for email sending.
 * Returns the custom template if it exists, or null to use the default.
 * Used by AC5: Email Sending Uses Custom Templates.
 */
export const getEmailTemplateForSending = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    templateType: v.string(),
  },
  returns: v.union(
    v.object({
      customSubject: v.string(),
      customBody: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const custom = await ctx.db
      .query("emailTemplates")
      .withIndex("by_tenant_and_type", (q) =>
        q.eq("tenantId", args.tenantId).eq("templateType", args.templateType)
      )
      .unique();

    if (!custom) {
      return null;
    }

    return {
      customSubject: custom.customSubject,
      customBody: custom.customBody,
    };
  },
});

/**
 * Internal query: Get default template content for a given template type.
 * Used as fallback when no custom template exists.
 */
export const getDefaultTemplate = internalQuery({
  args: {
    templateType: v.string(),
  },
  returns: v.union(
    v.object({
      defaultSubject: v.string(),
      defaultBody: v.string(),
    }),
    v.null()
  ),
  handler: async (_ctx, args) => {
    const definition = TEMPLATE_DEFINITIONS.find((d) => d.type === args.templateType);
    if (!definition) {
      return null;
    }

    return {
      defaultSubject: definition.defaultSubject,
      defaultBody: definition.defaultBody,
    };
  },
});

/**
 * Public mutation: Save or update a custom email template.
 * Validates required variables before saving.
 * Used by AC4: Custom Template Storage.
 */
export const upsertEmailTemplate = mutation({
  args: {
    tenantId: v.id("tenants"),
    templateType: v.string(),
    customSubject: v.string(),
    customBody: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({
      success: v.literal(false),
      error: v.string(),
      details: v.optional(
        v.object({
          missing: v.optional(v.array(v.string())),
          invalidSyntax: v.optional(v.array(v.string())),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    // Validate template type
    const definition = TEMPLATE_DEFINITIONS.find((d) => d.type === args.templateType);
    if (!definition) {
      return {
        success: false as const,
        error: `Unknown template type: ${args.templateType}`,
      };
    }

    // Sanitize HTML content
    const sanitizedBody = sanitizeHtmlContent(args.customBody);

    // Validate combined subject + body for required variables
    // Required variables must appear in at least the subject OR body, not necessarily both
    const combinedContent = args.customSubject + " " + sanitizedBody;
    const combinedValidation = validateTemplateVariables(args.templateType, combinedContent);
    if (!combinedValidation.valid) {
      return {
        success: false as const,
        error: "Template validation failed",
        details: combinedValidation,
      };
    }

    // Check if a custom template already exists for this tenant + type
    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_tenant_and_type", (q) =>
        q.eq("tenantId", args.tenantId).eq("templateType", args.templateType)
      )
      .unique();

    const now = Date.now();

    if (existing) {
      // Update existing template
      await ctx.db.patch(existing._id, {
        customSubject: args.customSubject,
        customBody: sanitizedBody,
        updatedAt: now,
      });
    } else {
      // Create new custom template
      await ctx.db.insert("emailTemplates", {
        tenantId: args.tenantId,
        templateType: args.templateType,
        customSubject: args.customSubject,
        customBody: sanitizedBody,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true as const };
  },
});

/**
 * Public mutation: Delete custom template, reverting to default.
 * Used by AC2: "Reset to Default" button.
 */
export const resetEmailTemplate = mutation({
  args: {
    tenantId: v.id("tenants"),
    templateType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_tenant_and_type", (q) =>
        q.eq("tenantId", args.tenantId).eq("templateType", args.templateType)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});
