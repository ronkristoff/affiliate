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

/**
 * Delete an orphaned user from the Better Auth component user table.
 * Used when a user exists in auth but has no account record and no
 * app-level user record — they cannot sign in or sign up.
 *
 * INTERNAL only — call via the deleteOrphanedAuthUserAction wrapper.
 */
export const deleteOrphanedAuthUserInternal = internalMutation({
  args: { email: v.string() },
  returns: v.object({
    deleted: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();

    // Verify the user does NOT exist in app tables (safety check)
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (appUser) {
      return { deleted: false, message: "User exists in app tables — refusing to delete" };
    }

    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (affiliate) {
      return { deleted: false, message: "User exists as affiliate — refusing to delete" };
    }

    // Use the component adapter to access component-scoped tables.
    // ctx.db.query("user") does NOT work for component tables —
    // only the adapter can see them.
    const factory: any = betterAuthComponent.adapter(ctx);
    const db: any = factory({ options: {} });

    let allUsers: any[];
    try {
      allUsers = await db.findMany({ model: "user" });
    } catch (e: any) {
      return { deleted: false, message: `findMany failed: ${e.message}` };
    }

    const targetUser = allUsers?.find(
      (u: any) => (u.email || "").toLowerCase() === cleanEmail,
    );

    if (!targetUser) {
      return {
        deleted: false,
        message: `User not found via adapter. Total adapter users: ${allUsers?.length ?? 0}. ` +
          (allUsers?.length > 0
            ? `First user email: ${allUsers[0].email}`
            : "No users in adapter."),
      };
    }

    // Delete associated accounts via adapter
    try {
      const allAccounts = await db.findMany({ model: "account" });
      const userAccounts = allAccounts.filter(
        (a: any) => a.userId === targetUser.id,
      );
      for (const acct of userAccounts) {
        try {
          await db.deleteOne({ model: "account", where: [{ field: "_id", value: acct._id }] });
        } catch {
          // Adapter delete may fail — try raw ctx.db as fallback
          try { await (ctx.db as any).delete(acct._id); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }

    // Delete sessions via adapter
    try {
      const allSessions = await db.findMany({ model: "session" });
      const userSessions = allSessions.filter(
        (s: any) => s.userId === targetUser.id,
      );
      for (const sess of userSessions) {
        try {
          await db.deleteOne({ model: "session", where: [{ field: "_id", value: sess._id }] });
        } catch {
          try { await (ctx.db as any).delete(sess._id); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }

    // Delete the user via adapter
    try {
      await db.deleteOne({ model: "user", where: [{ field: "_id", value: targetUser._id }] });
      return { deleted: true, message: `Deleted orphaned auth user: ${cleanEmail}` };
    } catch (adapterErr: any) {
      // Adapter delete is documented as unreliable — fall back to raw delete
      const errMsg = adapterErr instanceof Error ? adapterErr.message : String(adapterErr);
      return {
        deleted: false,
        message: `Adapter delete failed: ${errMsg}. User id: ${targetUser.id}, _id: ${targetUser._id}. ` +
          "Manual deletion may be required via Convex dashboard.",
      };
    }
  },
});
