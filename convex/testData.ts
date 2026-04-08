/**
 * Test Data Generator
 * 
 * This module provides functions to seed the database with realistic test data
 * for development and testing purposes. All functions are internal mutations
 * that should only be called in development/test environments.
 * 
 * Usage:
 * 1. Run: pnpm convex run testData:seedAuthUsers     (creates auth users via HTTP)
 * 2. Run: pnpm convex run testData:seedAllTestData    (creates app data)
 * 3. Or use getTestCredentials to see all credentials
 * 
 * Password for all test users: "TestPass123!"
 */

import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/** Create a timestamp from year/month/day (1-indexed month). */
function date(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getTime();
}

/**
 * Test data configuration
 */
interface TestTenant {
  name: string;
  slug: string;
  domain: string;
  plan: string;
  billingProvider?: "saligpay" | "stripe";
  subscription?: {
    status?: "trial" | "active" | "past_due" | "cancelled";
    subscriptionId?: string;
    trialEndsAt?: number;
    billingStartDate?: number;
    billingEndDate?: number;
    cancellationDate?: number;
    deletionScheduledDate?: number;
  };
  billingEvents: Array<{
    event: string;
    plan?: string;
    amount?: number;
    timestamp: number;
    previousPlan?: string;
    newPlan?: string;
    transactionId?: string;
  }>;
  users: Array<{
    email: string;
    name: string;
    role: string;
  }>;
  affiliates: Array<{
    email: string;
    name: string;
    status: string;
    promotionChannel?: string;
  }>;
  campaigns: Array<{
    name: string;
    description: string;
    commissionType: string;
    commissionValue: number;
    recurring: boolean;
    status: string;
  }>;
}

