/**
 * Bulk Test Data Generator (Reusable)
 *
 * Generates large-scale realistic test data for any tenant in the system.
 * Designed to be reusable — call with any tenant slug and configuration.
 *
 * USAGE:
 *   # Seed 500 affiliates + 500 commissions + 500 payouts for "techflow" tenant
 *   npx convex run seedBulkData:seedTenantBulkData --json --args='{"tenantSlug":"techflow","affiliateCount":500,"commissionCount":500,"payoutCount":500}'
 *
 *   # Seed with custom config
 *   npx convex run seedBulkData:seedTenantBulkData --json --args='{"tenantSlug":"techflow","affiliateCount":1000,"commissionCount":800,"payoutCount":600,"includeClicks":true,"includeConversions":true}'
 *
 *   # Preview only (dry run — shows what would be created without inserting)
 *   npx convex run seedBulkData:seedTenantBulkData --json --args='{"tenantSlug":"techflow","affiliateCount":500,"commissionCount":500,"payoutCount":500,"dryRun":true}'
 *
 * Password for all generated test affiliates: "TestPass123!"
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// =============================================================================
// Configuration Types
// =============================================================================

interface BulkSeedConfig {
  tenantSlug: string;
  affiliateCount: number;
  commissionCount: number;
  payoutCount: number;
  includeClicks?: boolean;
  includeConversions?: boolean;
  dryRun?: boolean;
}

// =============================================================================
// Constants & Lookup Tables
// =============================================================================

const PROMOTION_CHANNELS = [
  "YouTube",
  "Blog",
  "Social Media",
  "Email Marketing",
  "Instagram",
  "Facebook Group",
  "TikTok",
  "Twitter/X",
  "LinkedIn",
  "Podcast",
  "Website",
  "WhatsApp",
  "Telegram",
  "Pinterest",
];

const AFFILIATE_STATUSES = ["active", "active", "active", "active", "active", "active", "pending", "pending", "suspended", "rejected"] as const;

const COMMISSION_STATUSES = [
  "pending", "pending", "pending",
  "approved", "approved", "approved", "approved",
  "paid", "paid", "paid",
  "declined",
  "reversed",
] as const;

const PAYOUT_STATUSES = ["completed", "completed", "completed", "pending", "processing"] as const;

const REVERSAL_REASONS = ["refund", "chargeback"] as const;

const FRAUD_INDICATORS = [
  "self_referral_ip_match",
  "same_device_fingerprint",
  "rapid_consecutive_conversions",
  "suspicious_payment_method",
  "velocity_exceeded",
];

const FIRST_NAMES = [
  "Marco", "Angela", "Jose", "Maria", "Carlos", "Sofia", "Ricardo", "Isabella",
  "Fernando", "Camille", "Andres", "Lucia", "Diego", "Patricia", "Miguel", "Elena",
  "Roberto", "Gabriela", "Eduardo", "Valentina", "Antonio", "Daniela", "Rafael",
  "Mariana", "Sergio", "Victoria", "Luis", "Carolina", "Pedro", "Alejandra",
  "Jorge", "Natalia", "Francisco", "Teresa", "Alberto", "Raquel", "Pablo",
  "Beatriz", "Daniel", "Lorena", "Hugo", "Carmen", "Adrian", "Rosa", "Ivan",
  "Silvia", "Oscar", "Claudia", "Andres", "Jimena", "Raul", "Veronica",
  "Emilio", "Marta", "Gonzalo", "Alicia", "Tomas", "Laura", "Cristian",
  "Sara", "Esteban", "Monica", "Dario", "Roxana", "Bruno", "Nadia",
  // More common PH/SEA names
  "John", "Mark", "Paul", "James", "Ryan", "Kevin", "Brian", "Eric",
  "Anna", "Grace", "Joy", "Faith", "Hope", "Jane", "Rose", "May",
  "Chen", "Wei", "Li", "Zhang", "Wang", "Liu", "Huang", "Yang",
  "Park", "Kim", "Lee", "Choi", "Jung", "Kang", "Yoon", "Song",
  "Nguyen", "Tran", "Le", "Pham", "Hoang", "Huynh", "Vo", "Dang",
];

const LAST_NAMES = [
  "Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Ramos",
  "Flores", "Gonzales", "Villanueva", "Dela Cruz", "Lim", "Tan", "Chua", "Ong",
  "Wong", "Lee", "Kim", "Park", "Nguyen", "Tran", "Pham", "Le",
  "Santillan", "Pascual", "Aquino", "Macapagal", "Roxas", "Laurel", "Magsaysay",
  "Gonzalez", "Martinez", "Rodriguez", "Lopez", "Hernandez", "Diaz", "Morales",
  "Jimenez", "Ruiz", "Alvarez", "Romero", "Munoz", "Gutierrez", "Ortiz",
  "Navarro", "Herrera", "Medina", "Castro", "Aguilar", "Vargas", "Rangel",
];

const EMAIL_DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "proton.me", "icloud.com", "mail.com",
  "affiliate.ph", "marketing.asia", "biz.sea",
];

/**
 * Pre-computed password hash for "TestPass123!" using Better Auth's scrypt.
 */
