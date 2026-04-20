import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin/_helpers";

export interface PlatformTemplateTypeDefinition {
  type: string;
  label: string;
  description: string;
  variables: string[];
  requiredVariables: string[];
  sampleData: Record<string, string>;
  defaultSubject: string;
  defaultBody: string;
}

export const PLATFORM_TEMPLATE_VARIABLES: Record<string, string[]> = {
  platform_payment_success: [
    "owner_name",
    "plan",
    "amount",
    "currency",
    "billing_start",
    "billing_end",
    "transaction_id",
    "dashboard_url",
    "platform_name",
    "support_email",
  ],
  platform_trial_ending: [
    "owner_name",
    "plan",
    "trial_end_date",
    "days_remaining",
    "dashboard_url",
    "platform_name",
    "support_email",
  ],
  platform_trial_expired: [
    "owner_name",
    "plan",
    "trial_end_date",
    "dashboard_url",
    "platform_name",
    "support_email",
  ],
  platform_subscription_active: [
    "owner_name",
    "plan",
    "billing_start",
    "billing_end",
    "dashboard_url",
    "platform_name",
    "support_email",
  ],
  platform_subscription_cancelled: [
    "owner_name",
    "plan",
    "access_end_date",
    "dashboard_url",
    "platform_name",
    "support_email",
  ],
  platform_past_due: [
    "owner_name",
    "plan",
    "amount",
    "currency",
    "dashboard_url",
    "platform_name",
    "support_email",
  ],
};

const PLATFORM_REQUIRED_VARIABLES: Record<string, string[]> = {
  platform_payment_success: ["owner_name", "plan"],
  platform_trial_ending: ["owner_name", "days_remaining"],
  platform_trial_expired: ["owner_name"],
  platform_subscription_active: ["owner_name", "plan"],
  platform_subscription_cancelled: ["owner_name", "plan"],
  platform_past_due: ["owner_name", "plan"],
};