const TEST_TENANTS: TestTenant[] = [
  // =========================================================================
  // 1. TechFlow SaaS — growth plan, active (converted Nov 2025) — Stripe
  // =========================================================================
  {
    name: "TechFlow SaaS",
    slug: "techflow",
    domain: "techflow.test",
    plan: "growth",
    billingProvider: "stripe",
    subscription: {
      status: "active",
      subscriptionId: "sub_techflow_growth",
      trialEndsAt: date(2025, 11, 19),
      billingStartDate: date(2025, 11, 15),
      billingEndDate: date(2026, 3, 15),
    },
    billingEvents: [
      { event: "trial_started", plan: "growth", amount: 0, timestamp: date(2025, 11, 5) },
      { event: "trial_conversion", plan: "growth", amount: 2499, timestamp: date(2025, 11, 15), newPlan: "growth", transactionId: "txn_techflow_1" },
      { event: "renew", plan: "growth", amount: 2499, timestamp: date(2025, 12, 15), transactionId: "txn_techflow_2" },
      { event: "renew", plan: "growth", amount: 2499, timestamp: date(2026, 1, 15), transactionId: "txn_techflow_3" },
      { event: "renew", plan: "growth", amount: 2499, timestamp: date(2026, 2, 15), transactionId: "txn_techflow_4" },
    ],
    users: [
      { email: "alex@techflow.test", name: "Alex Chen", role: "owner" },
      { email: "maria@techflow.test", name: "Maria Santos", role: "admin" },
      { email: "john@techflow.test", name: "John Dela Cruz", role: "member" },
    ],
    affiliates: [
      { email: "jamie@email.com", name: "Jamie Wilson", status: "active", promotionChannel: "YouTube" },
      { email: "sarah@email.com", name: "Sarah Miller", status: "active", promotionChannel: "Blog" },
      { email: "mike@email.com", name: "Mike Johnson", status: "pending", promotionChannel: "Social Media" },
      { email: "lisa@email.com", name: "Lisa Brown", status: "active", promotionChannel: "Email Marketing" },
    ],
    campaigns: [
      { name: "Growth Plan Referral", description: "Refer users to our Growth plan", commissionType: "percentage", commissionValue: 20, recurring: true, status: "active" },
      { name: "Pro Plan Launch", description: "Promote our Pro plan launch", commissionType: "percentage", commissionValue: 30, recurring: true, status: "active" },
      { name: "Enterprise Deal", description: "Enterprise tier referrals", commissionType: "fixed", commissionValue: 100, recurring: false, status: "active" },
    ],
  },

  // =========================================================================
  // 2. GHL Agency Pro — scale plan, active (converted Nov 2025) — SaligPay (billing provider)
  // =========================================================================
  {
    name: "GHL Agency Pro",
    slug: "ghlagency",
    domain: "ghlagency.test",
    plan: "scale",
    billingProvider: "saligpay",
    subscription: {
      status: "active",
      subscriptionId: "sub_ghl_scale",
      trialEndsAt: date(2025, 11, 26),
      billingStartDate: date(2025, 11, 22),
      billingEndDate: date(2026, 3, 22),
    },
    billingEvents: [
      { event: "trial_started", plan: "scale", amount: 0, timestamp: date(2025, 11, 12) },
      { event: "trial_conversion", plan: "scale", amount: 4999, timestamp: date(2025, 11, 22), newPlan: "scale", transactionId: "txn_ghl_1" },
      { event: "renew", plan: "scale", amount: 4999, timestamp: date(2025, 12, 22), transactionId: "txn_ghl_2" },
      { event: "renew", plan: "scale", amount: 4999, timestamp: date(2026, 1, 22), transactionId: "txn_ghl_3" },
      { event: "renew", plan: "scale", amount: 4999, timestamp: date(2026, 2, 22), transactionId: "txn_ghl_4" },
    ],
    users: [
      { email: "owner@ghlagency.test", name: "Patricia Lim", role: "owner" },
      { email: "ops@ghlagency.test", name: "Roberto Diaz", role: "admin" },
    ],
    affiliates: [
      { email: "mark.t@digitalgen.test", name: "Mark Thompson", status: "active", promotionChannel: "YouTube" },
      { email: "jen.k@smartsol.test", name: "Jennifer Kim", status: "active", promotionChannel: "Facebook Group" },
    ],
    campaigns: [
      { name: "Agency Starter", description: "Refer new agencies", commissionType: "percentage", commissionValue: 15, recurring: true, status: "active" },
      { name: "Enterprise Agency", description: "Enterprise agency referrals", commissionType: "fixed", commissionValue: 200, recurring: false, status: "active" },
    ],
  },

  // =========================================================================
  // 3. Digital Marketing Hub — starter plan, free (no subscription)
  // =========================================================================
  {
    name: "Digital Marketing Hub",
    slug: "digi",
    domain: "digi.test",
    plan: "starter",
    billingEvents: [
      { event: "subscription_started", plan: "starter", amount: 0, timestamp: date(2025, 11, 20) },
    ],
    users: [
      { email: "admin@digimark.test", name: "David Wong", role: "owner" },
    ],
    affiliates: [
      { email: "tom.hanks@influencer.test", name: "Tom Richards", status: "active", promotionChannel: "Instagram" },
    ],
    campaigns: [
      { name: "Monthly Subscription", description: "Monthly plan referrals", commissionType: "percentage", commissionValue: 25, recurring: true, status: "active" },
    ],
  },

  // =========================================================================
  // 4. Manila SaaS Labs — growth plan, past_due (converted Dec 2025) — SaligPay (billing provider)
  // =========================================================================
  {
    name: "Manila SaaS Labs",
    slug: "manila-saas",
    domain: "manila-saas.test",
    plan: "growth",
    billingProvider: "saligpay",
    subscription: {
      status: "past_due",
      subscriptionId: "sub_manila_growth",
      trialEndsAt: date(2025, 12, 17),
      billingStartDate: date(2025, 12, 10),
      billingEndDate: date(2026, 2, 10),
    },
    billingEvents: [
      { event: "trial_started", plan: "growth", amount: 0, timestamp: date(2025, 12, 3) },
      { event: "trial_conversion", plan: "growth", amount: 2499, timestamp: date(2025, 12, 10), newPlan: "growth", transactionId: "txn_manila_1" },
      { event: "renew", plan: "growth", amount: 2499, timestamp: date(2026, 1, 10), transactionId: "txn_manila_2" },
    ],
    users: [
      { email: "angelo@manilasaas.test", name: "Angelo Reyes", role: "owner" },
      { email: "grace@manilasaas.test", name: "Grace Cruz", role: "admin" },
    ],
    affiliates: [
      { email: "carlo.m@saaspro.test", name: "Carlo Mendoza", status: "active", promotionChannel: "LinkedIn" },
      { email: "anna.l@digimarket.test", name: "Anna Lim", status: "pending", promotionChannel: "TikTok" },
    ],
    campaigns: [
      { name: "SaaS Referral Program", description: "Refer SaaS customers", commissionType: "percentage", commissionValue: 20, recurring: true, status: "active" },
    ],
  },

  // =========================================================================
  // 5. Cebu Digital Agency — scale plan, cancelled (Dec 2025)
  // =========================================================================
  {
    name: "Cebu Digital Agency",
    slug: "cebu-digital",
    domain: "cebu-digital.test",
    plan: "scale",
    subscription: {
      status: "cancelled",
      subscriptionId: "sub_cebu_scale",
      trialEndsAt: date(2025, 11, 22),
      billingStartDate: date(2025, 11, 18),
      billingEndDate: date(2026, 1, 18),
      cancellationDate: date(2025, 12, 20),
      deletionScheduledDate: date(2026, 2, 18),
    },
    billingEvents: [
      { event: "trial_started", plan: "scale", amount: 0, timestamp: date(2025, 11, 8) },
      { event: "trial_conversion", plan: "scale", amount: 4999, timestamp: date(2025, 11, 18), newPlan: "scale", transactionId: "txn_cebu_1" },
      { event: "cancel", plan: "scale", amount: 0, timestamp: date(2025, 12, 20), transactionId: "txn_cebu_cancel" },
    ],
    users: [
      { email: "rachel@cebudigital.test", name: "Rachel Torres", role: "owner" },
    ],
    affiliates: [
      { email: "daniel.g@cebudigi.test", name: "Daniel Garcia", status: "active", promotionChannel: "Facebook Ads" },
      { email: "michelle.s@creativeph.test", name: "Michelle Santos", status: "active", promotionChannel: "Blog" },
    ],
    campaigns: [
      { name: "Agency Growth", description: "Grow your agency referrals", commissionType: "fixed", commissionValue: 150, recurring: false, status: "paused" },
      { name: "Premium Referrals", description: "High-value client referrals", commissionType: "percentage", commissionValue: 25, recurring: true, status: "paused" },
    ],
  },

  // =========================================================================
  // 6. GrowthHacks PH — growth plan, active (converted Jan 2026) — Stripe
  // =========================================================================
  {
    name: "GrowthHacks PH",
    slug: "growthhacks",
    domain: "growthhacks.test",
    plan: "growth",
    billingProvider: "stripe",
    subscription: {
      status: "active",
      subscriptionId: "sub_growthhacks_growth",
      trialEndsAt: date(2026, 1, 19),
      billingStartDate: date(2026, 1, 15),
      billingEndDate: date(2026, 3, 15),
    },
    billingEvents: [
      { event: "trial_started", plan: "growth", amount: 0, timestamp: date(2026, 1, 5) },
      { event: "trial_conversion", plan: "growth", amount: 2499, timestamp: date(2026, 1, 15), newPlan: "growth", transactionId: "txn_gh_1" },
      { event: "renew", plan: "growth", amount: 2499, timestamp: date(2026, 2, 15), transactionId: "txn_gh_2" },
    ],
    users: [
      { email: "kevin@growthhacks.test", name: "Kevin Aquino", role: "owner" },
      { email: "tanya@growthhacks.test", name: "Tanya Reyes", role: "member" },
    ],
    affiliates: [
      { email: "paolo.v@growthph.test", name: "Paolo Villanueva", status: "active", promotionChannel: "Twitter/X" },
    ],
    campaigns: [
      { name: "Growth Referral", description: "Refer growth-focused SaaS users", commissionType: "percentage", commissionValue: 20, recurring: true, status: "active" },
    ],
  },

  // =========================================================================
  // 7. Pinoy Marketing Co — starter plan, currently in trial (Mar 2026)
  // =========================================================================
  {
    name: "Pinoy Marketing Co",
    slug: "pinoy-mktg",
    domain: "pinoy-mktg.test",
    plan: "starter",
    subscription: {
      trialEndsAt: date(2026, 3, 29), // Still in trial
    },
    billingEvents: [
      { event: "trial_started", plan: "starter", amount: 0, timestamp: date(2026, 3, 15) },
    ],
    users: [
      { email: "luis@pinoymarketing.test", name: "Luis Fernandez", role: "owner" },
    ],
    affiliates: [],
    campaigns: [
      { name: "Welcome Campaign", description: "Initial affiliate campaign", commissionType: "percentage", commissionValue: 15, recurring: true, status: "active" },
    ],
  },

  // =========================================================================
  // 8. SEAsia Tech Ventures — scale plan, active (converted Dec 2025) — SaligPay (billing provider)
  // =========================================================================
  {
    name: "SEAsia Tech Ventures",
    slug: "seasia-tech",
    domain: "seasia-tech.test",
    plan: "scale",
    billingProvider: "saligpay",
    subscription: {
      status: "active",
      subscriptionId: "sub_seasia_scale",
      trialEndsAt: date(2025, 12, 29),
      billingStartDate: date(2025, 12, 25),
      billingEndDate: date(2026, 3, 25),
    },
    billingEvents: [
      { event: "trial_started", plan: "scale", amount: 0, timestamp: date(2025, 12, 15) },
      { event: "trial_conversion", plan: "scale", amount: 4999, timestamp: date(2025, 12, 25), newPlan: "scale", transactionId: "txn_seasia_1" },
      { event: "renew", plan: "scale", amount: 4999, timestamp: date(2026, 1, 25), transactionId: "txn_seasia_2" },
      { event: "renew", plan: "scale", amount: 4999, timestamp: date(2026, 2, 25), transactionId: "txn_seasia_3" },
    ],
    users: [
      { email: "brenda@seasiatech.test", name: "Brenda Ng", role: "owner" },
      { email: "raj@seasiatech.test", name: "Raj Patel", role: "admin" },
    ],
    affiliates: [
      { email: "chen.w@seasia.test", name: "Chen Wei", status: "active", promotionChannel: "LinkedIn" },
      { email: "priya.s@seasia.test", name: "Priya Sharma", status: "active", promotionChannel: "Blog" },
      { email: "ahmed.h@seasia.test", name: "Ahmed Hassan", status: "suspended", promotionChannel: "Email" },
    ],
    campaigns: [
      { name: "Enterprise SaaS", description: "Enterprise software referrals", commissionType: "fixed", commissionValue: 300, recurring: false, status: "active" },
      { name: "Startup Deals", description: "Startup plan referrals", commissionType: "percentage", commissionValue: 15, recurring: true, status: "active" },
    ],
  },

  // =========================================================================
  // 9. Bicol Digital Solutions — growth plan, active (converted Nov 2025) — Stripe
  // =========================================================================
  {
    name: "Bicol Digital Solutions",
    slug: "bicol-digital",
    domain: "bicol-digital.test",
    plan: "growth",
    billingProvider: "stripe",
    subscription: {
      status: "active",
      subscriptionId: "sub_bicol_growth",
      trialEndsAt: date(2025, 12, 9),
      billingStartDate: date(2025, 12, 2),
      billingEndDate: date(2026, 3, 2),
    },
    billingEvents: [
      { event: "trial_started", plan: "growth", amount: 0, timestamp: date(2025, 11, 25) },
      { event: "trial_conversion", plan: "growth", amount: 2499, timestamp: date(2025, 12, 2), newPlan: "growth", transactionId: "txn_bicol_1" },
      { event: "renew", plan: "growth", amount: 2499, timestamp: date(2026, 1, 2), transactionId: "txn_bicol_2" },
      { event: "renew", plan: "growth", amount: 2499, timestamp: date(2026, 2, 2), transactionId: "txn_bicol_3" },
    ],
    users: [
      { email: "marco@bicoldigital.test", name: "Marco Imperial", role: "owner" },
    ],
    affiliates: [
      { email: "rosa.d@bicoldigi.test", name: "Rosa Dela Torre", status: "active", promotionChannel: "Facebook Group" },
      { email: "jose.r@bicoldigi.test", name: "Jose Rizalino", status: "active", promotionChannel: "YouTube" },
    ],
    campaigns: [
      { name: "Digital Products Referral", description: "Digital product affiliate program", commissionType: "percentage", commissionValue: 18, recurring: true, status: "active" },
    ],
  },
];