const TEST_PASSWORD_HASH = "b1fb84d0f1c6feb781d661faecc3eeb6:4840a3170ce388473977f0fef10160e603fc9d95a74f55b2bfbf7626d0879e545a1fe515d12b36f0230bce85f6d4f6de3cf8f98f9a1daca3deeefd06e76a2000";

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
  // Add numeric suffix to avoid collisions
  const suffix = index % 100;
  return `${firstName}.${lastName}${suffix}@${domain}`;
}

function generateAffiliateName(rng: () => number): string {
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

function randomTimestamp(rng: () => number, daysAgoMin: number, daysAgoMax: number): number {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const offset = msPerDay * (daysAgoMin + rng() * (daysAgoMax - daysAgoMin));
  return Math.floor(now - offset);
}

function generateIPAddress(rng: () => number): string {
  // Generate realistic-looking IPs (various ranges)
  const ranges = [
    () => `192.168.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
    () => `10.0.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
    () => `${103 + Math.floor(rng() * 50)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
    () => `${175 + Math.floor(rng() * 30)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
  ];
  return ranges[Math.floor(rng() * ranges.length)]();
}

function generateUserAgent(rng: () => number): string {
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ];
  return agents[Math.floor(rng() * agents.length)];
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

function generateBatchCode(): string {
  return `BATCH-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// =============================================================================
// Main Seed Function
// =============================================================================

/**
 * Seed bulk test data for a specific tenant.
 *
 * This is the main entry point. It looks up the tenant by slug, then creates
 * affiliates, commissions, payouts (and optionally clicks/conversions).
 *
 * All data is created directly via ctx.db.insert (bypassing auth/mutation hooks
 * for speed). After seeding, it calls backfillStats to sync denormalized counters.
 */
export const seedTenantBulkData = internalMutation({
  args: {
    tenantSlug: v.string(),
    affiliateCount: v.number(),
    commissionCount: v.number(),
    payoutCount: v.number(),
    includeClicks: v.optional(v.boolean()),
    includeConversions: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    dryRun: v.boolean(),
    tenantId: v.string(),
    tenantName: v.string(),
    stats: v.object({
      affiliatesCreated: v.number(),
      referralsLinksCreated: v.number(),
      clicksCreated: v.number(),
      conversionsCreated: v.number(),
      commissionsCreated: v.number(),
      payoutBatchesCreated: v.number(),
      payoutsCreated: v.number(),
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
      commissionsWithFraudSignals: v.number(),
      selfReferralCommissions: v.number(),
    }),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const isDryRun = args.dryRun ?? false;
    const errors: string[] = [];

    // -------------------------------------------------------------------------
    // Step 1: Find tenant by slug
    // -------------------------------------------------------------------------
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .first();

    if (!tenant) {
      throw new Error(`Tenant with slug "${args.tenantSlug}" not found. Run seedAllTestData first or check the slug.`);
    }

    const tenantId = tenant._id;

    // -------------------------------------------------------------------------
    // Step 2: Get existing campaigns for this tenant
    // -------------------------------------------------------------------------
    const existingCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    if (existingCampaigns.length === 0) {
      throw new Error(`No campaigns found for tenant "${args.tenantSlug}". Create at least one campaign first.`);
    }

    // -------------------------------------------------------------------------
    // Step 3: Get existing affiliate codes to avoid collisions
    // -------------------------------------------------------------------------
    const existingAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    const existingCodes = new Set(existingAffiliates.map(a => a.uniqueCode));
    const existingEmails = new Set(existingAffiliates.map(a => a.email));

    // -------------------------------------------------------------------------
    // Step 4: Initialize RNG and counters
    // -------------------------------------------------------------------------
    const rng = seededRandom(Date.now());

    const stats = {
      affiliatesCreated: 0,
      referralsLinksCreated: 0,
      clicksCreated: 0,
      conversionsCreated: 0,
      commissionsCreated: 0,
      payoutBatchesCreated: 0,
      payoutsCreated: 0,
    };

    const breakdown = {
      affiliatesByStatus: { active: 0, pending: 0, suspended: 0, rejected: 0 },
      commissionsByStatus: { pending: 0, approved: 0, paid: 0, declined: 0, reversed: 0 },
      payoutsByStatus: { completed: 0, pending: 0, processing: 0 },
      commissionsWithFraudSignals: 0,
      selfReferralCommissions: 0,
    };

    // Track created affiliate IDs for commission/payout generation
    const createdAffiliateIds: Id<"affiliates">[] = [];
    const affiliateReferralLinks: Map<string, Id<"referralLinks">> = new Map();

    // -------------------------------------------------------------------------
    // Step 5: Generate AFFILIATES
    // -------------------------------------------------------------------------
    const activeAffiliateIds: Id<"affiliates">[] = [];

    for (let i = 0; i < args.affiliateCount; i++) {
      let email = generateAffiliateEmail(existingAffiliates.length + i, rng);
      let attempts = 0;
      while (existingEmails.has(email) && attempts < 20) {
        email = generateAffiliateEmail(existingAffiliates.length + i + attempts, rng);
        attempts++;
      }
      existingEmails.add(email);

      const name = generateAffiliateName(rng);
      const status = pickRandom(AFFILIATE_STATUSES, rng);
      const promotionChannel = pickRandom(PROMOTION_CHANNELS, rng);

      let uniqueCode = generateReferralCode(rng);
      let codeAttempts = 0;
      while (existingCodes.has(uniqueCode) && codeAttempts < 20) {
        uniqueCode = generateReferralCode(rng);
        codeAttempts++;
      }
      existingCodes.add(uniqueCode);

      if (!isDryRun) {
        // Create affiliate with payout method (for payout scenarios)
        const payoutMethods = [
          { type: "gcash", details: `0917${Math.floor(1000000 + rng() * 9000000)}` },
          { type: "bank_transfer", details: `BPI ${Math.floor(1000000000 + rng() * 9000000000)}` },
          { type: "maya", details: `0928${Math.floor(1000000 + rng() * 9000000)}` },
          { type: "paypal", details: `${email.replace("@", "+affiliate@")}` },
          { type: "unionbank", details: `UBP ${Math.floor(1000000000 + rng() * 9000000000)}` },
        ];

        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email,
          name,
          uniqueCode,
          status,
          passwordHash: TEST_PASSWORD_HASH,
          promotionChannel,
          payoutMethod: rng() > 0.15 ? payoutMethods[Math.floor(rng() * payoutMethods.length)] : undefined,
          vanitySlug: rng() > 0.7 ? `${name.toLowerCase().replace(/\s+/g, "-")}-${uniqueCode.slice(0, 4).toLowerCase()}` : undefined,
        });

        createdAffiliateIds.push(affiliateId);
        if (status === "active") {
          activeAffiliateIds.push(affiliateId);
        }

        // Create referral link for active affiliates
        if (status === "active") {
          const campaignId = existingCampaigns[Math.floor(rng() * existingCampaigns.length)]._id;
          const referralLinkId = await ctx.db.insert("referralLinks", {
            tenantId,
            affiliateId,
            campaignId,
            code: uniqueCode,
          });
          affiliateReferralLinks.set(affiliateId.toString(), referralLinkId);
          stats.referralsLinksCreated++;

          // Add a second referral link for some affiliates (multi-campaign)
          if (rng() > 0.6 && existingCampaigns.length > 1) {
            const secondCampaign = existingCampaigns[Math.floor(rng() * existingCampaigns.length)]._id;
            if (secondCampaign !== campaignId) {
              await ctx.db.insert("referralLinks", {
                tenantId,
                affiliateId,
                campaignId: secondCampaign,
                code: `${uniqueCode}-2`,
              });
              stats.referralsLinksCreated++;
            }
          }
        }

        // Add fraud signals for some suspended affiliates
        if (status === "suspended" && rng() > 0.3) {
          const fraudSignals = [];
          const signalCount = 1 + Math.floor(rng() * 3);
          for (let s = 0; s < signalCount; s++) {
            fraudSignals.push({
              type: pickRandom(FRAUD_INDICATORS, rng),
              severity: pickRandom(["low", "medium", "high"] as const, rng),
              timestamp: randomTimestamp(rng, 10, 60),
              details: `Auto-detected signal during test data generation`,
              signalId: `sig_seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            });
          }
          await ctx.db.patch(affiliateId, { fraudSignals });
        }
      }

      stats.affiliatesCreated++;
      breakdown.affiliatesByStatus[status as keyof typeof breakdown.affiliatesByStatus]++;
    }

    // -------------------------------------------------------------------------
    // Step 6: Generate CLICKS (optional)
    // -------------------------------------------------------------------------
    if (args.includeClicks && !isDryRun) {
      const clicksPerAffiliate = Math.max(1, Math.floor(args.commissionCount / Math.max(1, activeAffiliateIds.length)) * 5);

      for (let i = 0; i < Math.min(activeAffiliateIds.length, 100); i++) {
        const affiliateId = activeAffiliateIds[i];
        const referralLinkId = affiliateReferralLinks.get(affiliateId.toString());
        if (!referralLinkId) continue;

        const clickCount = Math.min(clicksPerAffiliate, 50 + Math.floor(rng() * 200));
        for (let c = 0; c < clickCount; c++) {
          const timestamp = randomTimestamp(rng, 1, 90);
          const dedupeKey = `${referralLinkId}-${generateIPAddress(rng)}-${timestamp}`;

          await ctx.db.insert("clicks", {
            tenantId,
            referralLinkId,
            affiliateId,
            campaignId: existingCampaigns[Math.floor(rng() * existingCampaigns.length)]._id,
            ipAddress: generateIPAddress(rng),
            userAgent: generateUserAgent(rng),
            referrer: pickRandom([
              "https://google.com",
              "https://facebook.com",
              "https://youtube.com",
              "https://twitter.com",
              "https://instagram.com",
              "https://tiktok.com",
              "https://linkedin.com",
              undefined,
            ], rng),
            dedupeKey,
          });
          stats.clicksCreated++;
        }
      }
    }

    // -------------------------------------------------------------------------
    // Step 7: Generate CONVERSIONS (optional, paired with commissions)
    // -------------------------------------------------------------------------
    const conversionIdMap = new Map<number, Id<"conversions">>(); // commission index -> conversionId

    if (args.includeConversions && !isDryRun) {
      const conversionCount = Math.min(args.commissionCount, 600);
      for (let i = 0; i < conversionCount; i++) {
        if (activeAffiliateIds.length === 0) break;

        const affiliateId = activeAffiliateIds[Math.floor(rng() * activeAffiliateIds.length)];
        const referralLinkId = affiliateReferralLinks.get(affiliateId.toString());
        const campaign = existingCampaigns[Math.floor(rng() * existingCampaigns.length)];
        const saleAmount = Math.round((29 + rng() * 497) * 100) / 100; // $29.00 - $526.00

        const conversionId = await ctx.db.insert("conversions", {
          tenantId,
          affiliateId,
          referralLinkId,
          campaignId: campaign._id,
          customerEmail: `customer${i + 1}-${Math.floor(rng() * 9999)}@example.com`,
          amount: saleAmount,
          status: "completed",
          ipAddress: generateIPAddress(rng),
          attributionSource: pickRandom(["cookie", "webhook", "organic"] as const, rng),
          isSelfReferral: rng() > 0.95 ? true : undefined,
          metadata: {
            orderId: generateOrderId(),
            planId: `plan-${campaign._id.slice(-4)}`,
          },
        });
        conversionIdMap.set(i, conversionId);
        stats.conversionsCreated++;
      }
    }

    // -------------------------------------------------------------------------
    // Step 8: Generate COMMISSIONS
    // -------------------------------------------------------------------------
    const paidCommissionIds: Id<"commissions">[] = [];
    const approvedCommissionIds: Id<"commissions">[] = [];

    for (let i = 0; i < args.commissionCount; i++) {
      if (activeAffiliateIds.length === 0) break;

      const affiliateId = activeAffiliateIds[Math.floor(rng() * activeAffiliateIds.length)];
      const campaign = existingCampaigns[Math.floor(rng() * existingCampaigns.length)];
      const conversionId = conversionIdMap.get(i);

      // Calculate commission amount based on campaign type
      let commissionAmount: number;
      if (campaign.commissionType === "percentage") {
        const saleAmount = Math.round((29 + rng() * 497) * 100) / 100;
        commissionAmount = Math.round((saleAmount * campaign.commissionValue / 100) * 100) / 100;
      } else {
        commissionAmount = campaign.commissionValue;
      }

      // Determine status with weighted distribution
      const status = pickRandom(COMMISSION_STATUSES, rng);

      // Fraud scenario: ~5% of commissions have fraud indicators
      const hasFraudIndicators = rng() < 0.05;
      const isSelfReferral = rng() < 0.03;

      const fraudIndicators = hasFraudIndicators
        ? Array.from({ length: 1 + Math.floor(rng() * 2) }, () => pickRandom(FRAUD_INDICATORS, rng))
        : undefined;

      const timestamp = randomTimestamp(rng, 1, 90);

      if (!isDryRun) {
        const commissionId = await ctx.db.insert("commissions", {
          tenantId,
          affiliateId,
          campaignId: campaign._id,
          conversionId,
          amount: commissionAmount,
          status,
          isSelfReferral: isSelfReferral || undefined,
          fraudIndicators,
          transactionId: generateTransactionId(),
          eventMetadata: {
            source: pickRandom(["webhook", "api", "manual"] as const, rng),
            transactionId: generateTransactionId(),
            timestamp,
          },
          reversalReason: status === "reversed" ? pickRandom(REVERSAL_REASONS, rng) : undefined,
        });

        if (status === "paid") {
          paidCommissionIds.push(commissionId);
        }
        if (status === "approved") {
          approvedCommissionIds.push(commissionId);
        }

        if (hasFraudIndicators) breakdown.commissionsWithFraudSignals++;
        if (isSelfReferral) breakdown.selfReferralCommissions++;
      }

      stats.commissionsCreated++;
      breakdown.commissionsByStatus[status as keyof typeof breakdown.commissionsByStatus]++;
    }

    // -------------------------------------------------------------------------
    // Step 9: Generate PAYOUT BATCHES and PAYOUTS
    // -------------------------------------------------------------------------
    // NOTE: batchId is REQUIRED in the payouts schema, so we must create the
    // batch FIRST, then insert payouts with the batch ID.
    // -------------------------------------------------------------------------
    if (!isDryRun && args.payoutCount > 0) {
      // Create multiple payout batches over different time periods
      const batchesToCreate = Math.max(1, Math.floor(args.payoutCount / 20));
      let payoutsCreated = 0;

      for (let b = 0; b < batchesToCreate && payoutsCreated < args.payoutCount; b++) {
        const generatedAt = randomTimestamp(rng, 7, 60);
        const batchStatus = pickRandom(PAYOUT_STATUSES, rng);

        // Pre-calculate how many payouts this batch will have
        const payoutsPerBatch = Math.max(1, Math.floor(args.payoutCount / batchesToCreate));
        const batchPayoutCount = Math.min(payoutsPerBatch, args.payoutCount - payoutsCreated);

        if (batchPayoutCount <= 0) break;

        // Calculate batch total upfront
        let batchTotal = 0;
        const batchPayoutAmounts: number[] = [];
        for (let p = 0; p < batchPayoutCount; p++) {
          const amt = Math.round((5 + rng() * 500) * 100) / 100;
          batchPayoutAmounts.push(amt);
          batchTotal += amt;
        }

        // Create payout batch FIRST (batchId is required for payouts)
        const batchId = await ctx.db.insert("payoutBatches", {
          tenantId,
          totalAmount: Math.round(batchTotal * 100) / 100,
          affiliateCount: batchPayoutCount,
          status: batchStatus,
          generatedAt,
          completedAt: batchStatus === "completed" ? generatedAt + 86400000 * 2 : undefined,
          manualCount: Math.floor(rng() * batchPayoutCount),
          saligPayCount: batchPayoutCount - Math.floor(rng() * batchPayoutCount),
        });

        stats.payoutBatchesCreated++;

        // Now create individual payout records linked to this batch
        for (let p = 0; p < batchPayoutCount; p++) {
          const affiliateId = activeAffiliateIds[Math.floor(rng() * activeAffiliateIds.length)];
          const payoutStatus = batchStatus === "completed"
            ? (rng() > 0.1 ? "completed" : "pending")
            : batchStatus;

          await ctx.db.insert("payouts", {
            tenantId,
            affiliateId,
            batchId,
            amount: batchPayoutAmounts[p],
            status: payoutStatus,
            paymentReference: payoutStatus === "completed" ? generatePaymentReference() : undefined,
            paidAt: payoutStatus === "completed" ? generatedAt + 86400000 : undefined,
            paymentSource: rng() > 0.5 ? "saligpay" : "manual",
          });
          payoutsCreated++;

          if (payoutStatus === "completed") breakdown.payoutsByStatus.completed++;
          else if (payoutStatus === "pending") breakdown.payoutsByStatus.pending++;
          else breakdown.payoutsByStatus.processing++;
        }

        // Link some paid commissions to this batch
        const commissionsPerBatch = Math.max(1, Math.floor(paidCommissionIds.length / batchesToCreate));
        const startIdx = b * commissionsPerBatch;
        const endIdx = Math.min(startIdx + commissionsPerBatch, paidCommissionIds.length);
        for (let c = startIdx; c < endIdx; c++) {
          await ctx.db.patch(paidCommissionIds[c], { batchId });
        }
      }

      // Also create a "pending" batch for approved commissions (not yet paid out)
      if (approvedCommissionIds.length > 0) {
        const pendingBatchGeneratedAt = randomTimestamp(rng, 0, 3);
        const pendingPayoutCount = Math.min(
          Math.floor(args.payoutCount * 0.3),
          approvedCommissionIds.length,
          50
        );

        let pendingBatchTotal = 0;
        for (let p = 0; p < pendingPayoutCount; p++) {
          pendingBatchTotal += Math.round((5 + rng() * 300) * 100) / 100;
        }

        const pendingBatchId = await ctx.db.insert("payoutBatches", {
          tenantId,
          totalAmount: Math.round(pendingBatchTotal * 100) / 100,
          affiliateCount: pendingPayoutCount,
          status: "pending",
          generatedAt: pendingBatchGeneratedAt,
        });
        stats.payoutBatchesCreated++;

        for (let p = 0; p < pendingPayoutCount; p++) {
          const affiliateId = activeAffiliateIds[Math.floor(rng() * activeAffiliateIds.length)];
          await ctx.db.insert("payouts", {
            tenantId,
            affiliateId,
            batchId: pendingBatchId,
            amount: Math.round((5 + rng() * 300) * 100) / 100,
            status: "pending",
          });
          stats.payoutsCreated++;
          breakdown.payoutsByStatus.pending++;
        }

        // Link approved commissions to the pending batch
        const linkCount = Math.min(approvedCommissionIds.length, pendingPayoutCount);
        for (let c = 0; c < linkCount; c++) {
          await ctx.db.patch(approvedCommissionIds[c], { batchId: pendingBatchId });
        }
      }

      stats.payoutsCreated = payoutsCreated;
    }

    // -------------------------------------------------------------------------
    // Step 10: Backfill denormalized tenantStats
    // -------------------------------------------------------------------------
    if (!isDryRun) {
      try {
        await ctx.runMutation(internal.tenantStats.backfillStats, { tenantId });
      } catch (bfError) {
        errors.push(`Stats backfill failed: ${bfError instanceof Error ? bfError.message : String(bfError)}`);
      }
    }

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
// Utility: Get Tenant Slugs (for discovering available tenants)
// =============================================================================

