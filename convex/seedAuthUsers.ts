/**
 * Seed Better Auth users via the HTTP signup endpoint.
 * This ensures users are created in the component's managed tables.
 * Run this BEFORE seedAllTestData.
 *
 * Usage: pnpm convex run seedAuthUsers:seedAuthUsers --push
 *
 * This action:
 * 1. Creates all auth users via HTTP signup endpoint
 * 2. If any signups fail (e.g., user already exists), uses the adapter
 *    to ensure credential accounts exist for orphaned users
 *
 * For a full fresh seed:
 *   pnpm convex run seedAuthUsers:seedAuthUsers --push
 *   pnpm convex run testData:clearAllTestData
 *   pnpm convex run testData:seedAllTestData
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const TEST_PASSWORD = "TestPass123!";
const TEST_PASSWORD_HASH = "b1fb84d0f1c6feb781d661faecc3eeb6:4840a3170ce388473977f0fef10160e603fc9d95a74f55b2bfbf7626d0879e545a1fe515d12b36f0230bce85f6d4f6de3cf8f98f9a1daca3deeefd06e76a2000";

// All user accounts to seed (matches testData.ts config)
const ALL_USERS: Array<{ email: string; name: string }> = [
  // Platform Admin
  { email: "admin@saligaffiliate.com", name: "Platform Admin" },
  // TechFlow SaaS
  { email: "alex@techflow.test", name: "Alex Chen" },
  { email: "maria@techflow.test", name: "Maria Santos" },
  { email: "john@techflow.test", name: "John Dela Cruz" },
  // GHL Agency Pro
  { email: "owner@ghlagency.test", name: "Patricia Lim" },
  { email: "ops@ghlagency.test", name: "Roberto Diaz" },
  // Digital Marketing Hub
  { email: "admin@digimark.test", name: "David Wong" },
  // Manila SaaS Labs
  { email: "angelo@manilasaas.test", name: "Angelo Reyes" },
  { email: "grace@manilasaas.test", name: "Grace Cruz" },
  // Cebu Digital Agency
  { email: "rachel@cebudigital.test", name: "Rachel Torres" },
  // GrowthHacks PH
  { email: "kevin@growthhacks.test", name: "Kevin Aquino" },
  { email: "tanya@growthhacks.test", name: "Tanya Reyes" },
  // Pinoy Marketing Co
  { email: "luis@pinoymarketing.test", name: "Luis Fernandez" },
  // SEAsia Tech Ventures
  { email: "brenda@seasiatech.test", name: "Brenda Ng" },
  { email: "raj@seasiatech.test", name: "Raj Patel" },
  // Bicol Digital Solutions
  { email: "marco@bicoldigital.test", name: "Marco Imperial" },
];

export const seedAuthUsers = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    created: v.array(v.object({
      email: v.string(),
      ok: v.boolean(),
      error: v.optional(v.string()),
    })),
    fixed: v.array(v.object({
      email: v.string(),
      status: v.string(),
    })),
  }),
  handler: async (ctx) => {
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) {
      throw new Error("SITE_URL environment variable is not set. Run: pnpm convex env set SITE_URL http://localhost:3000");
    }

    // Step 1: Create auth users via HTTP signup endpoint
    const created: Array<{ email: string; ok: boolean; error?: string }> = [];

    for (const user of ALL_USERS) {
      try {
        const res = await fetch(`${siteUrl}/api/auth/sign-up/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            password: TEST_PASSWORD,
            name: user.name,
          }),
        });
        const data = await res.json() as any;
        const ok = !!(data.user?.id || data.token);
        created.push({
          email: user.email,
          ok,
          error: ok ? undefined : `status ${res.status}: ${JSON.stringify(data)}`,
        });
      } catch (err) {
        created.push({
          email: user.email,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Step 2: For any failed signups, use the adapter to ensure
    // credential accounts exist for orphaned users
    const failedUsers = created.filter(c => !c.ok);
    let fixed: Array<{ email: string; status: string }> = [];

    if (failedUsers.length > 0) {
      try {
        fixed = await ctx.runMutation(
          internal.seedAuthHelpers.ensureAuthAccounts,
          {
            users: ALL_USERS.map(u => ({
              email: u.email,
              name: u.name,
              passwordHash: TEST_PASSWORD_HASH,
            })),
          },
        );
        // Update created results for fixed users
        for (const fix of fixed) {
          if (fix.status === "account_created") {
            const entry = created.find(c => c.email === fix.email);
            if (entry) {
              entry.ok = true;
              entry.error = undefined;
            }
          }
        }
      } catch (err) {
        console.error("Failed to ensure auth accounts:", err);
      }
    }

    return { success: true, created, fixed };
  },
});