// Platform Admin tenant (special - manages all tenants)
const PLATFORM_ADMIN = {
  name: "Salig Affiliate Platform",
  slug: "salig-platform",
  domain: "salig-platform.test",
  users: [
    { email: "admin@saligaffiliate.com", name: "Platform Admin", role: "admin" },
  ],
};

/**
 * Pre-computed password hash for "TestPass123!" using Better Auth's scrypt.
 * Used for affiliate accounts (not Better Auth — those use the HTTP signup).
 */
const TEST_PASSWORD_HASH = "b1fb84d0f1c6feb781d661faecc3eeb6:4840a3170ce388473977f0fef10160e603fc9d95a74f55b2bfbf7626d0879e545a1fe515d12b36f0230bce85f6d4f6de3cf8f98f9a1daca3deeefd06e76a2000";

function getTestPasswordHash(): string {
  return TEST_PASSWORD_HASH;
}

/**
 * Generate a unique referral code for an affiliate.
 */
function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(array[i] % chars.length);
  }
  return code;
}

/**
 * Generate a unique slug from a company name.
 */
function generateUniqueSlug(companyName: string, existingSlugs: Set<string>): string {
  const baseSlug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  existingSlugs.add(slug);
  return slug;
}

/**
 * Generate random date within a range.
 */
function randomDate(start: Date, end: Date): number {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).getTime();
}

/**
 * Result type for seeding operations
 */
interface SeedResult {
  success: boolean;
  credentials: {
    tenants: Array<{
      name: string;
      slug: string;
      plan: string;
      users: Array<{
        email: string;
        password: string;
        role: string;
        name: string;
      }>;
    }>;
    platformAdmin: {
      email: string;
      password: string;
      role: string;
      name: string;
    };
    affiliates: Array<{
      tenantSlug: string;
      email: string;
      password: string;
      name: string;
      status: string;
      referralCode: string;
    }>;
  };
  stats: {
    tenantsCreated: number;
    usersCreated: number;
    affiliatesCreated: number;
    campaignsCreated: number;
    referralLinksCreated: number;
    clicksCreated: number;
    conversionsCreated: number;
    commissionsCreated: number;
    payoutBatchesCreated: number;
    payoutsCreated: number;
    brandAssetsCreated: number;
    billingHistoryCreated: number;
    auditLogsCreated: number;
  };
  errors: string[];
}

/**
 * Clear all existing test data.
 * WARNING: This will delete all data from the database!
 */