/**
 * List all available tenants with their slug, name, and current data counts.
 * Useful for picking which tenant to seed.
 */
export const getAvailableTenants = internalQuery({
  args: {},
  returns: v.array(v.object({
    tenantId: v.string(),
    name: v.string(),
    slug: v.string(),
    plan: v.string(),
    status: v.string(),
    affiliateCount: v.number(),
    campaignCount: v.number(),
    commissionCount: v.number(),
    payoutCount: v.number(),
  })),
  handler: async (ctx) => {
    const tenants = await ctx.db.query("tenants").collect();
    const results = [];

    for (const tenant of tenants) {
      const [affiliates, campaigns, commissions, payouts] = await Promise.all([
        ctx.db.query("affiliates").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).take(5000),
        ctx.db.query("campaigns").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).take(100),
        ctx.db.query("commissions").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).take(5000),
        ctx.db.query("payouts").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).take(5000),
      ]);

      results.push({
        tenantId: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        affiliateCount: affiliates.length,
        campaignCount: campaigns.length,
        commissionCount: commissions.length,
        payoutCount: payouts.length,
      });
    }

    return results;
  },
});

// =============================================================================
// Utility: Seed Multiple Tenants at Once
// =============================================================================

/**
 * Seed bulk data for multiple tenants in a single call.
 * Useful for populating the entire dev environment at once.
 */
