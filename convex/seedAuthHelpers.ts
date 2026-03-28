/**
 * Helper functions for seeding Better Auth component tables.
 * Uses the component's adapter to directly read/write managed tables.
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { betterAuthComponent } from "./auth";

/**
 * Create credential accounts for existing orphaned users in the component tables.
 * Uses findMany + create instead of findOne/delete (which have component issues).
 */
export const ensureAuthAccounts = internalMutation({
  args: {
    users: v.array(v.object({
      email: v.string(),
      name: v.string(),
      passwordHash: v.string(),
    })),
  },
  returns: v.array(v.object({
    email: v.string(),
    status: v.string(),
  })),
  handler: async (ctx, args) => {
    // Call the factory to get the actual adapter with methods
    const factory: any = betterAuthComponent.adapter(ctx);
    const db: any = factory({ options: {} });

    const results: Array<{ email: string; status: string }> = [];

    // Get all existing users from component table
    let allUsers: any[];
    try {
      allUsers = await db.findMany({ model: "user" });
    } catch (e: any) {
      return args.users.map(u => ({ email: u.email, status: `findUsers_failed: ${e.message}` }));
    }

    // Create email->user map for fast lookup
    const userByEmail = new Map<string, any>();
    for (const u of allUsers) {
      // Adapter maps _id to id in output
      userByEmail.set(u.email || u.email?.toLowerCase?.trim(), u);
    }

    for (const user of args.users) {
      try {
        const existingUser = userByEmail.get(user.email) || userByEmail.get(user.email.toLowerCase().trim());

        if (!existingUser) {
          results.push({ email: user.email, status: "user_missing" });
          continue;
        }

        // Try to create credential account — if it already exists, that's fine
        // The adapter auto-adds createdAt but updatedAt is required by the component schema
        const now = Date.now();
        await db.create({
          model: "account",
          data: {
            userId: existingUser.id,
            accountId: user.email,
            providerId: "credential",
            password: user.passwordHash,
            createdAt: now,
            updatedAt: now,
          },
        });

        results.push({ email: user.email, status: "account_created" });
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        // Check if it's a duplicate error (account already exists)
        if (msg.includes("duplicate") || msg.includes("already exists") || msg.includes("Unique")) {
          results.push({ email: user.email, status: "account_exists" });
        } else {
          results.push({ email: user.email, status: `error: ${msg}` });
        }
      }
    }

    return results;
  },
});