export const PLATFORM_TEMPLATE_DEFINITIONS: PlatformTemplateTypeDefinition[] = [
  {
    type: "platform_payment_success",
    label: "Payment Confirmation",
    description: "Sent to the SaaS owner after a successful Stripe checkout or subscription payment.",
    variables: PLATFORM_TEMPLATE_VARIABLES.platform_payment_success,
    requiredVariables: PLATFORM_REQUIRED_VARIABLES.platform_payment_success,
    sampleData: {
      owner_name: "Alex",
      plan: "Growth",
      amount: "₱2,500",
      currency: "PHP",
      billing_start: "April 20, 2026",
      billing_end: "May 20, 2026",
      transaction_id: "TXN_STRIPE_12345",
      dashboard_url: "https://affilio.com/dashboard",
      platform_name: "Salig Affiliate",
      support_email: "support@affilio.com",
    },
    defaultSubject: "Payment confirmed — {{plan}} plan activated",
    defaultBody: `<h1>Payment Confirmed</h1>
<p>Hi {{owner_name}},</p>
<p>Your payment has been successfully processed. Your <strong>{{plan}}</strong> subscription is now active.</p>
<h3>Receipt Details</h3>
<p><strong>Plan:</strong> {{plan}}</p>
<p><strong>Amount:</strong> {{amount}} {{currency}}</p>
<p><strong>Billing Period:</strong> {{billing_start}} — {{billing_end}}</p>
<p>All features included in your plan are now available. Log in to your <a href="{{dashboard_url}}">dashboard</a> to get started.</p>`,
  },
  {
    type: "platform_trial_ending",
    label: "Trial Ending Soon",
    description: "Sent to the SaaS owner when their trial period is ending (e.g., 7 days, 3 days, 1 day remaining).",
    variables: PLATFORM_TEMPLATE_VARIABLES.platform_trial_ending,
    requiredVariables: PLATFORM_REQUIRED_VARIABLES.platform_trial_ending,
    sampleData: {
      owner_name: "Alex",
      plan: "Growth",
      trial_end_date: "April 27, 2026",
      days_remaining: "7",
      dashboard_url: "https://affilio.com/settings/billing",
      platform_name: "Salig Affiliate",
      support_email: "support@affilio.com",
    },
    defaultSubject: "Your trial ends in {{days_remaining}} days",
    defaultBody: `<h1>Trial Ending Soon</h1>
<p>Hi {{owner_name}},</p>
<p>Your <strong>{{plan}}</strong> trial ends on <strong>{{trial_end_date}}</strong> — that's just <strong>{{days_remaining}} days</strong> away.</p>
<p>To avoid any interruption, upgrade to a paid plan before your trial expires.</p>
<p><a href="{{dashboard_url}}">Upgrade Now</a></p>
<p>Need help? Reach out to <a href="mailto:{{support_email}}">{{support_email}}</a></p>`,
  },
  {
    type: "platform_trial_expired",
    label: "Trial Expired",
    description: "Sent to the SaaS owner when their trial period has ended without upgrading.",
    variables: PLATFORM_TEMPLATE_VARIABLES.platform_trial_expired,
    requiredVariables: PLATFORM_REQUIRED_VARIABLES.platform_trial_expired,
    sampleData: {
      owner_name: "Alex",
      plan: "Growth",
      trial_end_date: "April 27, 2026",
      dashboard_url: "https://affilio.com/settings/billing",
      platform_name: "Salig Affiliate",
      support_email: "support@affilio.com",
    },
    defaultSubject: "Your trial has expired",
    defaultBody: `<h1>Trial Expired</h1>
<p>Hi {{owner_name}},</p>
<p>Your <strong>{{plan}}</strong> trial ended on {{trial_end_date}}. Your account is now in read-only mode.</p>
<p>Upgrade to a paid plan to restore full access to all features:</p>
<p><a href="{{dashboard_url}}">Upgrade Now</a></p>
<p>If you have questions, contact us at <a href="mailto:{{support_email}}">{{support_email}}</a></p>`,
  },
  {
    type: "platform_subscription_active",
    label: "Subscription Activated",
    description: "Sent when a subscription becomes active (new, recovered from past_due, or trial conversion).",
    variables: PLATFORM_TEMPLATE_VARIABLES.platform_subscription_active,
    requiredVariables: PLATFORM_REQUIRED_VARIABLES.platform_subscription_active,
    sampleData: {
      owner_name: "Alex",
      plan: "Growth",
      billing_start: "April 20, 2026",
      billing_end: "May 20, 2026",
      dashboard_url: "https://affilio.com/dashboard",
      platform_name: "Salig Affiliate",
      support_email: "support@affilio.com",
    },
    defaultSubject: "Your {{plan}} subscription is now active",
    defaultBody: `<h1>Subscription Activated</h1>
<p>Hi {{owner_name}},</p>
<p>Your <strong>{{plan}}</strong> subscription is now active. All features are available.</p>
<p><strong>Billing Period:</strong> {{billing_start}} — {{billing_end}}</p>
<p>Log in to your <a href="{{dashboard_url}}">dashboard</a> to get started.</p>`,
  },
  {
    type: "platform_subscription_cancelled",
    label: "Subscription Cancelled",
    description: "Sent when a SaaS owner cancels their platform subscription.",
    variables: PLATFORM_TEMPLATE_VARIABLES.platform_subscription_cancelled,
    requiredVariables: PLATFORM_REQUIRED_VARIABLES.platform_subscription_cancelled,
    sampleData: {
      owner_name: "Alex",
      plan: "Growth",
      access_end_date: "May 20, 2026",
      dashboard_url: "https://affilio.com/settings/billing",
      platform_name: "Salig Affiliate",
      support_email: "support@affilio.com",
    },
    defaultSubject: "Your subscription has been cancelled",
    defaultBody: `<h1>Subscription Cancelled</h1>
<p>Hi {{owner_name}},</p>
<p>Your <strong>{{plan}}</strong> subscription has been cancelled as requested.</p>
<p>You will retain access until <strong>{{access_end_date}}</strong>. After that date, your account will enter a grace period before data deletion.</p>
<p>If you change your mind, you can reactivate your subscription at any time from your <a href="{{dashboard_url}}">billing settings</a>.</p>
<p>Questions? Contact <a href="mailto:{{support_email}}">{{support_email}}</a></p>`,
  },
  {
    type: "platform_past_due",
    label: "Payment Overdue",
    description: "Sent to the SaaS owner when a subscription payment fails.",
    variables: PLATFORM_TEMPLATE_VARIABLES.platform_past_due,
    requiredVariables: PLATFORM_REQUIRED_VARIABLES.platform_past_due,
    sampleData: {
      owner_name: "Alex",
      plan: "Growth",
      amount: "₱2,500",
      currency: "PHP",
      dashboard_url: "https://affilio.com/settings/billing",
      platform_name: "Salig Affiliate",
      support_email: "support@affilio.com",
    },
    defaultSubject: "Payment overdue — action required",
    defaultBody: `<h1>Payment Overdue</h1>
<p>Hi {{owner_name}},</p>
<p>We were unable to process your <strong>{{plan}}</strong> subscription payment of <strong>{{amount}} {{currency}}</strong>.</p>
<p>Please update your payment method to avoid service interruption. Write operations are currently restricted.</p>
<p><a href="{{dashboard_url}}">Update Payment Method</a></p>
<p>If you believe this is an error, contact <a href="mailto:{{support_email}}">{{support_email}}</a></p>`,
  },
];