export const seedAllTenantsBulkData = internalMutation({
  args: {
    tenants: v.array(v.object({
      tenantSlug: v.string(),
      affiliateCount: v.number(),
      commissionCount: v.number(),
      payoutCount: v.number(),
      includeClicks: v.optional(v.boolean()),
      includeConversions: v.optional(v.boolean()),
    })),
  },
  returns: v.object({
    success: v.boolean(),
    results: v.array(v.object({
      tenantSlug: v.string(),
      tenantName: v.string(),
      success: v.boolean(),
      stats: v.object({
        affiliatesCreated: v.number(),
        referralsLinksCreated: v.number(),
        clicksCreated: v.number(),
        conversionsCreated: v.number(),
        commissionsCreated: v.number(),
        payoutBatchesCreated: v.number(),
        payoutsCreated: v.number(),
      }),
      errors: v.array(v.string()),
    })),
    totalErrors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const results = [];
    const totalErrors: string[] = [];

    for (const tenantConfig of args.tenants) {
      try {
        const tenant = await ctx.db
          .query("tenants")
          .withIndex("by_slug", (q) => q.eq("slug", tenantConfig.tenantSlug))
          .first();

        if (!tenant) {
          totalErrors.push(`Tenant "${tenantConfig.tenantSlug}" not found - skipping`);
          results.push({
            tenantSlug: tenantConfig.tenantSlug,
            tenantName: "Not Found",
            success: false,
            stats: {
              affiliatesCreated: 0,
              referralsLinksCreated: 0,
              clicksCreated: 0,
              conversionsCreated: 0,
              commissionsCreated: 0,
              payoutBatchesCreated: 0,
              payoutsCreated: 0,
            },
            errors: [`Tenant "${tenantConfig.tenantSlug}" not found`],
          });
          continue;
        }

        // Delegate to the single-tenant seeder (reuse logic)
        // We call the same handler logic inline for efficiency
        const existingCampaigns = await ctx.db
          .query("campaigns")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
          .collect();

        if (existingCampaigns.length === 0) {
          totalErrors.push(`No campaigns for "${tenantConfig.tenantSlug}" - skipping`);
          results.push({
            tenantSlug: tenantConfig.tenantSlug,
            tenantName: tenant.name,
            success: false,
            stats: {
              affiliatesCreated: 0,
              referralsLinksCreated: 0,
              clicksCreated: 0,
              conversionsCreated: 0,
              commissionsCreated: 0,
              payoutBatchesCreated: 0,
              payoutsCreated: 0,
            },
            errors: ["No campaigns found"],
          });
          continue;
        }

        const existingAffiliates = await ctx.db
          .query("affiliates")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
          .collect();

        const existingCodes = new Set(existingAffiliates.map(a => a.uniqueCode));
        const existingEmails = new Set(existingAffiliates.map(a => a.email));

        const rng = seededRandom(Date.now() + tenantConfig.tenantSlug.length);
        const stats = {
          affiliatesCreated: 0,
          referralsLinksCreated: 0,
          clicksCreated: 0,
          conversionsCreated: 0,
          commissionsCreated: 0,
          payoutBatchesCreated: 0,
          payoutsCreated: 0,
        };
        const errors: string[] = [];
        const activeAffiliateIds: Id<"affiliates">[] = [];
        const affiliateReferralLinks: Map<string, Id<"referralLinks">> = new Map();

        // Create affiliates
        for (let i = 0; i < tenantConfig.affiliateCount; i++) {
          let email = generateAffiliateEmail(existingAffiliates.length + i, rng);
          let attempts = 0;
          while (existingEmails.has(email) && attempts < 20) {
            email = generateAffiliateEmail(existingAffiliates.length + i + attempts, rng);
            attempts++;
          }
          existingEmails.add(email);

          const name = generateAffiliateName(rng);
          const status = pickRandom(AFFILIATE_STATUSES, rng);
          const promotionChannel = pickRandom(PROMOTION_CHANNELS, rng);

          let uniqueCode = generateReferralCode(rng);
          let codeAttempts = 0;
          while (existingCodes.has(uniqueCode) && codeAttempts < 20) {
            uniqueCode = generateReferralCode(rng);
            codeAttempts++;
          }
          existingCodes.add(uniqueCode);

          const payoutMethods = [
            { type: "gcash", details: `0917${Math.floor(1000000 + rng() * 9000000)}` },
            { type: "bank_transfer", details: `BPI ${Math.floor(1000000000 + rng() * 9000000000)}` },
            { type: "maya", details: `0928${Math.floor(1000000 + rng() * 9000000)}` },
          ];

          const affiliateId = await ctx.db.insert("affiliates", {
            tenantId: tenant._id,
            email,
            name,
            uniqueCode,
            status,
            passwordHash: TEST_PASSWORD_HASH,
            promotionChannel,
            payoutMethod: rng() > 0.15 ? payoutMethods[Math.floor(rng() * payoutMethods.length)] : undefined,
          });

          if (status === "active") {
            activeAffiliateIds.push(affiliateId);
            const campaignId = existingCampaigns[Math.floor(rng() * existingCampaigns.length)]._id;
            const referralLinkId = await ctx.db.insert("referralLinks", {
              tenantId: tenant._id,
              affiliateId,
              campaignId,
              code: uniqueCode,
            });
            affiliateReferralLinks.set(affiliateId.toString(), referralLinkId);
            stats.referralsLinksCreated++;
          }

          stats.affiliatesCreated++;
        }

        // Create commissions
        const paidCommissionIds: Id<"commissions">[] = [];
        const approvedCommissionIds: Id<"commissions">[] = [];
        const conversionIdMap = new Map<number, Id<"conversions">>();

        for (let i = 0; i < tenantConfig.commissionCount; i++) {
          if (activeAffiliateIds.length === 0) break;

          const affiliateId = activeAffiliateIds[Math.floor(rng() * activeAffiliateIds.length)];
          const campaign = existingCampaigns[Math.floor(rng() * existingCampaigns.length)];

          let commissionAmount: number;
          if (campaign.commissionType === "percentage") {
            const saleAmount = Math.round((29 + rng() * 497) * 100) / 100;
            commissionAmount = Math.round((saleAmount * campaign.commissionValue / 100) * 100) / 100;
          } else {
            commissionAmount = campaign.commissionValue;
          }

          const status = pickRandom(COMMISSION_STATUSES, rng);
          const hasFraudIndicators = rng() < 0.05;
          const isSelfReferral = rng() < 0.03;
          const timestamp = randomTimestamp(rng, 1, 90);

          // Optionally create conversion
          let conversionId: Id<"conversions"> | undefined;
          if (tenantConfig.includeConversions) {
            const convId = await ctx.db.insert("conversions", {
              tenantId: tenant._id,
              affiliateId,
              referralLinkId: affiliateReferralLinks.get(affiliateId.toString()),
              campaignId: campaign._id,
              customerEmail: `customer${i + 1}@example.com`,
              amount: Math.round((29 + rng() * 497) * 100) / 100,
              status: "completed",
              ipAddress: generateIPAddress(rng),
              attributionSource: pickRandom(["cookie", "webhook", "organic"] as const, rng),
              metadata: { orderId: generateOrderId() },
            });
            conversionId = convId;
            conversionIdMap.set(i, convId);
            stats.conversionsCreated++;
          }

          const commissionId = await ctx.db.insert("commissions", {
            tenantId: tenant._id,
            affiliateId,
            campaignId: campaign._id,
            conversionId,
            amount: commissionAmount,
            status,
            isSelfReferral: isSelfReferral || undefined,
            fraudIndicators: hasFraudIndicators ? [pickRandom(FRAUD_INDICATORS, rng)] : undefined,
            transactionId: generateTransactionId(),
            eventMetadata: {
              source: pickRandom(["webhook", "api", "manual"] as const, rng),
              transactionId: generateTransactionId(),
              timestamp,
            },
            reversalReason: status === "reversed" ? pickRandom(REVERSAL_REASONS, rng) : undefined,
          });

          if (status === "paid") paidCommissionIds.push(commissionId);
          if (status === "approved") approvedCommissionIds.push(commissionId);
          stats.commissionsCreated++;
        }

        // Create payouts — batchId is REQUIRED in schema, create batch first
        if (tenantConfig.payoutCount > 0 && paidCommissionIds.length > 0) {
          const batchesToCreate = Math.max(1, Math.floor(tenantConfig.payoutCount / 20));
          let payoutsCreated = 0;

          for (let b = 0; b < batchesToCreate && payoutsCreated < tenantConfig.payoutCount; b++) {
            const generatedAt = randomTimestamp(rng, 7, 60);
            const batchStatus = pickRandom(PAYOUT_STATUSES, rng);

            // Pre-calculate batch amounts
            const payoutsPerBatch = Math.max(1, Math.floor(tenantConfig.payoutCount / batchesToCreate));
            const batchPayoutCount = Math.min(payoutsPerBatch, tenantConfig.payoutCount - payoutsCreated);
            if (batchPayoutCount <= 0) break;

            let batchTotal = 0;
            const batchPayoutAmounts: number[] = [];
            for (let p = 0; p < batchPayoutCount; p++) {
              const amt = Math.round((5 + rng() * 500) * 100) / 100;
              batchPayoutAmounts.push(amt);
              batchTotal += amt;
            }

            // Create batch FIRST
            const batchId = await ctx.db.insert("payoutBatches", {
              tenantId: tenant._id,
              totalAmount: Math.round(batchTotal * 100) / 100,
              affiliateCount: batchPayoutCount,
              status: batchStatus,
              generatedAt,
              completedAt: batchStatus === "completed" ? generatedAt + 86400000 * 2 : undefined,
            });
            stats.payoutBatchesCreated++;

            // Create payout records with the batch ID
            for (let p = 0; p < batchPayoutCount; p++) {
              const affiliateId = activeAffiliateIds[Math.floor(rng() * activeAffiliateIds.length)];
              const payoutStatus = batchStatus === "completed" ? (rng() > 0.1 ? "completed" : "pending") : batchStatus;

              await ctx.db.insert("payouts", {
                tenantId: tenant._id,
                affiliateId,
                batchId,
                amount: batchPayoutAmounts[p],
                status: payoutStatus,
                paymentReference: payoutStatus === "completed" ? generatePaymentReference() : undefined,
                paidAt: payoutStatus === "completed" ? generatedAt + 86400000 : undefined,
                paymentSource: rng() > 0.5 ? "saligpay" : "manual",
              });
              payoutsCreated++;
            }

            // Link paid commissions to this batch
            const commissionsPerBatch = Math.max(1, Math.floor(paidCommissionIds.length / batchesToCreate));
            const startIdx = b * commissionsPerBatch;
            const endIdx = Math.min(startIdx + commissionsPerBatch, paidCommissionIds.length);
            for (let c = startIdx; c < endIdx; c++) {
              await ctx.db.patch(paidCommissionIds[c], { batchId });
            }

            stats.payoutsCreated = payoutsCreated;
          }
        }

        // Backfill stats
        try {
          await ctx.runMutation(internal.tenantStats.backfillStats, { tenantId: tenant._id });
        } catch (bfError) {
          errors.push(`Stats backfill failed: ${bfError instanceof Error ? bfError.message : String(bfError)}`);
        }

        results.push({
          tenantSlug: tenantConfig.tenantSlug,
          tenantName: tenant.name,
          success: errors.length === 0,
          stats,
          errors,
        });

      } catch (error) {
        const msg = `Error seeding "${tenantConfig.tenantSlug}": ${error instanceof Error ? error.message : String(error)}`;
        totalErrors.push(msg);
        results.push({
          tenantSlug: tenantConfig.tenantSlug,
          tenantName: "Error",
          success: false,
          stats: {
            affiliatesCreated: 0,
            referralsLinksCreated: 0,
            clicksCreated: 0,
            conversionsCreated: 0,
            commissionsCreated: 0,
            payoutBatchesCreated: 0,
            payoutsCreated: 0,
          },
          errors: [msg],
        });
      }
    }

    return {
      success: totalErrors.length === 0,
      results,
      totalErrors,
    };
  },
});
