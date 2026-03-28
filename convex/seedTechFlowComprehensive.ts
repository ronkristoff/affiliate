/**
 * Comprehensive Test Data Generator for TechFlow SaaS (Alex Chen's Tenant)
 *
 * Generates realistic test data covering ALL tables, ALL statuses, and ALL scenarios.
 * Designed for full UI/dashboard testing with pagination, filtering, and edge cases.
 *
 * COVERAGE:
 * ──────────────────────────────────────────────────────────────────────────
 * TABLE                    ROWS    SCENARIOS
 * affiliates               750     active/pending/suspended/rejected, fraud signals,
 *                                  commission overrides, payout methods, channels
 * affiliateCampaigns       800+    active/paused/removed, signup/invite enrollment
 * referralLinks            700+    multi-campaign, single-campaign
 * affiliateSessions        150     login sessions with device/IP variety
 * clicks                   800+    spread across 5 months, various referrers/UAs/IPs
 * conversions              750+    cookie/webhook/organic/body attribution,
 *                                  self-referrals, subscription metadata
 * commissions              750+    pending/approved/paid/declined/reversed,
 *                                  fraud indicators, self-referrals, reversals
 * payoutBatches            35+     completed/pending/processing, monthly cadence
 * payouts                  700+    completed/pending/processing, saligpay/manual
 * auditLogs                300+    all action types, all entity types, actors
 * emails                   400+    all types, all delivery statuses (queued→complained)
 * broadcastEmails          5       sent/partial/failed
 * emailTemplates           6       custom templates per type
 * brandAssets              15      logo/banner/product-image/copy-text
 * billingHistory           10      trial/renewal/upgrade events
 * teamInvitations          5       pending/accepted/expired
 * loginAttempts            25      failed attempts, locked accounts
 * performanceMetrics       200     click_response_time, conversion_response_time, error_rate
 * trackingPings            100     verification pings across 5 months
 * rawWebhooks              50      processed/failed/duplicate events
 * ──────────────────────────────────────────────────────────────────────────
 *
 * DATE RANGE: Dec 1, 2025 → Mar 28, 2026 (4 months, ~117 days)
 *
 * USAGE:
 *   npx convex run seedTechFlowComprehensive:seedTechFlow --args '{"tenantSlug":"techflow-saas"}'
 *   npx convex run seedTechFlowComprehensive:seedTechFlow --args '{"tenantSlug":"techflow-saas","dryRun":true}'
 *
 * Password for all generated test affiliates: "TestPass123!"
 */

import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// =============================================================================
// Constants & Lookup Tables
// =============================================================================

const PROMOTION_CHANNELS = [
  "YouTube", "Blog", "Social Media", "Email Marketing", "Instagram",
  "Facebook Group", "TikTok", "Twitter/X", "LinkedIn", "Podcast",
  "Website", "WhatsApp", "Telegram", "Pinterest",
];

const AFFILIATE_STATUSES = [
  "active", "active", "active", "active", "active", "active", "active",
  "pending", "pending", "pending",
  "suspended", "suspended",
  "rejected",
] as const;

const COMMISSION_STATUSES = [
  "pending", "pending", "pending", "pending",
  "approved", "approved", "approved", "approved", "approved",
  "paid", "paid", "paid", "paid", "paid", "paid",
  "declined", "declined",
  "reversed", "reversed",
] as const;

const PAYOUT_BATCH_STATUSES = ["completed", "completed", "completed", "pending", "processing"] as const;
const PAYOUT_STATUSES = ["completed", "completed", "completed", "pending", "processing"] as const;
const REVERSAL_REASONS = ["refund", "chargeback"] as const;
const FRAUD_INDICATORS = [
  "self_referral_ip_match", "same_device_fingerprint",
  "rapid_consecutive_conversions", "suspicious_payment_method", "velocity_exceeded",
];

const ATTRIBUTION_SOURCES = ["cookie", "cookie", "cookie", "webhook", "webhook", "organic", "body"] as const;

const EMAIL_TYPES = [
  "affiliate_welcome", "commission_confirmed", "payout_sent",
  "affiliate_approved", "affiliate_rejected", "campaign_invite",
  "commission_declined", "payout_failed",
];

const EMAIL_DELIVERY_STATUSES = [
  "queued", "sent", "sent", "delivered", "delivered", "delivered",
  "opened", "opened", "clicked",
  "bounced", "complained",
] as const;

const AUDIT_ACTIONS = [
  "affiliate_created", "affiliate_approved", "affiliate_rejected", "affiliate_suspended",
  "affiliate_reactivated", "affiliate_removed",
  "commission_created", "commission_approved", "commission_declined", "commission_reversed",
  "payout_batch_created", "payout_processed", "payout_failed",
  "campaign_created", "campaign_updated", "campaign_paused", "campaign_archived",
  "user_created", "user_role_changed",
  "brand_asset_uploaded", "brand_asset_removed",
  "email_template_updated", "email_template_reset",
  "payout_method_updated",
];

const FIRST_NAMES = [
  "Marco", "Angela", "Jose", "Maria", "Carlos", "Sofia", "Ricardo", "Isabella",
  "Fernando", "Camille", "Andres", "Lucia", "Diego", "Patricia", "Miguel", "Elena",
  "Roberto", "Gabriela", "Eduardo", "Valentina", "Antonio", "Daniela", "Rafael",
  "Mariana", "Sergio", "Victoria", "Luis", "Carolina", "Pedro", "Alejandra",
  "Jorge", "Natalia", "Francisco", "Teresa", "Alberto", "Raquel", "Pablo",
  "Beatriz", "Daniel", "Lorena", "Hugo", "Carmen", "Adrian", "Rosa", "Ivan",
  "Silvia", "Oscar", "Claudia", "Jimena", "Raul", "Veronica",
  "Emilio", "Marta", "Gonzalo", "Alicia", "Tomas", "Laura", "Cristian",
  "Sara", "Esteban", "Monica", "Dario", "Roxana", "Bruno", "Nadia",
  "John", "Mark", "Paul", "James", "Ryan", "Kevin", "Brian", "Eric",
  "Anna", "Grace", "Joy", "Faith", "Hope", "Jane", "Rose", "May",
  "Chen", "Wei", "Li", "Zhang", "Wang", "Liu", "Huang", "Yang",
  "Park", "Kim", "Lee", "Choi", "Jung", "Kang", "Yoon", "Song",
  "Nguyen", "Tran", "Le", "Pham", "Hoang", "Huynh", "Vo", "Dang",
  "Arun", "Priya", "Raj", "Anil", "Sunita", "Vikram", "Deepa", "Sanjay",
  "Lakshmi", "Ravi", "Meera", "Suresh", "Kavitha", "Amit", "Neha",
];

const LAST_NAMES = [
  "Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Ramos",
  "Flores", "Gonzales", "Villanueva", "Dela Cruz", "Lim", "Tan", "Chua", "Ong",
  "Wong", "Lee", "Kim", "Park", "Nguyen", "Tran", "Pham", "Le",
  "Santillan", "Pascual", "Aquino", "Macapagal", "Roxas", "Laurel", "Magsaysay",
  "Gonzalez", "Martinez", "Rodriguez", "Lopez", "Hernandez", "Diaz", "Morales",
  "Jimenez", "Ruiz", "Alvarez", "Romero", "Munoz", "Gutierrez", "Ortiz",
  "Navarro", "Herrera", "Medina", "Castro", "Aguilar", "Vargas", "Rangel",
  "Patel", "Sharma", "Gupta", "Singh", "Kumar", "Verma", "Reddy", "Chopra",
  "Wang", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao", "Wu",
];

const EMAIL_DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "proton.me", "icloud.com", "mail.com",
  "affiliate.ph", "marketing.asia", "biz.sea",
];

const REFERRERS = [
  "https://google.com", "https://facebook.com", "https://youtube.com",
  "https://twitter.com", "https://instagram.com", "https://tiktok.com",
  "https://linkedin.com", "https://reddit.com", "https://pinterest.com",
  "https://podcasts.apple.com",
  undefined, undefined, // ~15% direct traffic
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
];

const PAYOUT_METHODS = [
  { type: "gcash", details: (rng: () => number) => `0917${Math.floor(1000000 + rng() * 9000000)}` },
  { type: "bank_transfer", details: (rng: () => number) => `BPI ${Math.floor(1000000000 + rng() * 9000000000)}` },
  { type: "maya", details: (rng: () => number) => `0928${Math.floor(1000000 + rng() * 9000000)}` },
  { type: "paypal", details: (_rng: () => number, email: string) => `${email.replace("@", "+aff@")}` },
  { type: "unionbank", details: (rng: () => number) => `UBP ${Math.floor(1000000000 + rng() * 9000000000)}` },
];