export const PLATFORM_TEMPLATE_TYPES = PLATFORM_TEMPLATE_DEFINITIONS.map((t) => t.type);

function validatePlatformTemplateVariables(
  templateType: string,
  content: string
): { valid: boolean; missing: string[]; invalidSyntax: string[] } {
  const requiredVars = PLATFORM_REQUIRED_VARIABLES[templateType] || [];
  const allVars = PLATFORM_TEMPLATE_VARIABLES[templateType] || [];

  const variablePattern = /\{\{(\w+)\}\}/g;
  const foundVars = new Set<string>();
  const invalidSyntax: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = variablePattern.exec(content)) !== null) {
    foundVars.add(match[1]);
  }

  const spacedBracePattern = /\{\{\s+(\w+)\s+\}\}/g;
  let spacedMatch: RegExpExecArray | null;
  while ((spacedMatch = spacedBracePattern.exec(content)) !== null) {
    invalidSyntax.push(`Spaces inside {{}} are not allowed. Use {{${spacedMatch[1]}}} without spaces.`);
  }

  for (const foundVar of foundVars) {
    if (!allVars.includes(foundVar)) {
      invalidSyntax.push(`Unknown variable: {{${foundVar}}}`);
    }
  }

  const missing = requiredVars.filter((v) => !foundVars.has(v));

  return { valid: missing.length === 0 && invalidSyntax.length === 0, missing, invalidSyntax };
}

function sanitizeHtmlContent(html: string): string {
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, "");
  sanitized = sanitized.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "");
  sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "");
  sanitized = sanitized.replace(/<meta\b[^>]*>/gi, "");
  sanitized = sanitized.replace(/<link\b[^>]*>/gi, "");
  sanitized = sanitized.replace(/<base\b[^>]*>/gi, "");
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  sanitized = sanitized.replace(/<(\/?)template\b[^>]*>/gi, "");
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript\s*:[^"'>]*/gi, 'href=""');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*javascript\s*:[^"'>]*/gi, 'src=""');
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*data\s*:[^"'>]*/gi, 'href=""');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*data\s*:[^"'>]*/gi, 'src=""');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*\S+/gi, "");
  sanitized = sanitized.replace(/&#\w+;/gi, (match) => {
    const decoded = match.replace(/&#(\w+);/, (_, code) => {
      const num = parseInt(code, 10);
      if (num >= 0 && num <= 127) return String.fromCharCode(num);
      return match;
    });
    return decoded;
  });
  sanitized = sanitized.replace(/<(\/?)\w+[^>]*>/gi, (tag) => {
    if (/\bon\w+\s*=/i.test(tag)) return "";
    return tag;
  });
  return sanitized;
}

export function renderPlatformTemplate(
  content: string,
  variables: Record<string, string | number | undefined>
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key];
    if (value === undefined) {
      return `{{${key}}}`;
    }
    return String(value);
  });
}