export const clearAllTestData = internalMutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    deleted: v.object({
      tenants: v.number(),
      users: v.number(),
      affiliates: v.number(),
      campaigns: v.number(),
      commissions: v.number(),
      conversions: v.number(),
      clicks: v.number(),
      payouts: v.number(),
      payoutBatches: v.number(),
      referralLinks: v.number(),
      auditLogs: v.number(),
      brandAssets: v.number(),
      billingHistory: v.number(),
      emails: v.number(),
      affiliateSessions: v.number(),
      authUsers: v.number(),
      authAccounts: v.number(),
      referralLeads: v.number(),
      referralPings: v.number(),
      trackingPings: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const deleted = {
      tenants: 0,
      users: 0,
      affiliates: 0,
      campaigns: 0,
      commissions: 0,
      conversions: 0,
      clicks: 0,
      payouts: 0,
      payoutBatches: 0,
      referralLinks: 0,
      auditLogs: 0,
      brandAssets: 0,
      billingHistory: 0,
      emails: 0,
      affiliateSessions: 0,
      authUsers: 0,
      authAccounts: 0,
      referralLeads: 0,
      referralPings: 0,
      trackingPings: 0,
    };

    // Delete in order respecting foreign key dependencies
    // Start with tables that have no dependencies
    
    // Delete Better Auth accounts first (referenced by users)
    // Using type assertion for Better Auth tables
    const accounts = await (ctx.db as any).query("account").collect();
    for (const account of accounts) {
      await (ctx.db as any).delete(account._id);
      deleted.authAccounts++;
    }

    // Delete Better Auth users
    const authUsers = await (ctx.db as any).query("user").collect();
    for (const user of authUsers) {
      await (ctx.db as any).delete(user._id);
      deleted.authUsers++;
    }

    // Delete affiliate sessions
    const sessions = await ctx.db.query("affiliateSessions").collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
      deleted.affiliateSessions++;
    }

    // Delete audit logs
    const auditLogs = await ctx.db.query("auditLogs").collect();
    for (const log of auditLogs) {
      await ctx.db.delete(log._id);
      deleted.auditLogs++;
    }

    // Delete emails
    const emails = await ctx.db.query("emails").collect();
    for (const email of emails) {
      await ctx.db.delete(email._id);
      deleted.emails++;
    }

    // Delete billing history
    const billingHistory = await ctx.db.query("billingHistory").collect();
    for (const bill of billingHistory) {
      await ctx.db.delete(bill._id);
      deleted.billingHistory++;
    }

    // Delete brand assets
    const brandAssets = await ctx.db.query("brandAssets").collect();
    for (const asset of brandAssets) {
      await ctx.db.delete(asset._id);
      deleted.brandAssets++;
    }

    // Delete clicks
    const clicks = await ctx.db.query("clicks").collect();
    for (const click of clicks) {
      await ctx.db.delete(click._id);
      deleted.clicks++;
    }

    // Delete conversions
    const conversions = await ctx.db.query("conversions").collect();
    for (const conversion of conversions) {
      await ctx.db.delete(conversion._id);
      deleted.conversions++;
    }

    // Delete commissions
    const commissions = await ctx.db.query("commissions").collect();
    for (const commission of commissions) {
      await ctx.db.delete(commission._id);
      deleted.commissions++;
    }

    // Delete payouts
    const payouts = await ctx.db.query("payouts").collect();
    for (const payout of payouts) {
      await ctx.db.delete(payout._id);
      deleted.payouts++;
    }

    // Delete payout batches
    const payoutBatches = await ctx.db.query("payoutBatches").collect();
    for (const batch of payoutBatches) {
      await ctx.db.delete(batch._id);
      deleted.payoutBatches++;
    }

    // Delete referral links
    const referralLinks = await ctx.db.query("referralLinks").collect();
    for (const link of referralLinks) {
      await ctx.db.delete(link._id);
      deleted.referralLinks++;
    }

    // Delete referral leads (new table)
    const referralLeads = await ctx.db.query("referralLeads").take(500);
    for (const lead of referralLeads) {
      await ctx.db.delete(lead._id);
      deleted.referralLeads++;
    }

    // Delete referral pings (new table)
    const referralPings = await ctx.db.query("referralPings").take(500);
    for (const ping of referralPings) {
      await ctx.db.delete(ping._id);
      deleted.referralPings++;
    }

    // Delete tracking pings (existing table)
    const trackingPings = await ctx.db.query("trackingPings").take(500);
    for (const ping of trackingPings) {
      await ctx.db.delete(ping._id);
      deleted.trackingPings++;
    }

    // Delete affiliates
    const affiliates = await ctx.db.query("affiliates").collect();
    for (const affiliate of affiliates) {
      await ctx.db.delete(affiliate._id);
      deleted.affiliates++;
    }

    // Delete campaigns
    const campaigns = await ctx.db.query("campaigns").collect();
    for (const campaign of campaigns) {
      await ctx.db.delete(campaign._id);
      deleted.campaigns++;
    }

    // Delete team invitations
    const invitations = await ctx.db.query("teamInvitations").collect();
    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
    }

    // Delete users
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.delete(user._id);
      deleted.users++;
    }

    // Delete tenants (last - everything else should be deleted first)
    const tenants = await ctx.db.query("tenants").collect();
    for (const tenant of tenants) {
      await ctx.db.delete(tenant._id);
      deleted.tenants++;
    }

    return {
      success: true,
      deleted,
    };
  },
});

/**
 * Create a single test tenant with users.
 * Returns the tenant ID and created user IDs.
 */
export const createTestTenantWithUsers = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    domain: v.string(),
    plan: v.string(),
    users: v.array(v.object({
      email: v.string(),
      name: v.string(),
      role: v.string(),
    })),
    passwordHash: v.string(),
  },
  returns: v.object({
    tenantId: v.id("tenants"),
    userIds: v.array(v.id("users")),
  }),
  handler: async (ctx, args) => {
    // Check if tenant already exists
    const existingTenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existingTenant) {
      throw new Error(`Tenant with slug "${args.slug}" already exists`);
    }

    // Create tenant
    const trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
    const tenantId = await ctx.db.insert("tenants", {
      name: args.name,
      slug: args.slug,
      domain: args.domain,
      plan: args.plan,
      trialEndsAt,
      status: "active",
      trackingVerifiedAt: Date.now(),
      branding: {
        portalName: args.name,
        primaryColor: "#1c2260",
      },
    });

    // Create users first so we can reference the owner as the actor
    const userIds: Id<"users">[] = [];
    for (const user of args.users) {
      const userId = await ctx.db.insert("users", {
        tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: true,
      });
      userIds.push(userId);

      // Create audit log for user creation
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "user_created",
        entityType: "user",
        entityId: userId,
        actorId: userIds[0],
        actorType: "user",
        newValue: { email: user.email, name: user.name, role: user.role },
      });
    }

    // Create audit log for tenant creation (after users so we have an actor)
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "tenant_created",
      entityType: "tenant",
      entityId: tenantId,
      actorId: userIds[0],
      actorType: "user",
      newValue: { name: args.name, slug: args.slug, plan: args.plan },
    });

    return { tenantId, userIds };
  },
});

/**
 * Create a test affiliate with password hash.
 */
export const createTestAffiliate = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    email: v.string(),
    name: v.string(),
    status: v.string(),
    promotionChannel: v.optional(v.string()),
    passwordHash: v.string(),
    uniqueCode: v.string(),
  },
  returns: v.id("affiliates"),
  handler: async (ctx, args) => {
    // Check if affiliate already exists
    const existingAffiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", args.tenantId).eq("email", args.email)
      )
      .first();

    if (existingAffiliate) {
      throw new Error(`Affiliate with email "${args.email}" already exists in this tenant`);
    }

    // Split name into firstName and lastName
    const nameParts = args.name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const affiliateId = await ctx.db.insert("affiliates", {
      tenantId: args.tenantId,
      email: args.email,
      firstName,
      lastName,
      name: args.name,
      uniqueCode: args.uniqueCode,
      status: args.status,
      passwordHash: args.passwordHash,
      promotionChannel: args.promotionChannel,
    });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "affiliate_created",
      entityType: "affiliate",
      entityId: affiliateId,
      actorType: "system",
      newValue: { email: args.email, name: args.name, uniqueCode: args.uniqueCode, status: args.status },
    });

    return affiliateId;
  },
});

/**
 * Create a test campaign.
 */
export const createTestCampaign = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    description: v.optional(v.string()),
    commissionType: v.string(),
    commissionValue: v.number(),
    recurringCommission: v.boolean(),
    recurringRate: v.optional(v.number()),
    recurringRateType: v.optional(v.string()),
    status: v.string(),
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    const campaignId = await ctx.db.insert("campaigns", {
      tenantId: args.tenantId,
      name: args.name,
      slug: args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      description: args.description,
      commissionType: args.commissionType,
      commissionValue: args.commissionValue,
      recurringCommission: args.recurringCommission,
      recurringRate: args.recurringRate,
      recurringRateType: args.recurringRateType,
      cookieDuration: 30,
      autoApproveCommissions: false,
      status: args.status,
    });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "campaign_created",
      entityType: "campaign",
      entityId: campaignId,
      actorType: "system",
      newValue: { name: args.name, commissionType: args.commissionType, commissionValue: args.commissionValue },
    });

    return campaignId;
  },
});

/**
 * Create a referral link for an affiliate.
 */