/** Pre-computed password hash for "TestPass123!" using Better Auth's scrypt. */
const TEST_PASSWORD_HASH = "b1fb84d0f1c6feb781d661faecc3eeb6:4840a3170ce388473977f0fef10160e603fc9d95a74f55b2bfbf7626d0879e545a1fe515d12b36f0230bce85f6d4f6de3cf8f98f9a1daca3deeefd06e76a2000";

// =============================================================================
// Date Range Constants — Dec 1, 2025 → Mar 28, 2026
// =============================================================================
const DATE_RANGE_START = new Date(2025, 11, 1).getTime();   // Dec 1, 2025 00:00 UTC
const DATE_RANGE_END = new Date(2026, 2, 28, 23, 59, 59).getTime(); // Mar 28, 2026 23:59 UTC
const DAYS_AGO_MAX = Math.ceil((Date.now() - DATE_RANGE_START) / (24 * 60 * 60 * 1000)); // ~117 days

// =============================================================================
// Pseudo-random Generator (Seeded for Determinism)
// =============================================================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateReferralCode(rng: () => number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(rng() * chars.length));
  }
  return code;
}

function generateAffiliateEmail(index: number, rng: () => number): string {
  const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)].toLowerCase();
  const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)].toLowerCase();
  const domain = EMAIL_DOMAINS[Math.floor(rng() * EMAIL_DOMAINS.length)];
  const suffix = index % 200;
  return `${firstName}.${lastName}${suffix}@${domain}`;
}