export const listPlatformEmailTemplates = query({
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
    await requireAdmin(ctx);

    const allCustom = await ctx.db.query("platformEmailTemplates").collect();
    const customMap = new Map<string, (typeof allCustom)[number]>();
    for (const ct of allCustom) {
      customMap.set(ct.templateType, ct);
    }

    return PLATFORM_TEMPLATE_DEFINITIONS.map((def) => {
      const custom = customMap.get(def.type);
      return {
        type: def.type,
        label: def.label,
        description: def.description,
        status: custom ? ("customized" as const) : ("default" as const),
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

export const getPlatformEmailTemplate = query({
  args: { templateType: v.string() },
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
    await requireAdmin(ctx);

    const definition = PLATFORM_TEMPLATE_DEFINITIONS.find((d) => d.type === args.templateType);
    if (!definition) return null;

    const custom = await ctx.db
      .query("platformEmailTemplates")
      .withIndex("by_template_type", (q) => q.eq("templateType", args.templateType))
      .unique();

    return {
      type: definition.type,
      label: definition.label,
      description: definition.description,
      status: custom ? ("customized" as const) : ("default" as const),
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

export const upsertPlatformEmailTemplate = mutation({
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
    const admin = await requireAdmin(ctx);

    const definition = PLATFORM_TEMPLATE_DEFINITIONS.find((d) => d.type === args.templateType);
    if (!definition) {
      return { success: false as const, error: `Unknown template type: ${args.templateType}` };
    }

    const sanitizedBody = sanitizeHtmlContent(args.customBody);
    const combinedContent = args.customSubject + " " + sanitizedBody;
    const validation = validatePlatformTemplateVariables(args.templateType, combinedContent);
    if (!validation.valid) {
      return { success: false as const, error: "Template validation failed", details: validation };
    }

    const existing = await ctx.db
      .query("platformEmailTemplates")
      .withIndex("by_template_type", (q) => q.eq("templateType", args.templateType))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customSubject: args.customSubject,
        customBody: sanitizedBody,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("platformEmailTemplates", {
        templateType: args.templateType,
        customSubject: args.customSubject,
        customBody: sanitizedBody,
        createdAt: now,
        updatedAt: now,
      });
    }

    try {
      await ctx.db.insert("auditLogs", {
        action: "PLATFORM_EMAIL_TEMPLATE_SAVED",
        entityType: "platformEmailTemplate",
        entityId: args.templateType,
        actorId: admin._id,
        actorType: "admin",
        metadata: { templateType: args.templateType },
      });
    } catch (err) {
      console.error("[Audit] Failed to log PLATFORM_EMAIL_TEMPLATE_SAVED:", err);
    }

    return { success: true as const };
  },
});

export const resetPlatformEmailTemplate = mutation({
  args: { templateType: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const existing = await ctx.db
      .query("platformEmailTemplates")
      .withIndex("by_template_type", (q) => q.eq("templateType", args.templateType))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    try {
      await ctx.db.insert("auditLogs", {
        action: "PLATFORM_EMAIL_TEMPLATE_RESET",
        entityType: "platformEmailTemplate",
        entityId: args.templateType,
        actorId: admin._id,
        actorType: "admin",
        metadata: { templateType: args.templateType },
      });
    } catch (err) {
      console.error("[Audit] Failed to log PLATFORM_EMAIL_TEMPLATE_RESET:", err);
    }

    return null;
  },
});

export const getPlatformTemplateForSending = internalQuery({
  args: { templateType: v.string() },
  returns: v.union(
    v.object({
      customSubject: v.string(),
      customBody: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const custom = await ctx.db
      .query("platformEmailTemplates")
      .withIndex("by_template_type", (q) => q.eq("templateType", args.templateType))
      .unique();

    if (!custom) return null;

    return { customSubject: custom.customSubject, customBody: custom.customBody };
  },
});

export const getPlatformTemplateDefault = internalQuery({
  args: { templateType: v.string() },
  returns: v.union(
    v.object({
      defaultSubject: v.string(),
      defaultBody: v.string(),
    }),
    v.null()
  ),
  handler: async (_ctx, args) => {
    const definition = PLATFORM_TEMPLATE_DEFINITIONS.find((d) => d.type === args.templateType);
    if (!definition) return null;
    return { defaultSubject: definition.defaultSubject, defaultBody: definition.defaultBody };
  },
});