export const createTestReferralLink = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    campaignId: v.optional(v.id("campaigns")),
    code: v.string(),
  },
  returns: v.id("referralLinks"),
  handler: async (ctx, args) => {
    const referralLinkId = await ctx.db.insert("referralLinks", {
      tenantId: args.tenantId,
      affiliateId: args.affiliateId,
      campaignId: args.campaignId,
      code: args.code,
    });

    return referralLinkId;
  },
});

/**
 * Create a click record.
 */
export const createTestClick = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    referralLinkId: v.id("referralLinks"),
    affiliateId: v.id("affiliates"),
    campaignId: v.optional(v.id("campaigns")),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
    referrer: v.optional(v.string()),
    timestamp: v.number(),
  },
  returns: v.id("clicks"),
  handler: async (ctx, args) => {
    const dedupeKey = `${args.referralLinkId}-${args.ipAddress}-${args.timestamp}`;
    
    const clickId = await ctx.db.insert("clicks", {
      tenantId: args.tenantId,
      referralLinkId: args.referralLinkId,
      affiliateId: args.affiliateId,
      campaignId: args.campaignId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      referrer: args.referrer,
      dedupeKey,
    });

    return clickId;
  },
});

/**
 * Create a conversion record.
 */
export const createTestConversion = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    referralLinkId: v.optional(v.id("referralLinks")),
    clickId: v.optional(v.id("clicks")),
    campaignId: v.optional(v.id("campaigns")),
    customerEmail: v.optional(v.string()),
    amount: v.number(),
    status: v.string(),
    ipAddress: v.optional(v.string()),
    timestamp: v.number(),
    attributionSource: v.optional(v.string()),
    isSelfReferral: v.optional(v.boolean()),
  },
  returns: v.id("conversions"),
  handler: async (ctx, args) => {
    const conversionId = await ctx.db.insert("conversions", {
      tenantId: args.tenantId,
      affiliateId: args.affiliateId,
      referralLinkId: args.referralLinkId,
      clickId: args.clickId,
      campaignId: args.campaignId,
      customerEmail: args.customerEmail,
      amount: args.amount,
      status: args.status,
      ipAddress: args.ipAddress,
      attributionSource: args.attributionSource as "cookie" | "webhook" | "organic" | undefined,
      isSelfReferral: args.isSelfReferral,
      metadata: {
        orderId: `ORD-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        planId: args.campaignId ? "default-plan" : undefined,
      },
    });

    return conversionId;
  },
});

/**
 * Create a commission record.
 */
export const createTestCommission = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
    conversionId: v.optional(v.id("conversions")),
    amount: v.number(),
    status: v.string(),
    isSelfReferral: v.optional(v.boolean()),
    fraudIndicators: v.optional(v.array(v.string())),
    transactionId: v.optional(v.string()),
    timestamp: v.number(),
  },
  returns: v.id("commissions"),
  handler: async (ctx, args) => {
    const commissionId = await ctx.db.insert("commissions", {
      tenantId: args.tenantId,
      affiliateId: args.affiliateId,
      campaignId: args.campaignId,
      conversionId: args.conversionId,
      amount: args.amount,
      status: args.status,
      isSelfReferral: args.isSelfReferral,
      fraudIndicators: args.fraudIndicators,
      transactionId: args.transactionId,
      eventMetadata: {
        source: "test_data",
        timestamp: args.timestamp,
      },
    });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "commission_created",
      entityType: "commission",
      entityId: commissionId,
      actorType: "system",
      newValue: { affiliateId: args.affiliateId, amount: args.amount, status: args.status },
    });

    return commissionId;
  },
});

/**
 * Create a payout batch.
 */
export const createTestPayoutBatch = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    totalAmount: v.number(),
    affiliateCount: v.number(),
    status: v.string(),
    generatedAt: v.number(),
    completedAt: v.optional(v.number()),
  },
  returns: v.id("payoutBatches"),
  handler: async (ctx, args) => {
    const batchId = await ctx.db.insert("payoutBatches", {
      tenantId: args.tenantId,
      totalAmount: args.totalAmount,
      affiliateCount: args.affiliateCount,
      status: args.status,
      generatedAt: args.generatedAt,
      completedAt: args.completedAt,
    });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "payout_batch_created",
      entityType: "payoutBatch",
      entityId: batchId,
      actorType: "system",
      newValue: { totalAmount: args.totalAmount, affiliateCount: args.affiliateCount, status: args.status },
    });

    return batchId;
  },
});

/**
 * Create a payout record.
 */
export const createTestPayout = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    batchId: v.id("payoutBatches"),
    amount: v.number(),
    status: v.string(),
    paymentReference: v.optional(v.string()),
    paidAt: v.optional(v.number()),
  },
  returns: v.id("payouts"),
  handler: async (ctx, args) => {
    const payoutId = await ctx.db.insert("payouts", {
      tenantId: args.tenantId,
      affiliateId: args.affiliateId,
      batchId: args.batchId,
      amount: args.amount,
      status: args.status,
      paymentReference: args.paymentReference,
      paidAt: args.paidAt,
    });

    return payoutId;
  },
});

/**
 * Create a brand asset.
 */
export const createTestBrandAsset = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    type: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    textContent: v.optional(v.string()),
    category: v.optional(v.string()),
    isActive: v.boolean(),
  },
  returns: v.id("brandAssets"),
  handler: async (ctx, args) => {
    const assetId = await ctx.db.insert("brandAssets", {
      tenantId: args.tenantId,
      type: args.type as "logo" | "banner" | "product-image" | "copy-text",
      title: args.title,
      description: args.description,
      textContent: args.textContent,
      category: args.category,
      isActive: args.isActive,
      sortOrder: 0,
    });

    return assetId;
  },
});

/**
 * Create billing history entry.
 */
export const createTestBillingHistory = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    event: v.string(),
    plan: v.optional(v.string()),
    amount: v.optional(v.number()),
    timestamp: v.number(),
    transactionId: v.optional(v.string()),
    mockTransaction: v.optional(v.boolean()),
  },
  returns: v.id("billingHistory"),
  handler: async (ctx, args) => {
    const historyId = await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: args.event,
      plan: args.plan,
      amount: args.amount,
      timestamp: args.timestamp,
      transactionId: args.transactionId,
      mockTransaction: args.mockTransaction,
    });

    return historyId;
  },
});

/**
 * Seed all test data.
 * This is the main function to call to populate the database with test data.
 */
export const seedAllTestData = internalMutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    credentials: v.object({
      tenants: v.array(v.object({
        name: v.string(),
        slug: v.string(),
        plan: v.string(),
        users: v.array(v.object({
          email: v.string(),
          password: v.string(),
          role: v.string(),
          name: v.string(),
        })),
      })),
      platformAdmin: v.object({
        email: v.string(),
        password: v.string(),
        role: v.string(),
        name: v.string(),
      }),
      affiliates: v.array(v.object({
        tenantSlug: v.string(),
        email: v.string(),
        password: v.string(),
        name: v.string(),
        status: v.string(),
        referralCode: v.string(),
      })),
    }),
    stats: v.object({
      tenantsCreated: v.number(),
      usersCreated: v.number(),
      affiliatesCreated: v.number(),
      campaignsCreated: v.number(),
      referralLinksCreated: v.number(),
      clicksCreated: v.number(),
      conversionsCreated: v.number(),
      commissionsCreated: v.number(),
      payoutBatchesCreated: v.number(),
      payoutsCreated: v.number(),
      brandAssetsCreated: v.number(),
      billingHistoryCreated: v.number(),
      auditLogsCreated: v.number(),
      referralLeadsCreated: v.number(),
      referralPingsCreated: v.number(),
    }),
    errors: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const TEST_PASSWORD = "TestPass123!";
    const passwordHash = getTestPasswordHash();
    const credentials = {
      tenants: [] as Array<{
        name: string;
        slug: string;
        plan: string;
        users: Array<{
          email: string;
          password: string;
          role: string;
          name: string;
        }>;
      }>,
      platformAdmin: {
        email: PLATFORM_ADMIN.users[0].email,
        password: TEST_PASSWORD,
        role: PLATFORM_ADMIN.users[0].role,
        name: PLATFORM_ADMIN.users[0].name,
      },
      affiliates: [] as Array<{
        tenantSlug: string;
        email: string;
        password: string;
        name: string;
        status: string;
        referralCode: string;
      }>,
    };

    const stats = {
      tenantsCreated: 0,
      usersCreated: 0,
      affiliatesCreated: 0,
      campaignsCreated: 0,
      referralLinksCreated: 0,
      clicksCreated: 0,
      conversionsCreated: 0,
      commissionsCreated: 0,
      payoutBatchesCreated: 0,
      payoutsCreated: 0,
      brandAssetsCreated: 0,
      billingHistoryCreated: 0,
      auditLogsCreated: 0,
      referralLeadsCreated: 0,
      referralPingsCreated: 0,
    };

    const errors: string[] = [];

    // Collect all slugs to avoid conflicts
    const existingSlugs = new Set<string>();
    const existingTenants = await ctx.db.query("tenants").collect();
    for (const tenant of existingTenants) {
      existingSlugs.add(tenant.slug);
    }

    // Create tenants and their data
    for (const tenantConfig of TEST_TENANTS) {
      try {
        // Generate unique slug
        const slug = generateUniqueSlug(tenantConfig.name, existingSlugs);

        // Create tenant with subscription fields from config
        const sub = tenantConfig.subscription;
        const tenantId = await ctx.db.insert("tenants", {
          name: tenantConfig.name,
          slug,
          domain: tenantConfig.domain,
          plan: tenantConfig.plan,
          trialEndsAt: sub?.trialEndsAt ?? Date.now() + 14 * 24 * 60 * 60 * 1000,
          status: "active",
          trackingVerifiedAt: Date.now(),
          subscriptionStatus: sub?.status,
          subscriptionId: sub?.subscriptionId,
          billingStartDate: sub?.billingStartDate,
          billingEndDate: sub?.billingEndDate,
          cancellationDate: sub?.cancellationDate,
          deletionScheduledDate: sub?.deletionScheduledDate,
          branding: {
            portalName: tenantConfig.name,
            primaryColor: "#1c2260",
          },
        });
        stats.tenantsCreated++;

        // Set up billing provider credentials based on config
        if (tenantConfig.billingProvider === "saligpay") {
          const mockMerchantId = `mock-merchant-${slug}-${Date.now()}`;
          const mockAccessToken = `mock-access-${slug}-${Date.now()}`;
          const mockRefreshToken = `mock-refresh-${slug}-${Date.now()}`;
          await ctx.db.patch(tenantId, {
            billingProvider: "saligpay",
            saligPayCredentials: {
              mode: "mock",
              connectedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // Connected 30 days ago
              mockMerchantId,
              clientId: `mock-client-${slug}`,
              clientSecret: `mock-secret-${slug}`,
              mockAccessToken,
              mockRefreshToken,
              expiresAt: Date.now() + 3600 * 1000,
            },
          });

          await ctx.db.insert("auditLogs", {
            tenantId,
            action: "saligpay_connected",
            entityType: "tenant",
            entityId: tenantId,
            actorType: "system",
            newValue: { mode: "mock", merchantId: mockMerchantId, source: "test_seed" },
          });
          stats.auditLogsCreated++;
        } else if (tenantConfig.billingProvider === "stripe") {
          await ctx.db.patch(tenantId, {
            billingProvider: "stripe",
            stripeAccountId: `acct_${slug.replace(/[^a-z0-9]/g, "")}`,
            stripeCredentials: {
              signingSecret: `whsec_test_${slug}_secret`,
              mode: "live",
              connectedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // Connected 30 days ago
            },
          });

          await ctx.db.insert("auditLogs", {
            tenantId,
            action: "stripe_connected",
            entityType: "tenant",
            entityId: tenantId,
            actorType: "system",
            newValue: { stripeAccountId: `acct_${slug.replace(/[^a-z0-9]/g, "")}`, mode: "live", source: "test_seed" },
          });
          stats.auditLogsCreated++;
        }

        // Create tenant users
        const tenantUsers: Array<{ email: string; name: string; role: string }> = [];
        let ownerUserId: Id<"users"> | undefined;
        for (const user of tenantConfig.users) {
          // Auth users are created via HTTP endpoint (seedAuthUsers action).
          // The auth hook creates a minimal user record; we upsert here with full data.
          
          // Check if user already exists (created by auth hook during seedAuthUsers)
          const existingUser = await ctx.db
            .query("users")
            .withIndex("by_email", (q: any) => q.eq("email", user.email))
            .first();

          let userId: Id<"users">;
          if (existingUser) {
            // Patch existing user with correct tenant, role, etc.
            await ctx.db.patch(existingUser._id, {
              tenantId,
              name: user.name,
              role: user.role,
              emailVerified: true,
            });
            userId = existingUser._id;
          } else {
            // Create user in app's users table
            userId = await ctx.db.insert("users", {
              tenantId,
              email: user.email,
              name: user.name,
              role: user.role,
              emailVerified: true,
            });
          }
          stats.usersCreated++;
          tenantUsers.push(user);

          // Track the owner (first user) as the actor for audit logs
          if (!ownerUserId) ownerUserId = userId;

          await ctx.db.insert("auditLogs", {
            tenantId,
            action: "user_created",
            entityType: "user",
            entityId: userId,
            actorId: ownerUserId,
            actorType: "user",
            newValue: { email: user.email, name: user.name, role: user.role },
          });
          stats.auditLogsCreated++;
        }

        credentials.tenants.push({
          name: tenantConfig.name,
          slug,
          plan: tenantConfig.plan,
          users: tenantUsers.map(u => ({
            email: u.email,
            password: TEST_PASSWORD,
            role: u.role,
            name: u.name,
          })),
        });

        // Create billing history from per-tenant events
        for (const billing of tenantConfig.billingEvents) {
          await ctx.db.insert("billingHistory", {
            tenantId,
            event: billing.event,
            plan: billing.plan,
            amount: billing.amount,
            timestamp: billing.timestamp,
            transactionId: billing.transactionId,
            newPlan: billing.newPlan,
            previousPlan: billing.previousPlan,
            mockTransaction: true,
          });
          stats.billingHistoryCreated++;
        }

        // Create brand assets
        const brandAssets = [
          { type: "logo", title: "Primary Logo", description: "Main company logo", textContent: undefined, category: "main" },
          { type: "copy-text", title: "Welcome Message", description: "Welcome message for affiliates", textContent: "Welcome to our affiliate program! We're excited to have you.", category: "messages" },
          { type: "copy-text", title: "Email Template", description: "Standard email template", textContent: "Check out our latest product!", category: "templates" },
        ];

        for (const asset of brandAssets) {
          await ctx.db.insert("brandAssets", {
            tenantId,
            type: asset.type as "logo" | "banner" | "product-image" | "copy-text",
            title: asset.title,
            description: asset.description,
            textContent: asset.textContent,
            category: asset.category,
            isActive: true,
            sortOrder: 0,
          });
          stats.brandAssetsCreated++;
        }

        // Create campaigns
        const campaignIds: Id<"campaigns">[] = [];
        for (const campaign of tenantConfig.campaigns) {
          const campaignId = await ctx.db.insert("campaigns", {
            tenantId,
            name: campaign.name,
            slug: campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
            description: campaign.description,
            commissionType: campaign.commissionType,
            commissionValue: campaign.commissionValue,
            recurringCommission: campaign.recurring,
            recurringRate: campaign.recurring ? campaign.commissionValue : undefined,
            recurringRateType: campaign.recurring ? campaign.commissionType : undefined,
            cookieDuration: 30,
            autoApproveCommissions: false,
            status: campaign.status,
          });
          campaignIds.push(campaignId);
          stats.campaignsCreated++;

          await ctx.db.insert("auditLogs", {
            tenantId,
            action: "campaign_created",
            entityType: "campaign",
            entityId: campaignId,
            actorId: ownerUserId,
            actorType: "user",
            newValue: { name: campaign.name },
          });
          stats.auditLogsCreated++;
        }

        // Create affiliates with referral links
        for (const affiliate of tenantConfig.affiliates) {
          const uniqueCode = generateReferralCode();
          // Split name into firstName and lastName
          const nameParts = affiliate.name.split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";
          const affiliateId = await ctx.db.insert("affiliates", {
            tenantId,
            email: affiliate.email,
            firstName,
            lastName,
            name: affiliate.name,
            uniqueCode,
            status: affiliate.status,
            passwordHash,
            promotionChannel: affiliate.promotionChannel,
          });
          stats.affiliatesCreated++;

          await ctx.db.insert("auditLogs", {
            tenantId,
            action: "affiliate_created",
            entityType: "affiliate",
            entityId: affiliateId,
            actorId: ownerUserId,
            actorType: "user",
            newValue: { email: affiliate.email, name: affiliate.name },
          });
          stats.auditLogsCreated++;

          credentials.affiliates.push({
            tenantSlug: slug,
            email: affiliate.email,
            password: TEST_PASSWORD,
            name: affiliate.name,
            status: affiliate.status,
            referralCode: uniqueCode,
          });

          // Create referral links for active affiliates
          if (affiliate.status === "active") {
            // Create a general referral link
            const referralLinkId = await ctx.db.insert("referralLinks", {
              tenantId,
              affiliateId,
              campaignId: campaignIds[0], // Link to first campaign
              code: uniqueCode,
            });
            stats.referralLinksCreated++;

            // Generate clicks, conversions, and commissions for active affiliates
            const now = Date.now();
            const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;

            // Generate 10-50 clicks per affiliate
            const clickCount = 10 + Math.floor(Math.random() * 40);
            const clickTimestamps: number[] = [];
            
            for (let i = 0; i < clickCount; i++) {
              const timestamp = randomDate(new Date(threeMonthsAgo), new Date(now));
              const clickId = await ctx.db.insert("clicks", {
                tenantId,
                referralLinkId,
                affiliateId,
                campaignId: campaignIds[Math.floor(Math.random() * campaignIds.length)],
                ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                userAgent: "Mozilla/5.0 (Test Browser)",
                referrer: "https://google.com",
                dedupeKey: `${referralLinkId}-click-${timestamp}`,
              });
              stats.clicksCreated++;
              clickTimestamps.push(timestamp);
            }

            // Generate 1-5 conversions per affiliate (conversion rate ~10%)
            const conversionCount = 1 + Math.floor(Math.random() * 5);
            const conversionIds: Id<"conversions">[] = [];
            
            for (let i = 0; i < conversionCount; i++) {
              const timestamp = clickTimestamps[i % clickTimestamps.length] + 1000; // After click
              const campaign = campaignIds[Math.floor(Math.random() * campaignIds.length)];
              const campaignData = tenantConfig.campaigns.find((c, idx) => campaignIds[idx] === campaign);
              const amount = 29 + Math.floor(Math.random() * 200); // $29-$229
              
              const conversionId = await ctx.db.insert("conversions", {
                tenantId,
                affiliateId,
                referralLinkId,
                campaignId: campaign,
                customerEmail: `customer${i + 1}@example.com`,
                amount,
                status: "completed",
                ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                attributionSource: "cookie",
                isSelfReferral: false,
                metadata: {
                  orderId: `ORD-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                  planId: "default-plan",
                },
              });
              conversionIds.push(conversionId);
              stats.conversionsCreated++;

              // Calculate commission
              const commissionValue = campaignData?.commissionType === "percentage"
                ? (amount * campaignData.commissionValue) / 100
                : campaignData?.commissionValue || 0;

              // Determine commission status (mix of pending, approved, paid)
              const statuses = ["pending", "pending", "approved", "approved", "paid"];
              const status = statuses[Math.floor(Math.random() * statuses.length)];

              const commissionId = await ctx.db.insert("commissions", {
                tenantId,
                affiliateId,
                campaignId: campaign,
                conversionId,
                amount: commissionValue,
                status,
                isSelfReferral: false,
                eventMetadata: {
                  source: "test_data",
                  timestamp,
                },
              });
              stats.commissionsCreated++;

              await ctx.db.insert("auditLogs", {
                tenantId,
                action: "commission_created",
                entityType: "commission",
                entityId: commissionId,
                actorType: "system",
                newValue: { affiliateId, amount: commissionValue, status },
              });
              stats.auditLogsCreated++;
            }

            // Generate payout batches and payouts for some affiliates
            if (conversionIds.length > 0) {
              const paidCommissions = await ctx.db
                .query("commissions")
                .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliateId))
                .filter((q) => q.eq(q.field("status"), "paid"))
                .collect();

              if (paidCommissions.length > 0) {
                const batchTotal = paidCommissions.reduce((sum, c) => sum + c.amount, 0);
                const batchId = await ctx.db.insert("payoutBatches", {
                  tenantId,
                  totalAmount: batchTotal,
                  affiliateCount: 1,
                  status: "completed",
                  generatedAt: now - 15 * 24 * 60 * 60 * 1000, // 15 days ago
                  completedAt: now - 14 * 24 * 60 * 60 * 1000,
                });
                stats.payoutBatchesCreated++;

                // Create one payout per affiliate (aggregating all their commissions)
                await ctx.db.insert("payouts", {
                  tenantId,
                  affiliateId,
                  batchId,
                  amount: batchTotal,
                  status: "completed",
                  paymentReference: `PAY-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                  paidAt: now - 14 * 24 * 60 * 60 * 1000,
                });
                stats.payoutsCreated++;

                // Link all commissions to this batch
                for (const commission of paidCommissions) {
                  await ctx.db.patch(commission._id, { batchId });
                }
              }
            }
          }
        }

        // Seed referral leads and referral pings for tenants with a billing provider
        // This simulates the Affilio.referral() flow: merchant's signup form captures leads
        if (tenantConfig.billingProvider) {
          // Get all active affiliates and referral links for this tenant
          const tenantReferralLinks = await ctx.db
            .query("referralLinks")
            .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
            .take(20);

          if (tenantReferralLinks.length > 0) {
            // Create 3-8 referral leads per tenant (simulating merchant signups)
            const leadCount = 3 + Math.floor(Math.random() * 6);
            const leadEmails = [
              "lead.alice@example.com",
              "lead.bob@example.com",
              "lead.charlie@example.com",
              "lead.diana@example.com",
              "lead.edward@example.com",
              "lead.fiona@example.com",
              "lead.george@example.com",
              "lead.hannah@example.com",
            ];

            for (let i = 0; i < Math.min(leadCount, leadEmails.length); i++) {
              const link = tenantReferralLinks[i % tenantReferralLinks.length];
              const leadTimestamp = randomDate(
                new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Last 60 days
                new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)  // At least 2 days ago
              );

              const isConverted = Math.random() > 0.4; // 60% conversion rate for leads

              await ctx.db.insert("referralLeads", {
                tenantId,
                email: leadEmails[i],
                affiliateId: link.affiliateId,
                referralLinkId: link._id,
                campaignId: link.campaignId,
                status: isConverted ? "converted" : "active",
                // Note: conversionId not set here since conversionIds are per-affiliate
                // The lead matching flow still works via email lookup regardless
              });
              stats.referralLeadsCreated++;

              // Create a referral ping for each lead (simulates Affilio.referral() call)
              await ctx.db.insert("referralPings", {
                tenantId,
                trackingKey: slug,
                timestamp: leadTimestamp,
                domain: tenantConfig.domain,
                pingType: "referral",
                email: leadEmails[i],
              });
              stats.referralPingsCreated++;
            }
          }
        }

        // Backfill denormalized tenantStats counters from actual records
        // (seedStats only creates zeros; the direct ctx.db.insert calls
        // above bypass the tenantStats mutation hooks, so we must sync here)
        try {
          await ctx.runMutation(internal.tenantStats.backfillStats, { tenantId });
        } catch (bfError) {
          errors.push(`Error backfilling stats for ${tenantConfig.name}: ${bfError instanceof Error ? bfError.message : String(bfError)}`);
        }

      } catch (error) {
        errors.push(`Error creating tenant ${tenantConfig.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // =========================================================================
    // Create Platform Admin tenant and user
    // =========================================================================
    try {
      const adminSlug = generateUniqueSlug(PLATFORM_ADMIN.name, existingSlugs);
      const adminTenantId = await ctx.db.insert("tenants", {
        name: PLATFORM_ADMIN.name,
        slug: adminSlug,
        domain: PLATFORM_ADMIN.domain,
        plan: "starter",
        trialEndsAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year trial (effectively unlimited for dev)
        status: "active",
        trackingVerifiedAt: Date.now(),
        branding: {
          portalName: PLATFORM_ADMIN.name,
          primaryColor: "#1c2260",
        },
      });
      stats.tenantsCreated++;

      await ctx.runMutation(internal.tenantStats.seedStats, { tenantId: adminTenantId });

      // Platform admin auth user was created via HTTP endpoint (seedAuthUsers action).
      // The auth hook may have created a minimal user record; upsert here.
      const existingAdmin = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", PLATFORM_ADMIN.users[0].email))
        .first();

      if (existingAdmin) {
        await ctx.db.patch(existingAdmin._id, {
          tenantId: adminTenantId,
          name: PLATFORM_ADMIN.users[0].name,
          role: PLATFORM_ADMIN.users[0].role, // "admin"
          emailVerified: true,
        });
      } else {
        await ctx.db.insert("users", {
          tenantId: adminTenantId,
          email: PLATFORM_ADMIN.users[0].email,
          name: PLATFORM_ADMIN.users[0].name,
          role: PLATFORM_ADMIN.users[0].role, // "admin"
          emailVerified: true,
        });
      }
      stats.usersCreated++;

      await ctx.db.insert("auditLogs", {
        tenantId: adminTenantId,
        action: "user_created",
        entityType: "user",
        entityId: existingAdmin ? existingAdmin._id : adminTenantId,
        actorId: existingAdmin ? existingAdmin._id : undefined,
        actorType: existingAdmin ? "admin" : "system",
        newValue: { email: PLATFORM_ADMIN.users[0].email, name: PLATFORM_ADMIN.users[0].name, role: PLATFORM_ADMIN.users[0].role },
      });
      stats.auditLogsCreated++;
    } catch (error) {
      errors.push(`Error creating platform admin: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: errors.length === 0,
      credentials,
      stats,
      errors,
    };
  },
});

/**
 * Get test credentials summary.
 * Returns the credentials for all test users without regenerating data.
 */
export const getTestCredentials = internalQuery({
  args: {},
  returns: v.object({
    tenants: v.array(v.object({
      name: v.string(),
      slug: v.string(),
      plan: v.string(),
      users: v.array(v.object({
        email: v.string(),
        password: v.string(),
        role: v.string(),
        name: v.string(),
      })),
    })),
    affiliates: v.array(v.object({
      tenantSlug: v.string(),
      tenantName: v.string(),
      email: v.string(),
      password: v.string(),
      name: v.string(),
      status: v.string(),
      referralCode: v.string(),
    })),
    commonPassword: v.string(),
  }),
  handler: async (ctx) => {
    const TEST_PASSWORD = "TestPass123!";
    const tenants: Array<{
      name: string;
      slug: string;
      plan: string;
      users: Array<{
        email: string;
        password: string;
        role: string;
        name: string;
      }>;
    }> = [];
    const affiliates: Array<{
      tenantSlug: string;
      tenantName: string;
      email: string;
      password: string;
      name: string;
      status: string;
      referralCode: string;
    }> = [];

    // Get all tenants
    const allTenants = await ctx.db.query("tenants").collect();

    for (const tenant of allTenants) {
      // Get users for this tenant
      const users = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect();

      if (users.length > 0) {
        tenants.push({
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          users: users.map(u => ({
            email: u.email,
            password: TEST_PASSWORD,
            role: u.role,
            name: u.name || "Unknown",
          })),
        });
      }

      // Get affiliates for this tenant
      const tenantAffiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
        .collect();

      for (const affiliate of tenantAffiliates) {
        affiliates.push({
          tenantSlug: tenant.slug,
          tenantName: tenant.name,
          email: affiliate.email,
          password: TEST_PASSWORD,
          name: affiliate.name,
          status: affiliate.status,
          referralCode: affiliate.uniqueCode,
        });
      }
    }

    return {
      tenants,
      affiliates,
      commonPassword: TEST_PASSWORD,
    };
  },
});