function generateAffiliateName(rng: () => number): string {
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

/** Generate timestamp within the Dec 2025 → Mar 2026 range, optionally narrowed. */
function randomTimestamp(rng: () => number, daysAgoMin: number = 0, daysAgoMax: number = DAYS_AGO_MAX): number {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const offset = msPerDay * (daysAgoMin + rng() * (daysAgoMax - daysAgoMin));
  const ts = Math.floor(now - offset);
  // Clamp to the Dec 2025 → Mar 2026 range
  return Math.max(DATE_RANGE_START, Math.min(DATE_RANGE_END, ts));
}

function generateIPAddress(rng: () => number): string {
  const ranges = [
    () => `192.168.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
    () => `10.0.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
    () => `${103 + Math.floor(rng() * 50)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
    () => `${175 + Math.floor(rng() * 30)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
  ];
  return ranges[Math.floor(rng() * ranges.length)]();
}

function generateUserAgent(rng: () => number): string {
  return USER_AGENTS[Math.floor(rng() * USER_AGENTS.length)];
}

function generateOrderId(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

function generateTransactionId(): string {
  return `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

function generatePaymentReference(): string {
  return `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

function generateEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
}

function pickRandom<T>(arr: readonly T[] | T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeightedIndex(weights: number[], rng: () => number): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/** Generate a session token for affiliate login. */
function generateSessionToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
}

// =============================================================================
// Main Seed Function
// =============================================================================

export const seedTechFlow = internalMutation({
  args: {
    tenantSlug: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    dryRun: v.boolean(),
    tenantId: v.string(),
    tenantName: v.string(),
    stats: v.object({
      // Core tables
      affiliatesCreated: v.number(),
      referralLinksCreated: v.number(),
      affiliateCampaignsCreated: v.number(),
      affiliateSessionsCreated: v.number(),
      clicksCreated: v.number(),
      conversionsCreated: v.number(),
      commissionsCreated: v.number(),
      payoutBatchesCreated: v.number(),
      payoutsCreated: v.number(),
      // Supporting tables
      auditLogsCreated: v.number(),
      emailsCreated: v.number(),
      broadcastEmailsCreated: v.number(),
      emailTemplatesCreated: v.number(),
      brandAssetsCreated: v.number(),
      billingHistoryCreated: v.number(),
      teamInvitationsCreated: v.number(),
      loginAttemptsCreated: v.number(),
      performanceMetricsCreated: v.number(),
      trackingPingsCreated: v.number(),
      rawWebhooksCreated: v.number(),
      // Additional campaigns
      additionalCampaignsCreated: v.number(),
    }),
    breakdown: v.object({
      affiliatesByStatus: v.object({
        active: v.number(),
        pending: v.number(),
        suspended: v.number(),
        rejected: v.number(),
      }),
      commissionsByStatus: v.object({
        pending: v.number(),
        approved: v.number(),
        paid: v.number(),
        declined: v.number(),
        reversed: v.number(),
      }),
      payoutsByStatus: v.object({
        completed: v.number(),
        pending: v.number(),
        processing: v.number(),
      }),
      conversionsByAttribution: v.object({
        cookie: v.number(),
        webhook: v.number(),
        organic: v.number(),
        body: v.number(),
      }),
      commissionsWithFraudSignals: v.number(),
      selfReferralCommissions: v.number(),
      organicConversions: v.number(),
    }),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const isDryRun = args.dryRun ?? false;
    const errors: string[] = [];

    // =========================================================================
    // PHASE 0: Setup — Find tenant, campaigns, existing data
    // =========================================================================
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      throw new Error(`Tenant "${args.tenantSlug}" not found. Check the slug.`);
    }

    const tenantId = tenant._id;

    const existingCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    if (existingCampaigns.length === 0) {
      throw new Error(`No campaigns for "${args.tenantSlug}". Create campaigns first.`);
    }

    const existingAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(5000);

    const existingCodes = new Set(existingAffiliates.map(a => a.uniqueCode));
    const existingEmails = new Set(existingAffiliates.map(a => a.email));

    // Get existing users for audit log actor references
    const existingUsers = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    const ownerUser = existingUsers.find(u => u.role === "owner");
    const adminUsers = existingUsers.filter(u => u.role === "admin" || u.role === "owner");

    // Initialize RNG and counters
    const rng = seededRandom(42 + args.tenantSlug.length); // Deterministic seed
    const stats = {
      affiliatesCreated: 0, referralLinksCreated: 0, affiliateCampaignsCreated: 0,
      affiliateSessionsCreated: 0, clicksCreated: 0, conversionsCreated: 0,
      commissionsCreated: 0, payoutBatchesCreated: 0, payoutsCreated: 0,
      auditLogsCreated: 0, emailsCreated: 0, broadcastEmailsCreated: 0,
      emailTemplatesCreated: 0, brandAssetsCreated: 0, billingHistoryCreated: 0,
      teamInvitationsCreated: 0, loginAttemptsCreated: 0,
      performanceMetricsCreated: 0, trackingPingsCreated: 0,
      rawWebhooksCreated: 0, additionalCampaignsCreated: 0,
    };

    const breakdown = {
      affiliatesByStatus: { active: 0, pending: 0, suspended: 0, rejected: 0 },
      commissionsByStatus: { pending: 0, approved: 0, paid: 0, declined: 0, reversed: 0 },
      payoutsByStatus: { completed: 0, pending: 0, processing: 0 },
      conversionsByAttribution: { cookie: 0, webhook: 0, organic: 0, body: 0 },
      commissionsWithFraudSignals: 0,
      selfReferralCommissions: 0,
      organicConversions: 0,
    };

    // Track IDs for relationship wiring
    const allAffiliateIds: Id<"affiliates">[] = [];
    const activeAffiliateIds: Id<"affiliates">[] = [];
    const pendingAffiliateIds: Id<"affiliates">[] = [];
    const suspendedAffiliateIds: Id<"affiliates">[] = [];
    const affiliateReferralLinks = new Map<string, Id<"referralLinks">[]>();
    const allCampaignIds = [...existingCampaigns.map(c => c._id)];

    // =========================================================================
    // PHASE 0.5: Add additional campaigns for scenario coverage
    // =========================================================================
    // Existing campaigns are all "active". Add paused and archived for UI testing.
    const additionalCampaigns = [
      {
        name: "Holiday Promo 2025",
        slug: "holiday-promo-2025",
        description: "Special holiday season referral bonus — ran Dec 2025",
        commissionType: "percentage" as const,
        commissionValue: 25,
        recurringCommission: false,
        recurringRate: undefined,
        recurringRateType: undefined,
        cookieDuration: 14,
        autoApproveCommissions: true,
        approvalThreshold: 500,
        status: "expired",
      },
      {
        name: "Beta Tester Program",
        slug: "beta-tester-program",
        description: "Exclusive referral program for beta testers",
        commissionType: "fixed" as const,
        commissionValue: 50,
        recurringCommission: true,
        recurringRate: 10,
        recurringRateType: "percentage",
        cookieDuration: 60,
        autoApproveCommissions: true,
        approvalThreshold: undefined,
        status: "paused",
      },
    ];

    if (!isDryRun) {
      for (const camp of additionalCampaigns) {
        const cId = await ctx.db.insert("campaigns", {
          tenantId,
          name: camp.name,
          slug: camp.slug,
          description: camp.description,
          commissionType: camp.commissionType,
          commissionValue: camp.commissionValue,
          recurringCommission: camp.recurringCommission,
          recurringRate: camp.recurringRate,
          recurringRateType: camp.recurringRateType,
          cookieDuration: camp.cookieDuration,
          autoApproveCommissions: camp.autoApproveCommissions,
          approvalThreshold: camp.approvalThreshold,
          status: camp.status,
        });
        allCampaignIds.push(cId);
        stats.additionalCampaignsCreated++;
      }
    } else {
      stats.additionalCampaignsCreated = additionalCampaigns.length;
    }

    // =========================================================================
    // PHASE 1: Generate AFFILIATES (750 total)
    // =========================================================================
    // Distribution: 550 active, 100 pending, 50 suspended, 50 rejected
    const AFFILIATE_COUNT = 750;

    for (let i = 0; i < AFFILIATE_COUNT; i++) {
      let email = generateAffiliateEmail(existingAffiliates.length + i, rng);
      let attempts = 0;
      while (existingEmails.has(email) && attempts < 30) {
        email = generateAffiliateEmail(existingAffiliates.length + i + attempts + 1, rng);
        attempts++;
      }
      existingEmails.add(email);

      const name = generateAffiliateName(rng);
      const status = pickRandom(AFFILIATE_STATUSES, rng);
      const promotionChannel = pickRandom(PROMOTION_CHANNELS, rng);
      const enrolledAt = randomTimestamp(rng, 1, DAYS_AGO_MAX); // Within Dec 2025 → Mar 2026

      let uniqueCode = generateReferralCode(rng);
      let codeAttempts = 0;
      while (existingCodes.has(uniqueCode) && codeAttempts < 30) {
        uniqueCode = generateReferralCode(rng);
        codeAttempts++;
      }
      existingCodes.add(uniqueCode);

      // Build optional fields based on status
      let payoutMethod: { type: string; details: string } | undefined;
      if (status === "active" && rng() > 0.15) {
        const pm = pickRandom(PAYOUT_METHODS, rng);
        const details = typeof pm.details === "function"
          ? pm.details(rng, email)
          : pm.details;
        payoutMethod = { type: pm.type, details: details as string };
      }

      let fraudSignals: Array<{
        type: string;
        severity: string;
        timestamp: number;
        details?: string;
        reviewedAt?: number;
        reviewedBy?: string;
        reviewNote?: string;
        commissionId?: Id<"commissions">;
        signalId?: string;
      }> | undefined;
      let vanitySlug: string | undefined;
      let commissionOverrides: Array<{ campaignId: Id<"campaigns">; rate: number; status: "active" | "paused" }> | undefined;

      if (status === "suspended") {
        // 70% of suspended have fraud signals
        if (rng() > 0.3) {
          const signals = [];
          const signalCount = 1 + Math.floor(rng() * 3);
          for (let s = 0; s < signalCount; s++) {
            signals.push({
              type: pickRandom(FRAUD_INDICATORS, rng),
              severity: pickRandom(["low", "medium", "high"] as const, rng),
              timestamp: randomTimestamp(rng, 5, Math.min(60, DAYS_AGO_MAX)),
              details: "Auto-detected during test data generation",
              signalId: `sig_seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            });
          }
          fraudSignals = signals as any;
        }
      }

      // 20% of active affiliates have a vanity slug
      if (status === "active" && rng() > 0.8) {
        vanitySlug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      }

      // 10% of active affiliates have commission overrides
      if (status === "active" && rng() > 0.9 && allCampaignIds.length > 0) {
        const overrideCampaign = pickRandom(allCampaignIds, rng);
        commissionOverrides = [{
          campaignId: overrideCampaign,
          rate: Math.round((10 + rng() * 30) * 100) / 100,
          status: "active" as const,
        }];
      }

      if (!isDryRun) {
        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email,
          name,
          uniqueCode,
          status,
          passwordHash: TEST_PASSWORD_HASH,
          promotionChannel,
          payoutMethod,
          fraudSignals: fraudSignals as any,
          vanitySlug,
          commissionOverrides,
          payoutMethodLastDigits: payoutMethod ? payoutMethod.details.slice(-4) : undefined,
        });

        allAffiliateIds.push(affiliateId);

        if (status === "active") {
          activeAffiliateIds.push(affiliateId);
          affiliateReferralLinks.set(affiliateId.toString(), []);
        } else if (status === "pending") {
          pendingAffiliateIds.push(affiliateId);
        } else if (status === "suspended") {
          suspendedAffiliateIds.push(affiliateId);
        }

        // Create referral links and affiliateCampaigns for active affiliates
        if (status === "active") {
          const enrolledCampaigns: Id<"campaigns">[] = [];

          // Each active affiliate is enrolled in 1-3 campaigns
          const numCampaigns = 1 + Math.floor(rng() * Math.min(3, allCampaignIds.length));
          const shuffled = [...allCampaignIds].sort(() => rng() - 0.5);
          for (let c = 0; c < numCampaigns; c++) {
            const campaignId = shuffled[c];
            enrolledCampaigns.push(campaignId);

            // Create referral link for this campaign
            const linkCode = numCampaigns === 1
              ? uniqueCode
              : `${uniqueCode}-${c + 1}`;
            const referralLinkId = await ctx.db.insert("referralLinks", {
              tenantId,
              affiliateId,
              campaignId,
              code: linkCode,
            });
            stats.referralLinksCreated++;
            const links = affiliateReferralLinks.get(affiliateId.toString()) ?? [];
            links.push(referralLinkId);
            affiliateReferralLinks.set(affiliateId.toString(), links);

            // Create affiliateCampaign enrollment
            const enrollmentStatus = rng() > 0.9
              ? (rng() > 0.5 ? "paused" : "removed")
              : "active";
            const enrolledVia = rng() > 0.6 ? "signup" : "invite";
            await ctx.db.insert("affiliateCampaigns", {
              tenantId,
              affiliateId,
              campaignId,
              status: enrollmentStatus,
              enrolledAt,
              enrolledVia,
            });
            stats.affiliateCampaignsCreated++;
          }
        }

        // Create affiliateCampaigns for some pending affiliates (they applied to specific campaigns)
        if (status === "pending" && rng() > 0.4) {
          const campaignId = pickRandom(allCampaignIds, rng);
          await ctx.db.insert("affiliateCampaigns", {
            tenantId,
            affiliateId,
            campaignId,
            status: "active", // Pending but enrolled
            enrolledAt,
            enrolledVia: "signup",
          });
          stats.affiliateCampaignsCreated++;
        }
      }

      stats.affiliatesCreated++;
      breakdown.affiliatesByStatus[status as keyof typeof breakdown.affiliatesByStatus]++;
    }

    // =========================================================================
    // PHASE 2: Generate AFFILIATE SESSIONS (150)
    // =========================================================================
    const SESSION_COUNT = 150;

    if (!isDryRun) {
      for (let i = 0; i < SESSION_COUNT; i++) {
        const affiliateId = pickRandom(activeAffiliateIds, rng);
        const now = Date.now();
        const createdAt = randomTimestamp(rng, 1, Math.min(90, DAYS_AGO_MAX));
        const expiresAt = createdAt + (7 * 24 * 60 * 60 * 1000); // 7-day sessions

        await ctx.db.insert("affiliateSessions", {
          affiliateId,
          tenantId,
          token: generateSessionToken(),
          expiresAt,
          createdAt,
          userAgent: generateUserAgent(rng),
          ipAddress: generateIPAddress(rng),
        });
        stats.affiliateSessionsCreated++;
      }
    }

    // =========================================================================
    // PHASE 3: Generate CLICKS (800+)
    // =========================================================================
    const CLICK_COUNT = 800;

    if (!isDryRun) {
      for (let i = 0; i < CLICK_COUNT; i++) {
        if (activeAffiliateIds.length === 0) break;

        const affiliateId = pickRandom(activeAffiliateIds, rng);
        const links = affiliateReferralLinks.get(affiliateId.toString());
        if (!links || links.length === 0) continue;

        const referralLinkId = pickRandom(links, rng);
        const clickTimestamp = randomTimestamp(rng, 1, DAYS_AGO_MAX);
        const ipAddress = generateIPAddress(rng);
        const dedupeKey = `${referralLinkId}-${ipAddress}-${Math.floor(clickTimestamp / 60000)}`; // 1-min dedupe

        // Get campaign from referral link
        const refLink = await ctx.db.get(referralLinkId);
        const campaignId = refLink?.campaignId;

        await ctx.db.insert("clicks", {
          tenantId,
          referralLinkId,
          affiliateId,
          campaignId,
          ipAddress,
          userAgent: generateUserAgent(rng),
          referrer: pickRandom(REFERRERS, rng),
          dedupeKey,
        });
        stats.clicksCreated++;
      }
    }

    // =========================================================================
    // PHASE 4: Generate CONVERSIONS (750+)
    // =========================================================================
    const CONVERSION_COUNT = 750;
    const conversionIds: Id<"conversions">[] = [];
    // Track which affiliate got which conversion (for commission wiring)
    const conversionAffiliateMap: Array<{ conversionId: Id<"conversions">; affiliateId: Id<"affiliates">; campaignId: Id<"campaigns">; amount: number; timestamp: number; isOrganic: boolean; isSelfReferral: boolean }> = [];

    if (!isDryRun) {
      for (let i = 0; i < CONVERSION_COUNT; i++) {
        // 10% organic conversions (no affiliate)
        const isOrganic = rng() < 0.10;
        const isSelfReferral = !isOrganic && rng() < 0.03;

        const affiliateId = isOrganic
          ? undefined
          : pickRandom(activeAffiliateIds, rng);

        const links = affiliateId
          ? affiliateReferralLinks.get(affiliateId.toString())
          : undefined;
        const referralLinkId = links && links.length > 0 ? pickRandom(links, rng) : undefined;

        const campaignId = pickRandom(allCampaignIds, rng);
        const saleAmount = Math.round((29 + rng() * 497) * 100) / 100; // $29 - $526
        const attributionSource = isOrganic
          ? "organic"
          : pickRandom(["cookie", "cookie", "cookie", "webhook", "webhook", "body"] as const, rng);
        const conversionTimestamp = randomTimestamp(rng, 1, DAYS_AGO_MAX);

        const conversionId = await ctx.db.insert("conversions", {
          tenantId,
          affiliateId,
          referralLinkId,
          campaignId,
          customerEmail: isOrganic
            ? `direct.customer${i + 1}@example.com`
            : `customer${i + 1}-${Math.floor(rng() * 9999)}@example.com`,
          amount: saleAmount,
          status: "completed",
          ipAddress: generateIPAddress(rng),
          deviceFingerprint: rng() > 0.5 ? `fp_${Math.random().toString(36).slice(2, 14)}` : undefined,
          paymentMethodLastDigits: rng() > 0.5 ? `****${Math.floor(1000 + rng() * 9000)}` : undefined,
          attributionSource,
          isSelfReferral: isSelfReferral || undefined,
          metadata: {
            orderId: generateOrderId(),
            planId: `plan-${campaignId.slice(-4)}`,
            subscriptionId: rng() > 0.7 ? `sub_${generateTransactionId().slice(4)}` : undefined,
            subscriptionStatus: rng() > 0.7 ? "active" : undefined,
          },
        });
        conversionIds.push(conversionId);

        if (affiliateId) {
          conversionAffiliateMap.push({
            conversionId,
            affiliateId,
            campaignId,
            amount: saleAmount,
            timestamp: conversionTimestamp,
            isOrganic: false,
            isSelfReferral: !!isSelfReferral,
          });
        }

        stats.conversionsCreated++;

        // Track attribution breakdown
        if (attributionSource === "cookie") breakdown.conversionsByAttribution.cookie++;
        else if (attributionSource === "webhook") breakdown.conversionsByAttribution.webhook++;
        else if (attributionSource === "organic") breakdown.conversionsByAttribution.organic++;
        else breakdown.conversionsByAttribution.body++;

        if (isOrganic) breakdown.organicConversions++;
        if (isSelfReferral) breakdown.selfReferralCommissions++;
      }
    }

    // =========================================================================
    // PHASE 5: Generate COMMISSIONS (750+)
    // =========================================================================
    const COMMISSION_COUNT = 750;
    const paidCommissionsByAffiliate = new Map<Id<"affiliates">, { ids: Id<"commissions">[]; total: number }>();
    const approvedCommissionsByAffiliate = new Map<Id<"affiliates">, { ids: Id<"commissions">[]; total: number }>();

    if (!isDryRun) {
      for (let i = 0; i < COMMISSION_COUNT; i++) {
        if (activeAffiliateIds.length === 0) break;

        const affiliateId = pickRandom(activeAffiliateIds, rng);
        const campaignId = pickRandom(allCampaignIds, rng);
        const campaign = await ctx.db.get(campaignId);

        // Calculate commission amount based on campaign type
        let commissionAmount: number;
        if (campaign?.commissionType === "percentage") {
          const saleAmount = Math.round((29 + rng() * 497) * 100) / 100;
          commissionAmount = Math.round((saleAmount * (campaign.commissionValue || 20) / 100) * 100) / 100;
        } else {
          commissionAmount = campaign?.commissionValue || 50;
        }

        const status = pickRandom(COMMISSION_STATUSES, rng);

        // Fraud scenario: ~5% have fraud indicators
        const hasFraudIndicators = rng() < 0.05;
        const isSelfReferral = rng() < 0.03;

        const fraudIndicators = hasFraudIndicators
          ? Array.from({ length: 1 + Math.floor(rng() * 2) }, () => pickRandom(FRAUD_INDICATORS, rng))
          : undefined;

        // Link to a conversion if available and the affiliate matches
        const matchingConversions = conversionAffiliateMap.filter(c => c.affiliateId === affiliateId);
        const conversion = matchingConversions.length > 0
          ? pickRandom(matchingConversions, rng)
          : null;

        const timestamp = randomTimestamp(rng, 1, DAYS_AGO_MAX);

        const commissionId = await ctx.db.insert("commissions", {
          tenantId,
          affiliateId,
          campaignId,
          conversionId: conversion?.conversionId,
          amount: Math.max(0.01, commissionAmount), // Ensure positive amount
          status,
          isSelfReferral: isSelfReferral || undefined,
          fraudIndicators,
          transactionId: generateTransactionId(),
          eventMetadata: {
            source: pickRandom(["webhook", "api", "manual"] as const, rng),
            transactionId: generateTransactionId(),
            timestamp,
            subscriptionId: rng() > 0.6 ? `sub_${generateTransactionId().slice(4)}` : undefined,
          },
          reversalReason: status === "reversed" ? pickRandom(REVERSAL_REASONS, rng) : undefined,
        });

        if (status === "paid") {
          const entry = paidCommissionsByAffiliate.get(affiliateId) ?? { ids: [], total: 0 };
          entry.ids.push(commissionId);
          entry.total += commissionAmount;
          paidCommissionsByAffiliate.set(affiliateId, entry);
        }
        if (status === "approved") {
          const entry = approvedCommissionsByAffiliate.get(affiliateId) ?? { ids: [], total: 0 };
          entry.ids.push(commissionId);
          entry.total += commissionAmount;
          approvedCommissionsByAffiliate.set(affiliateId, entry);
        }

        stats.commissionsCreated++;
        breakdown.commissionsByStatus[status as keyof typeof breakdown.commissionsByStatus]++;
        if (hasFraudIndicators) breakdown.commissionsWithFraudSignals++;
        if (isSelfReferral) breakdown.selfReferralCommissions++;
      }
    }

    // =========================================================================
    // PHASE 6: Generate PAYOUT BATCHES and PAYOUTS (700+ payouts)
    // =========================================================================
    const PAYOUT_TARGET = 700;

    if (!isDryRun && paidCommissionsByAffiliate.size > 0) {
      const paidAffiliateGroups = Array.from(paidCommissionsByAffiliate.entries());
      // Shuffle for randomization
      for (let i = paidAffiliateGroups.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [paidAffiliateGroups[i], paidAffiliateGroups[j]] = [paidAffiliateGroups[j], paidAffiliateGroups[i]];
      }

      // Create ~5 monthly completed batches + 1 pending batch + 1 processing batch
      const batchesToCreate = 8;
      let payoutsCreated = 0;
      let groupIdx = 0;

      // --- Completed batches (monthly cadence over 5 months) ---
      for (let b = 0; b < batchesToCreate && payoutsCreated < PAYOUT_TARGET && groupIdx < paidAffiliateGroups.length; b++) {
        const generatedAt = randomTimestamp(rng, 7, Math.min(140, DAYS_AGO_MAX));
        const batchStatus = b < 6 ? "completed" : (b === 6 ? "pending" : "processing");

        const payoutsPerBatch = Math.max(1, Math.floor((PAYOUT_TARGET - payoutsCreated) / (batchesToCreate - b)));
        const batchPayoutCount = Math.min(
          payoutsPerBatch,
          PAYOUT_TARGET - payoutsCreated,
          paidAffiliateGroups.length - groupIdx,
        );
        if (batchPayoutCount <= 0) break;

        let batchTotal = 0;
        const batchEntries: Array<{ affiliateId: Id<"affiliates">; amount: number; commissionIds: Id<"commissions">[] }> = [];

        for (let p = 0; p < batchPayoutCount && groupIdx < paidAffiliateGroups.length; p++, groupIdx++) {
          const [affiliateId, group] = paidAffiliateGroups[groupIdx];
          const amt = Math.round(group.total * 100) / 100;
          batchTotal += amt;
          batchEntries.push({ affiliateId, amount: amt, commissionIds: group.ids });
        }

        const batchId = await ctx.db.insert("payoutBatches", {
          tenantId,
          totalAmount: Math.round(batchTotal * 100) / 100,
          affiliateCount: batchEntries.length,
          status: batchStatus,
          generatedAt,
          completedAt: batchStatus === "completed" ? generatedAt + (2 * 86400000) : undefined,
          manualCount: Math.floor(rng() * batchEntries.length),
          saligPayCount: batchEntries.length - Math.floor(rng() * batchEntries.length),
        });
        stats.payoutBatchesCreated++;

        for (const entry of batchEntries) {
          const payoutStatus = batchStatus === "completed"
            ? (rng() > 0.08 ? "completed" : "pending") // 8% stuck in pending
            : batchStatus;

          await ctx.db.insert("payouts", {
            tenantId,
            affiliateId: entry.affiliateId,
            batchId,
            amount: entry.amount,
            status: payoutStatus,
            paymentReference: payoutStatus === "completed" ? generatePaymentReference() : undefined,
            paidAt: payoutStatus === "completed" ? generatedAt + 86400000 : undefined,
            paymentSource: rng() > 0.4 ? "saligpay" : "manual",
          });
          payoutsCreated++;

          // Link commissions to this batch
          for (const cId of entry.commissionIds) {
            await ctx.db.patch(cId, { batchId });
          }

          if (payoutStatus === "completed") breakdown.payoutsByStatus.completed++;
          else if (payoutStatus === "pending") breakdown.payoutsByStatus.pending++;
          else breakdown.payoutsByStatus.processing++;
        }
      }

      // --- Pending batch from approved commissions ---
      if (approvedCommissionsByAffiliate.size > 0 && payoutsCreated < PAYOUT_TARGET) {
        const approvedGroups = Array.from(approvedCommissionsByAffiliate.entries());
        for (let i = approvedGroups.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [approvedGroups[i], approvedGroups[j]] = [approvedGroups[j], approvedGroups[i]];
        }

        const pendingBatchGeneratedAt = randomTimestamp(rng, 0, 3);
        const pendingPayoutCount = Math.min(
          Math.floor((PAYOUT_TARGET - payoutsCreated) * 0.5),
          approvedGroups.length,
          80,
        );

        let pendingBatchTotal = 0;
        const pendingEntries: Array<{ affiliateId: Id<"affiliates">; amount: number; commissionIds: Id<"commissions">[] }> = [];

        for (let p = 0; p < pendingPayoutCount; p++) {
          const [affiliateId, group] = approvedGroups[p];
          const amt = Math.round(group.total * 100) / 100;
          pendingBatchTotal += amt;
          pendingEntries.push({ affiliateId, amount: amt, commissionIds: group.ids });
        }

        const pendingBatchId = await ctx.db.insert("payoutBatches", {
          tenantId,
          totalAmount: Math.round(pendingBatchTotal * 100) / 100,
          affiliateCount: pendingEntries.length,
          status: "pending",
          generatedAt: pendingBatchGeneratedAt,
        });
        stats.payoutBatchesCreated++;

        for (const entry of pendingEntries) {
          await ctx.db.insert("payouts", {
            tenantId,
            affiliateId: entry.affiliateId,
            batchId: pendingBatchId,
            amount: entry.amount,
            status: "pending",
          });
          payoutsCreated++;
          breakdown.payoutsByStatus.pending++;

          for (const cId of entry.commissionIds) {
            await ctx.db.patch(cId, { batchId: pendingBatchId });
          }
        }
      }

      stats.payoutsCreated = payoutsCreated;
    }

    // =========================================================================
    // PHASE 7: Generate AUDIT LOGS (300+)
    // =========================================================================
    const AUDIT_LOG_COUNT = 300;

    if (!isDryRun) {
      for (let i = 0; i < AUDIT_LOG_COUNT; i++) {
        const action = pickRandom(AUDIT_ACTIONS, rng);
        const timestamp = randomTimestamp(rng, 1, DAYS_AGO_MAX);
        const actorId = adminUsers.length > 0
          ? pickRandom(adminUsers, rng)._id
          : undefined;

        let entityType: string;
        let entityId: string;
        let metadata: any;

        if (action.startsWith("affiliate_")) {
          entityType = "affiliate";
          entityId = allAffiliateIds.length > 0
            ? pickRandom(allAffiliateIds, rng)
            : `mock-${i}`;
          metadata = action === "affiliate_approved"
            ? { newStatus: "active" }
            : action === "affiliate_suspended"
            ? { newStatus: "suspended", reason: "fraud_detected" }
            : action === "affiliate_rejected"
            ? { newStatus: "rejected", reason: "invalid_information" }
            : undefined;
        } else if (action.startsWith("commission_")) {
          entityType = "commission";
          entityId = `mock-commission-${i}`;
          metadata = action === "commission_approved"
            ? { amount: Math.round((10 + rng() * 200) * 100) / 100 }
            : action === "commission_declined"
            ? { reason: "invalid_conversion" }
            : action === "commission_reversed"
            ? { reason: "chargeback" }
            : undefined;
        } else if (action.startsWith("payout_")) {
          entityType = "payoutBatch";
          entityId = `mock-batch-${i}`;
          metadata = { totalAmount: Math.round((500 + rng() * 5000) * 100) / 100 };
        } else if (action.startsWith("campaign_")) {
          entityType = "campaign";
          entityId = allCampaignIds.length > 0
            ? pickRandom(allCampaignIds, rng)
            : `mock-campaign-${i}`;
          metadata = action === "campaign_updated"
            ? { field: "commissionValue", oldValue: 20, newValue: 25 }
            : undefined;
        } else if (action.startsWith("user_")) {
          entityType = "user";
          entityId = existingUsers.length > 0
            ? pickRandom(existingUsers, rng)._id
            : `mock-user-${i}`;
          metadata = action === "user_role_changed"
            ? { newRole: "admin" }
            : undefined;
        } else {
          entityType = action.split("_")[0];
          entityId = `mock-${i}`;
        }

        await ctx.db.insert("auditLogs", {
          tenantId,
          action,
          entityType,
          entityId,
          actorId,
          actorType: actorId ? "user" : "system",
          previousValue: undefined,
          newValue: metadata,
          metadata: { timestamp },
          affiliateId: action.startsWith("affiliate_") && allAffiliateIds.length > 0
            ? pickRandom(allAffiliateIds, rng)
            : undefined,
        });
        stats.auditLogsCreated++;
      }
    }

    // =========================================================================
    // PHASE 8: Generate EMAILS (400+)
    // =========================================================================
    const EMAIL_COUNT = 400;

    if (!isDryRun) {
      for (let i = 0; i < EMAIL_COUNT; i++) {
        const emailType = pickRandom(EMAIL_TYPES, rng);
        const timestamp = randomTimestamp(rng, 1, DAYS_AGO_MAX);
        const deliveryStatus = pickRandom(EMAIL_DELIVERY_STATUSES, rng);

        // Pick affiliate as recipient for affiliate-related emails
        const affiliateId = activeAffiliateIds.length > 0
          ? pickRandom(activeAffiliateIds, rng)
          : undefined;

        const recipientEmail = affiliateId
          ? `affiliate-${i + 1}@example.com`
          : `user-${i + 1}@example.com`;

        const subject = emailType === "affiliate_welcome"
          ? "Welcome to our Affiliate Program!"
          : emailType === "commission_confirmed"
          ? "Your Commission Has Been Confirmed"
          : emailType === "payout_sent"
          ? "Your Payout Has Been Sent"
          : emailType === "affiliate_approved"
          ? "Great News — You're Approved!"
          : emailType === "affiliate_rejected"
          ? "Application Update"
          : emailType === "campaign_invite"
          ? "You're Invited to a New Campaign"
          : emailType === "commission_declined"
          ? "Commission Update"
          : "Payout Processing Issue";

        // Compute status-dependent timestamps
        let sentAt = timestamp;
        let deliveredAt: number | undefined;
        let openedAt: number | undefined;
        let clickedAt: number | undefined;
        let bounceReason: string | undefined;
        let complaintReason: string | undefined;

        if (deliveryStatus === "delivered") deliveredAt = sentAt + 5000;
        if (deliveryStatus === "opened") {
          deliveredAt = sentAt + 5000;
          openedAt = deliveredAt + 60000 + Math.floor(rng() * 300000);
        }
        if (deliveryStatus === "clicked") {
          deliveredAt = sentAt + 5000;
          openedAt = deliveredAt + 60000;
          clickedAt = openedAt + 30000;
        }
        if (deliveryStatus === "bounced") {
          bounceReason = pickRandom(["mailbox_full", "does_not_exist", "blocked"] as const, rng);
        }
        if (deliveryStatus === "complained") {
          complaintReason = "spam_complaint";
        }

        const emailStatus = deliveryStatus === "bounced" || deliveryStatus === "complained"
          ? "failed"
          : "sent";

        await ctx.db.insert("emails", {
          tenantId,
          type: emailType,
          recipientEmail,
          subject,
          status: emailStatus,
          sentAt,
          errorMessage: deliveryStatus === "bounced" ? `Bounced: ${bounceReason}` : undefined,
          affiliateId,
          deliveryStatus,
          deliveredAt,
          openedAt,
          clickedAt,
          bounceReason,
          complaintReason,
        });
        stats.emailsCreated++;
      }
    }

    // =========================================================================
    // PHASE 9: Generate BROADCAST EMAILS (5)
    // =========================================================================
    if (!isDryRun) {
      const broadcastData = [
        // Dec 2025 newsletter (~90-117 days ago)
        { subject: "December Affiliate Newsletter", status: "sent" as const, sentAt: randomTimestamp(rng, 90, DAYS_AGO_MAX) },
        // Jan 2026 (~59-89 days ago)
        { subject: "New Year Bonus Campaign Launch", status: "sent" as const, sentAt: randomTimestamp(rng, 59, 89) },
        // Jan 2026 (~30-58 days ago)
        { subject: "January Performance Update", status: "sent" as const, sentAt: randomTimestamp(rng, 30, 58) },
        // Feb 2026 (~10-29 days ago)
        { subject: "February Payout Reminder", status: "partial" as const, sentAt: randomTimestamp(rng, 10, 29) },
        // Mar 2026 (recent, 0-9 days ago)
        { subject: "March Program Updates", status: "pending" as const, sentAt: undefined },
      ];

      for (const bc of broadcastData) {
        const createdBy = adminUsers.length > 0 ? adminUsers[0]._id : existingUsers[0]?._id;
        if (!createdBy) continue;

        const broadcastId = await ctx.db.insert("broadcastEmails", {
          tenantId,
          subject: bc.subject,
          body: `<html><body><h1>${bc.subject}</h1><p>Dear affiliates, this is a broadcast message from TechFlow SaaS.</p></body></html>`,
          recipientCount: Math.floor(50 + rng() * 200),
          sentCount: bc.status === "sent" ? Math.floor(45 + rng() * 195) : bc.status === "partial" ? Math.floor(20 + rng() * 100) : 0,
          failedCount: bc.status === "sent" ? Math.floor(rng() * 5) : bc.status === "partial" ? Math.floor(rng() * 10) : 0,
          status: bc.status,
          createdBy,
          sentAt: bc.sentAt,
          openedCount: bc.status === "sent" ? Math.floor(20 + rng() * 100) : undefined,
          clickedCount: bc.status === "sent" ? Math.floor(5 + rng() * 30) : undefined,
          bounceCount: bc.status === "sent" ? Math.floor(rng() * 3) : undefined,
          complaintCount: 0,
        });
        stats.broadcastEmailsCreated++;

        // Link some emails to this broadcast
        if (activeAffiliateIds.length > 0) {
          const emailCount = Math.min(5, Math.floor(2 + rng() * 4));
          for (let e = 0; e < emailCount; e++) {
            await ctx.db.insert("emails", {
              tenantId,
              type: "broadcast",
              recipientEmail: `affiliate-bc-${broadcastId.slice(-4)}-${e + 1}@example.com`,
              subject: bc.subject,
              status: bc.status === "pending" ? "pending" : "sent",
              sentAt: bc.sentAt,
              broadcastId,
              affiliateId: pickRandom(activeAffiliateIds, rng),
              deliveryStatus: bc.status === "sent"
                ? pickRandom(["delivered", "opened", "clicked", "bounced"] as const, rng)
                : "queued",
            });
            stats.emailsCreated++;
          }
        }
      }
    }

    // =========================================================================
    // PHASE 10: Generate EMAIL TEMPLATES (6)
    // =========================================================================
    if (!isDryRun) {
      const templateTypes = [
        "commission_confirmed",
        "payout_sent",
        "affiliate_welcome",
        "affiliate_approved",
        "commission_declined",
        "payout_failed",
      ];

      const now = Date.now();
      for (const type of templateTypes) {
        await ctx.db.insert("emailTemplates", {
          tenantId,
          templateType: type,
          customSubject: `[TechFlow] ${type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`,
          customBody: `<html><body><h1>{{templateType}}</h1><p>Dear {{affiliateName}},</p><p>This is a custom email template for {{tenantName}}.</p></body></html>`,
          createdAt: now,
          updatedAt: now,
        });
        stats.emailTemplatesCreated++;
      }
    }

    // =========================================================================
    // PHASE 11: Generate BRAND ASSETS (15)
    // =========================================================================
    if (!isDryRun) {
      const assets = [
        { type: "logo" as const, title: "Primary Logo", category: "branding", isActive: true },
        { type: "logo" as const, title: "Dark Mode Logo", category: "branding", isActive: true },
        { type: "logo" as const, title: "Favicon", category: "branding", isActive: true },
        { type: "banner" as const, title: "Hero Banner - Dashboard", category: "marketing", isActive: true },
        { type: "banner" as const, title: "Holiday Promo Banner", category: "seasonal", isActive: true },
        { type: "banner" as const, title: "New Year Banner", category: "seasonal", isActive: true },
        { type: "banner" as const, title: "Archived Banner", category: "archived", isActive: false },
        { type: "product-image" as const, title: "Growth Plan Screenshot", category: "products", isActive: true },
        { type: "product-image" as const, title: "Pro Plan Screenshot", category: "products", isActive: true },
        { type: "product-image" as const, title: "Enterprise Plan Screenshot", category: "products", isActive: true },
        { type: "copy-text" as const, title: "Welcome Email Copy", category: "templates", isActive: true },
        { type: "copy-text" as const, title: "Social Media Post Template", category: "templates", isActive: true },
        { type: "copy-text" as const, title: "YouTube Description Template", category: "templates", isActive: true },
        { type: "copy-text" as const, title: "Blog Intro Template", category: "templates", isActive: true },
        { type: "copy-text" as const, title: "Old Promo Copy", category: "archived", isActive: false },
      ];

      for (let idx = 0; idx < assets.length; idx++) {
        const asset = assets[idx];
        await ctx.db.insert("brandAssets", {
          tenantId,
          type: asset.type,
          title: asset.title,
          description: `Auto-generated ${asset.type} for ${asset.category}`,
          textContent: asset.type === "copy-text"
            ? `Sample copy text for ${asset.title}. Visit https://techflow.test for more info.`
            : undefined,
          category: asset.category,
          isActive: asset.isActive,
          sortOrder: idx,
        });
        stats.brandAssetsCreated++;
      }
    }

    // =========================================================================
    // PHASE 12: Generate BILLING HISTORY (10)
    // =========================================================================
    if (!isDryRun) {
      const billingEvents = [
        { event: "trial_started", plan: "growth", amount: 0, daysAgo: 145 },
        { event: "trial_conversion", plan: "growth", amount: 2499, daysAgo: 135, newPlan: "growth" },
        { event: "renew", plan: "growth", amount: 2499, daysAgo: 105 },
        { event: "renew", plan: "growth", amount: 2499, daysAgo: 75 },
        { event: "plan_change", plan: "scale", amount: 4999, daysAgo: 50, previousPlan: "growth", newPlan: "scale", proratedAmount: 1250 },
        { event: "renew", plan: "scale", amount: 4999, daysAgo: 20 },
        { event: "payment_failed", plan: "scale", amount: 4999, daysAgo: 15 },
        { event: "payment_retry_success", plan: "scale", amount: 4999, daysAgo: 14 },
        { event: "renew", plan: "scale", amount: 4999, daysAgo: 5 },
        { event: "invoice_generated", plan: "scale", amount: 4999, daysAgo: 0 },
      ];

      for (const be of billingEvents) {
        await ctx.db.insert("billingHistory", {
          tenantId,
          event: be.event,
          plan: be.plan,
          amount: be.amount,
          timestamp: Date.now() - (be.daysAgo * 86400000),
          transactionId: `txn_techflow_${be.event}_${be.daysAgo}`,
          newPlan: (be as any).newPlan,
          previousPlan: (be as any).previousPlan,
          proratedAmount: (be as any).proratedAmount,
          mockTransaction: true,
          actorId: ownerUser?._id,
        });
        stats.billingHistoryCreated++;
      }
    }

    // =========================================================================
    // PHASE 13: Generate TEAM INVITATIONS (5)
    // =========================================================================
    if (!isDryRun) {
      const invitations = [
        { email: "new.member@techflow.test", role: "member", status: "accepted" },
        { email: "pending.invite@techflow.test", role: "member", status: "pending" },
        { email: "expired.invite@techflow.test", role: "admin", status: "expired" },
        { email: "another.member@techflow.test", role: "member", status: "pending" },
        { email: "declined.invite@techflow.test", role: "member", status: "declined" },
      ];

      for (const inv of invitations) {
        const expiresAt = Date.now() + (inv.status === "expired" ? -86400000 : 7 * 86400000);
        const acceptedAt = inv.status === "accepted" ? Date.now() - 3 * 86400000 : undefined;

        await ctx.db.insert("teamInvitations", {
          tenantId,
          email: inv.email,
          role: inv.role,
          token: `inv_${Math.random().toString(36).slice(2, 18)}`,
          expiresAt,
          acceptedAt,
        });
        stats.teamInvitationsCreated++;
      }
    }

    // =========================================================================
    // PHASE 14: Generate LOGIN ATTEMPTS (25)
    // =========================================================================
    if (!isDryRun) {
      for (let i = 0; i < 25; i++) {
        const isFailed = rng() > 0.4;
        const isLocked = isFailed && rng() > 0.7;

        await ctx.db.insert("loginAttempts", {
          email: isFailed
            ? `failed.login.${i + 1}@example.com`
            : `success.login.${i + 1}@example.com`,
          ipAddress: generateIPAddress(rng),
          failedAt: randomTimestamp(rng, 1, Math.min(60, DAYS_AGO_MAX)),
          lockedUntil: isLocked
            ? Date.now() + 15 * 60 * 1000 // 15 min lockout
            : undefined,
        });
        stats.loginAttemptsCreated++;
      }
    }

    // =========================================================================
    // PHASE 15: Generate PERFORMANCE METRICS (200)
    // =========================================================================
    if (!isDryRun) {
      const metricTypes = [
        "click_response_time",
        "conversion_response_time",
        "error_rate",
      ];

      for (let i = 0; i < 200; i++) {
        const metricType = pickRandom(metricTypes, rng);
        let value: number;
        let metadata: any;

        if (metricType === "click_response_time") {
          value = Math.round((20 + rng() * 500) * 100) / 100; // 20ms - 520ms
          metadata = {
            endpoint: "/track/click",
            statusCode: 200,
            responseTime: value,
          };
        } else if (metricType === "conversion_response_time") {
          value = Math.round((50 + rng() * 1000) * 100) / 100; // 50ms - 1050ms
          metadata = {
            endpoint: "/track/convert",
            statusCode: rng() > 0.95 ? 500 : 200,
            responseTime: value,
            errorType: undefined,
          };
        } else {
          // error_rate: 0 to 0.05
          value = Math.round(rng() * 500) / 10000;
          metadata = {
            endpoint: rng() > 0.5 ? "/track/click" : "/track/convert",
            statusCode: 500,
            errorType: rng() > 0.5 ? "timeout" : "internal_error",
          };
        }

        await ctx.db.insert("performanceMetrics", {
          tenantId,
          metricType,
          value,
          timestamp: randomTimestamp(rng, 1, DAYS_AGO_MAX),
          metadata,
        });
        stats.performanceMetricsCreated++;
      }
    }

    // =========================================================================
    // PHASE 16: Generate TRACKING PINGS (100)
    // =========================================================================
    if (!isDryRun) {
      for (let i = 0; i < 100; i++) {
        await ctx.db.insert("trackingPings", {
          tenantId,
          trackingKey: `tp_${tenant.slug}_${Math.random().toString(36).slice(2, 10)}`,
          timestamp: randomTimestamp(rng, 1, DAYS_AGO_MAX),
          domain: tenant.domain,
          userAgent: generateUserAgent(rng),
          ipAddress: generateIPAddress(rng),
        });
        stats.trackingPingsCreated++;
      }
    }

    // =========================================================================
    // PHASE 17: Generate RAW WEBHOOKS (50)
    // =========================================================================
    if (!isDryRun) {
      const webhookEventTypes = [
        "payment.completed",
        "payment.failed",
        "subscription.created",
        "subscription.cancelled",
        "refund.created",
      ];

      for (let i = 0; i < 50; i++) {
        const eventType = pickRandom(webhookEventTypes, rng);
        const isProcessed = rng() > 0.15; // 85% processed
        const isValid = rng() > 0.1; // 90% valid signature

        await ctx.db.insert("rawWebhooks", {
          tenantId,
          source: "saligpay",
          eventId: generateEventId(),
          eventType,
          rawPayload: JSON.stringify({
            event: eventType,
            data: {
              amount: Math.round((29 + rng() * 497) * 100) / 100,
              customer_email: `webhook.customer${i + 1}@example.com`,
              timestamp: new Date().toISOString(),
            },
          }),
          signatureValid: isValid,
          status: !isValid ? "failed" : isProcessed ? "processed" : "pending",
          processedAt: isProcessed ? Date.now() : undefined,
          errorMessage: !isValid ? "Invalid webhook signature" : undefined,
        });
        stats.rawWebhooksCreated++;
      }
    }

    // =========================================================================
    // PHASE 18: Backfill denormalized tenantStats
    // =========================================================================
    if (!isDryRun) {
      try {
        await ctx.runMutation(internal.tenantStats.backfillStats, { tenantId });
      } catch (bfError) {
        errors.push(`Stats backfill failed: ${bfError instanceof Error ? bfError.message : String(bfError)}`);
      }
    }

    // =========================================================================
    // Return summary
    // =========================================================================
    return {
      success: errors.length === 0,
      dryRun: isDryRun,
      tenantId: tenantId.toString(),
      tenantName: tenant.name,
      stats,
      breakdown,
      errors,
    };
  },
});

// =============================================================================
// Cleanup: Delete rows from a single table for a tenant
// =============================================================================

/**
 * Delete all rows from one table for a tenant. Uses .take(500) in a loop.
 * Each call is a separate function execution with its own 4096 read budget.
 * Keeps under limit by only reading one table at a time.
 */
export const deleteTenantTableRows = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    tableName: v.string(),
    indexName: v.optional(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { tenantId, tableName, indexName } = args;
    const idx = indexName ?? "by_tenant";
    let count = 0;
    let hasMore = true;

    while (hasMore) {
      let docs: any[];
      try {
        docs = await ctx.db
          .query(tableName as any)
          .withIndex(idx as any, (q: any) => q.eq("tenantId", tenantId))
          .take(500);
      } catch {
        break; // Table/index doesn't exist — skip
      }
      if (docs.length === 0) break;
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
        count++;
      }
      hasMore = docs.length === 500;
    }
    return count;
  },
});

// =============================================================================
// Master Reset: Clear everything and re-seed from scratch
// =============================================================================

/**
 * Master reset action: wipe all data, re-seed base tenants/users, then bulk seed TechFlow.
 *
 * Each table deletion runs as a separate internalMutation call via ctx.runMutation,
 * giving each its own 4096 read budget.
 *
 * Usage:
 *   npx convex run seedTechFlowComprehensive:resetAndSeedAll --args '{"tenantSlug":"techflow-saas"}'
 */
export const resetAndSeedAll = action({
  args: {
    tenantSlug: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { tenantSlug } = args;

    // Step 1: Find the tenant (before wiping)
    const tenantId = await ctx.runQuery(
      internal.seedTechFlowComprehensive._findTenantId,
      { slug: tenantSlug },
    );
    if (!tenantId) {
      return `ERROR: Tenant "${tenantSlug}" not found.`;
    }

    // Step 2: Delete all data table-by-table (reverse dependency order)
    // Each ctx.runMutation call gets its own 4096 read budget
    const leafTables = [
      "clicks", "performanceMetrics", "trackingPings", "rawWebhooks",
      "emails", "broadcastEmails",
      "commissions", "conversions",
      "payouts", "payoutBatches",
      "referralLinks", "affiliateCampaigns",
      "affiliates",
      "auditLogs", "brandAssets", "billingHistory", "teamInvitations",
    ];

    const deletedCounts: Record<string, number> = {};

    for (const tableName of leafTables) {
      try {
        const count: number = await ctx.runMutation(
          internal.seedTechFlowComprehensive.deleteTenantTableRows,
          { tenantId, tableName },
        );
        deletedCounts[tableName] = count;
      } catch (e) {
        deletedCounts[tableName] = -1;
      }
    }

    // Tables without by_tenant index — use special handling
    // affiliateSessions (by_affiliate) — delete all (dev only)
    try {
      const count: number = await ctx.runMutation(
        internal.seedTechFlowComprehensive._deleteAllFromTable,
        { tableName: "affiliateSessions" },
      );
      deletedCounts["affiliateSessions"] = count;
    } catch (e) {
      deletedCounts["affiliateSessions"] = -1;
    }

    // loginAttempts — delete all (dev only)
    try {
      const count: number = await ctx.runMutation(
        internal.seedTechFlowComprehensive._deleteAllFromTable,
        { tableName: "loginAttempts" },
      );
      deletedCounts["loginAttempts"] = count;
    } catch (e) {
      deletedCounts["loginAttempts"] = -1;
    }

    // emailTemplates (by_tenant_and_type) — special index
    try {
      const count: number = await ctx.runMutation(
        internal.seedTechFlowComprehensive.deleteTenantTableRows,
        { tenantId, tableName: "emailTemplates", indexName: "by_tenant_and_type" },
      );
      deletedCounts["emailTemplates"] = count;
    } catch (e) {
      deletedCounts["emailTemplates"] = -1;
    }

    // tenantStats — find and delete
    try {
      const count: number = await ctx.runMutation(
        internal.seedTechFlowComprehensive.deleteTenantTableRows,
        { tenantId, tableName: "tenantStats" },
      );
      deletedCounts["tenantStats"] = count;
    } catch (e) {
      deletedCounts["tenantStats"] = -1;
    }

    // Step 3: Re-seed base data (tenants, users, campaigns, initial affiliates)
    try {
      await ctx.runMutation(internal.testData.seedAllTestData, {});
    } catch (e) {
      // Base data already exists — that's fine
    }

    // Step 4: Bulk seed TechFlow with comprehensive data
    const result: any = await ctx.runMutation(
      internal.seedTechFlowComprehensive.seedTechFlow,
      { tenantSlug, dryRun: false },
    );

    // Step 5: Backfill tenantStats
    await ctx.runMutation(internal.tenantStats.backfillStats, { tenantId });

    const totalDeleted = Object.values(deletedCounts).reduce((s, c) => s + Math.max(0, c), 0);

    return [
      `Reset complete for "${tenantSlug}".`,
      `Deleted: ${totalDeleted} rows across ${Object.keys(deletedCounts).length} tables.`,
      `Re-seeded: ${JSON.stringify(result.stats)}`,
      `Errors: ${result.errors.length > 0 ? JSON.stringify(result.errors) : "none"}`,
    ].join("\n");
  },
});

// Internal helpers for the master reset
export const _findTenantId = internalQuery({
  args: { slug: v.string() },
  returns: v.union(v.id("tenants"), v.null()),
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    return tenant ? tenant._id : null;
  },
});

export const _deleteAllFromTable = internalMutation({
  args: { tableName: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    let hasMore = true;
    while (hasMore) {
      const docs = await ctx.db.query(args.tableName as any).take(500);
      if (docs.length === 0) break;
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
        count++;
      }
      hasMore = docs.length === 500;
    }
    return count;
  },
});

// =============================================================================
// Utility: Get TechFlow data summary
// =============================================================================

/**
 * Get a comprehensive summary of all data for the TechFlow tenant.
 * Useful for verifying the seed was successful.
 */
export const getTechFlowSummary = internalQuery({
  args: { tenantSlug: v.string() },
  returns: v.object({
    tenant: v.object({
      name: v.string(),
      slug: v.string(),
      plan: v.string(),
      status: v.string(),
    }),
    counts: v.object({
      affiliates: v.number(),
      campaigns: v.number(),
      referralLinks: v.number(),
      affiliateCampaigns: v.number(),
      affiliateSessions: v.number(),
      clicks: v.number(),
      conversions: v.number(),
      commissions: v.number(),
      payoutBatches: v.number(),
      payouts: v.number(),
      auditLogs: v.number(),
      emails: v.number(),
      broadcastEmails: v.number(),
      emailTemplates: v.number(),
      brandAssets: v.number(),
      billingHistory: v.number(),
      teamInvitations: v.number(),
      loginAttempts: v.number(),
      performanceMetrics: v.number(),
      trackingPings: v.number(),
      rawWebhooks: v.number(),
      users: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) throw new Error(`Tenant "${args.tenantSlug}" not found`);

    const tid = tenant._id;

    // Helper to count — always capped with .take() per AGENTS.md rules
    const count = async (tableName: string): Promise<number> => {
      const results = await ctx.db
        .query(tableName as any)
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tid))
        .take(10000);
      return results.length;
    };

    // affiliateSessions and emailTemplates don't have by_tenant index — count differently
    const countSessions = async (): Promise<number> => {
      // affiliateSessions has by_affiliate index, need to check via affiliate IDs
      const affs = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tid))
        .take(100);
      let total = 0;
      for (const aff of affs) {
        const sessions = await ctx.db
          .query("affiliateSessions")
          .withIndex("by_affiliate", (q: any) => q.eq("affiliateId", aff._id))
          .take(100);
        total += sessions.length;
        if (total >= 10000) break;
      }
      return total;
    };

    const countEmailTemplates = async (): Promise<number> => {
      // emailTemplates has by_tenant_and_type composite index — just check one type exists
      const r = await ctx.db
        .query("emailTemplates")
        .withIndex("by_tenant_and_type", (q: any) => q.eq("tenantId", tid).eq("templateType", "commission_confirmed"))
        .take(1);
      return r.length > 0 ? 1 : 0;
    };

    const [
      affiliates, campaigns, referralLinks, affiliateCampaigns, affiliateSessions,
      clicks, conversions, commissions, payoutBatches, payouts,
      auditLogs, emails, broadcastEmails, emailTemplates, brandAssets,
      billingHistory, teamInvitations, loginAttemptsCount, performanceMetrics,
      trackingPings, rawWebhooks, users,
    ] = await Promise.all([
      count("affiliates"),
      count("campaigns"),
      count("referralLinks"),
      count("affiliateCampaigns"),
      countSessions(),
      count("clicks"),
      count("conversions"),
      count("commissions"),
      count("payoutBatches"),
      count("payouts"),
      count("auditLogs"),
      count("emails"),
      count("broadcastEmails"),
      countEmailTemplates(),
      count("brandAssets"),
      count("billingHistory"),
      count("teamInvitations"),
      // loginAttempts has by_email index, not by_tenant — count via email scan
      (async () => {
        const results = await ctx.db.query("loginAttempts").take(10000);
        return results.length;
      })(),
      count("performanceMetrics"),
      count("trackingPings"),
      count("rawWebhooks"),
      count("users"),
    ]);

    return {
      tenant: { name: tenant.name, slug: tenant.slug, plan: tenant.plan, status: tenant.status },
      counts: {
        affiliates, campaigns, referralLinks, affiliateCampaigns, affiliateSessions,
        clicks, conversions, commissions, payoutBatches, payouts,
        auditLogs, emails, broadcastEmails, emailTemplates,
        brandAssets, billingHistory, teamInvitations, loginAttempts: loginAttemptsCount,
        performanceMetrics, trackingPings, rawWebhooks, users,
      },
    };
  },
});
